create type public.field_visit_kind as enum ('client_visit','prospecting','relationship','training','other');
create type public.field_visit_status as enum ('planned','confirmed','in_progress','completed','cancelled');
create type public.agenda_block_type as enum ('unavailable','travel','meeting','break','personal','other');
create type public.mission_proposal_source as enum ('brand','provider','tr1');
create type public.mission_proposal_review_status as enum ('not_applicable','pending','needs_correction','approved','rejected');

create table public.field_visits (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
  visit_kind public.field_visit_kind not null default 'client_visit',
  status public.field_visit_status not null default 'planned',
  title text not null check (nullif(btrim(title),'') is not null),
  objective text,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  notes text,
  source public.commercial_source not null default 'manual',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (scheduled_end_at > scheduled_start_at)
);

create table public.field_visit_brands (
  visit_id uuid not null references public.field_visits(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null,
  objective text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (visit_id, brand_id),
  unique (visit_id, brand_pharmacy_id),
  foreign key (brand_pharmacy_id, brand_id) references public.brand_pharmacies(id, brand_id) on delete restrict
);

create table public.agenda_blocks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  block_type public.agenda_block_type not null,
  title text not null check (nullif(btrim(title),'') is not null),
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_busy boolean not null default true,
  source public.commercial_source not null default 'manual',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_at > start_at)
);

alter table public.missions
  add column proposal_source public.mission_proposal_source not null default 'brand',
  add column proposal_review_status public.mission_proposal_review_status not null default 'not_applicable',
  add column proposed_by_user_id uuid references public.users(id) on delete set null,
  add column proposal_reviewed_by_user_id uuid references public.users(id) on delete set null,
  add column proposal_reviewed_at timestamptz,
  add column proposal_review_note text,
  add constraint missions_provider_proposal_check check (
    proposal_source <> 'provider' or (proposed_by_user_id is not null and assigned_user_id = proposed_by_user_id)
  );

create index field_visits_owner_schedule_idx on public.field_visits(owner_user_id, scheduled_start_at) where archived_at is null;
create index field_visit_brands_relation_idx on public.field_visit_brands(brand_pharmacy_id, visit_id);
create index agenda_blocks_owner_schedule_idx on public.agenda_blocks(owner_user_id, start_at) where archived_at is null;
create index missions_provider_proposals_idx on public.missions(brand_id, proposal_review_status, created_at desc)
  where proposal_source = 'provider' and archived_at is null;

create or replace function private.validate_field_visit_brand()
returns trigger language plpgsql security definer set search_path = '' as $$
declare visit_pharmacy uuid; relation_pharmacy uuid;
begin
  select pharmacy_id into visit_pharmacy from public.field_visits where id = new.visit_id;
  select pharmacy_id into relation_pharmacy from public.brand_pharmacies
  where id = new.brand_pharmacy_id and brand_id = new.brand_id and archived_at is null;
  if visit_pharmacy is null or relation_pharmacy is null or visit_pharmacy <> relation_pharmacy then
    raise exception 'All visit brands must reference the same physical pharmacy' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger validate_field_visit_brand before insert or update on public.field_visit_brands
for each row execute function private.validate_field_visit_brand();

alter table public.field_visits enable row level security;
alter table public.field_visit_brands enable row level security;
alter table public.agenda_blocks enable row level security;
revoke all on public.field_visits, public.field_visit_brands, public.agenda_blocks from public, anon;
grant select on public.field_visits, public.field_visit_brands, public.agenda_blocks to authenticated;
grant all on public.field_visits, public.field_visit_brands, public.agenda_blocks to service_role;

create policy field_visits_select on public.field_visits for select to authenticated
using (owner_user_id = (select auth.uid()) and archived_at is null);
create policy field_visit_brands_select on public.field_visit_brands for select to authenticated
using (exists (select 1 from public.field_visits v where v.id=visit_id and v.owner_user_id=(select auth.uid()) and v.archived_at is null));
create policy agenda_blocks_select on public.agenda_blocks for select to authenticated
using (owner_user_id = (select auth.uid()) and archived_at is null);

create or replace function public.create_field_visit(
  target_pharmacy_id uuid,
  visit_payload jsonb,
  target_brand_pharmacy_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); visit_id uuid; relation record; relation_count integer := 0;
begin
  if actor is null or target_pharmacy_id is null or coalesce(array_length(target_brand_pharmacy_ids,1),0)=0 then
    raise exception 'Visit pharmacy and brands are required' using errcode='23514';
  end if;
  if nullif(visit_payload->>'title','') is null then raise exception 'Visit title is required' using errcode='23514'; end if;
  if nullif(visit_payload->>'scheduled_start_at','') is null or nullif(visit_payload->>'scheduled_end_at','') is null
     or (visit_payload->>'scheduled_end_at')::timestamptz <= (visit_payload->>'scheduled_start_at')::timestamptz then
    raise exception 'Visit end date must follow start date' using errcode='23514';
  end if;
  for relation in
    select bp.id,bp.brand_id,bp.pharmacy_id from public.brand_pharmacies bp
    where bp.id=any(target_brand_pharmacy_ids) and bp.archived_at is null
  loop
    relation_count := relation_count + 1;
    if relation.pharmacy_id <> target_pharmacy_id
       or not private.has_brand_role(relation.brand_id,array['agent'])
       or not private.user_is_assigned_to_relation(actor,relation.id) then
      raise exception 'Brand pharmacy unavailable for this visit' using errcode='42501';
    end if;
  end loop;
  if relation_count <> cardinality(target_brand_pharmacy_ids) then raise exception 'Brand pharmacy unavailable for this visit' using errcode='42501'; end if;
  insert into public.field_visits(owner_user_id,pharmacy_id,visit_kind,status,title,objective,scheduled_start_at,scheduled_end_at,notes,source,created_by)
  values(actor,target_pharmacy_id,coalesce((visit_payload->>'visit_kind')::public.field_visit_kind,'client_visit'),
    coalesce((visit_payload->>'status')::public.field_visit_status,'planned'),visit_payload->>'title',visit_payload->>'objective',
    (visit_payload->>'scheduled_start_at')::timestamptz,(visit_payload->>'scheduled_end_at')::timestamptz,visit_payload->>'notes','manual',actor)
  returning id into visit_id;
  insert into public.field_visit_brands(visit_id,brand_id,brand_pharmacy_id,is_primary)
  select visit_id,bp.brand_id,bp.id,row_number() over(order by bp.id)=1 from public.brand_pharmacies bp where bp.id=any(target_brand_pharmacy_ids);
  return visit_id;
end; $$;

create or replace function public.reschedule_field_visit(target_visit_id uuid, target_start_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.field_visits%rowtype; visit_duration interval;
begin
  select * into target from public.field_visits where id=target_visit_id for update;
  if target.id is null or target.owner_user_id<>(select auth.uid()) or target.archived_at is not null then
    raise exception 'Visit unavailable' using errcode='42501';
  end if;
  if target.status not in ('planned','confirmed') then raise exception 'Visit cannot be moved' using errcode='23514'; end if;
  if target_start_at is null then raise exception 'Visit start date is required' using errcode='23514'; end if;
  visit_duration := target.scheduled_end_at-target.scheduled_start_at;
  update public.field_visits set scheduled_start_at=target_start_at,scheduled_end_at=target_start_at+visit_duration,updated_at=now() where id=target_visit_id;
end; $$;

create or replace function public.create_agenda_block(block_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); block_id uuid;
begin
  if actor is null or nullif(block_payload->>'title','') is null then raise exception 'Block title is required' using errcode='23514'; end if;
  if nullif(block_payload->>'start_at','') is null or nullif(block_payload->>'end_at','') is null
     or (block_payload->>'end_at')::timestamptz <= (block_payload->>'start_at')::timestamptz then
    raise exception 'Block end date must follow start date' using errcode='23514';
  end if;
  insert into public.agenda_blocks(owner_user_id,block_type,title,start_at,end_at,is_busy,source,created_by)
  values(actor,(block_payload->>'block_type')::public.agenda_block_type,block_payload->>'title',
    (block_payload->>'start_at')::timestamptz,(block_payload->>'end_at')::timestamptz,coalesce((block_payload->>'is_busy')::boolean,true),'manual',actor)
  returning id into block_id;
  return block_id;
end; $$;

create or replace function public.propose_mission(target_brand_pharmacy_id uuid, mission_payload jsonb, product_payload jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare relation public.brand_pharmacies%rowtype; actor uuid := (select auth.uid()); mission_id uuid; product_record jsonb;
begin
  select * into relation from public.brand_pharmacies where id=target_brand_pharmacy_id and archived_at is null;
  if relation.id is null or not private.has_brand_role(relation.brand_id,array['agent','facilitator']) then
    raise exception 'Brand pharmacy unavailable' using errcode='42501';
  end if;
  if not private.mission_execution_role_allowed(relation.brand_id,actor,(mission_payload->>'mission_type')::public.mission_type) then
    raise exception 'Mission type is incompatible with provider role' using errcode='42501';
  end if;
  if private.has_brand_role(relation.brand_id,array['agent']) and not private.user_is_assigned_to_relation(actor,relation.id) then
    raise exception 'Pharmacy is outside agent scope' using errcode='42501';
  end if;
  if nullif(mission_payload->>'title','') is null or nullif(mission_payload->>'objective','') is null then raise exception 'Mission title and objective are required' using errcode='23514'; end if;
  if nullif(mission_payload->>'scheduled_start_at','') is null or nullif(mission_payload->>'scheduled_end_at','') is null
     or (mission_payload->>'scheduled_end_at')::timestamptz <= (mission_payload->>'scheduled_start_at')::timestamptz then
    raise exception 'Mission end date must follow start date' using errcode='23514';
  end if;
  if coalesce(nullif(mission_payload->>'budget_estimated_ht','')::numeric,0)<0 then raise exception 'Mission budget must be non-negative' using errcode='23514'; end if;
  insert into public.missions(organization_id,brand_id,brand_pharmacy_id,pharmacy_id,mission_type,status,title,objective,briefing,requested_by,managed_by,
    assigned_user_id,scheduled_start_at,scheduled_end_at,priority,location_mode,budget_estimated_ht,cost_estimated_ht,source,created_by,
    proposal_source,proposal_review_status,proposed_by_user_id)
  select b.organization_id,relation.brand_id,relation.id,relation.pharmacy_id,(mission_payload->>'mission_type')::public.mission_type,'requested',
    mission_payload->>'title',mission_payload->>'objective',mission_payload->>'briefing',actor,actor,actor,
    (mission_payload->>'scheduled_start_at')::timestamptz,(mission_payload->>'scheduled_end_at')::timestamptz,
    coalesce((mission_payload->>'priority')::public.mission_priority,'normal'),coalesce((mission_payload->>'location_mode')::public.mission_location_mode,'in_pharmacy'),
    coalesce(nullif(mission_payload->>'budget_estimated_ht','')::numeric,0),coalesce(nullif(mission_payload->>'budget_estimated_ht','')::numeric,0),
    'provider',actor,'provider','pending',actor from public.brands b where b.id=relation.brand_id returning id into mission_id;
  for product_record in select value from jsonb_array_elements(product_payload) loop
    if not exists(select 1 from public.products p where p.id=(product_record->>'product_id')::uuid and p.brand_id=relation.brand_id and p.is_active) then
      raise exception 'Mission product unavailable' using errcode='42501';
    end if;
    insert into public.mission_products(mission_id,brand_id,product_id) values(mission_id,relation.brand_id,(product_record->>'product_id')::uuid);
  end loop;
  return mission_id;
end; $$;

create or replace function public.review_provider_mission_proposal(target_mission_id uuid, target_decision public.mission_proposal_review_status,
  review_note text default null, target_start_at timestamptz default null, target_end_at timestamptz default null,
  target_budget_ht numeric default null, target_objective text default null, target_briefing text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.missions%rowtype; actor uuid := (select auth.uid()); clean_note text:=nullif(btrim(review_note),''); final_start timestamptz; final_end timestamptz;
begin
  select * into target from public.missions where id=target_mission_id for update;
  if target.id is null or target.proposal_source<>'provider' or target.proposal_review_status<>'pending'
     or not (private.user_is_tr1_for_brand(target.brand_id) or private.has_brand_role(target.brand_id,array['brand_admin'])) then
    raise exception 'Proposal unavailable' using errcode='42501';
  end if;
  if target_decision not in ('approved','needs_correction','rejected') then raise exception 'Invalid proposal decision' using errcode='23514'; end if;
  if target_decision in ('needs_correction','rejected') and clean_note is null then raise exception 'Review note is required' using errcode='23514'; end if;
  final_start:=coalesce(target_start_at,target.scheduled_start_at); final_end:=coalesce(target_end_at,target.scheduled_end_at);
  if target_decision='approved' and (final_start is null or final_end is null or final_end<=final_start) then raise exception 'Mission end date must follow start date' using errcode='23514'; end if;
  if coalesce(target_budget_ht,target.budget_estimated_ht,0)<0 then raise exception 'Mission budget must be non-negative' using errcode='23514'; end if;
  update public.missions set proposal_review_status=target_decision,proposal_reviewed_by_user_id=actor,proposal_reviewed_at=now(),proposal_review_note=clean_note,
    scheduled_start_at=final_start,scheduled_end_at=final_end,budget_estimated_ht=coalesce(target_budget_ht,budget_estimated_ht),
    cost_estimated_ht=coalesce(target_budget_ht,cost_estimated_ht),objective=coalesce(nullif(btrim(target_objective),''),objective),briefing=coalesce(target_briefing,briefing),
    managed_by=actor,status=case when target_decision='approved' then 'scheduled'::public.mission_status when target_decision='rejected' then 'rejected'::public.mission_status else status end,
    rejection_reason=case when target_decision='rejected' then clean_note else rejection_reason end where id=target_mission_id;
end; $$;

create or replace function public.resubmit_provider_mission_proposal(target_mission_id uuid, mission_payload jsonb, product_payload jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.missions%rowtype; actor uuid := (select auth.uid()); product_record jsonb; new_start timestamptz; new_end timestamptz;
begin
  select * into target from public.missions where id=target_mission_id for update;
  if target.id is null or target.proposal_source<>'provider' or target.proposal_review_status<>'needs_correction' or target.proposed_by_user_id<>actor then
    raise exception 'Proposal unavailable' using errcode='42501';
  end if;
  new_start:=coalesce(nullif(mission_payload->>'scheduled_start_at','')::timestamptz,target.scheduled_start_at);
  new_end:=coalesce(nullif(mission_payload->>'scheduled_end_at','')::timestamptz,target.scheduled_end_at);
  if new_start is null or new_end is null or new_end<=new_start then raise exception 'Mission end date must follow start date' using errcode='23514'; end if;
  if coalesce(nullif(mission_payload->>'budget_estimated_ht','')::numeric,target.budget_estimated_ht,0)<0 then raise exception 'Mission budget must be non-negative' using errcode='23514'; end if;
  update public.missions set title=coalesce(nullif(btrim(mission_payload->>'title'),''),title),objective=coalesce(nullif(btrim(mission_payload->>'objective'),''),objective),
    briefing=coalesce(mission_payload->>'briefing',briefing),scheduled_start_at=new_start,scheduled_end_at=new_end,
    budget_estimated_ht=coalesce(nullif(mission_payload->>'budget_estimated_ht','')::numeric,budget_estimated_ht),proposal_review_status='pending',
    proposal_reviewed_by_user_id=null,proposal_reviewed_at=null,proposal_review_note=null where id=target_mission_id;
  if product_payload is not null then
    delete from public.mission_products where mission_id=target_mission_id;
    for product_record in select value from jsonb_array_elements(product_payload) loop
      if not exists(select 1 from public.products p where p.id=(product_record->>'product_id')::uuid and p.brand_id=target.brand_id and p.is_active) then raise exception 'Mission product unavailable' using errcode='42501'; end if;
      insert into public.mission_products(mission_id,brand_id,product_id) values(target_mission_id,target.brand_id,(product_record->>'product_id')::uuid);
    end loop;
  end if;
end; $$;

create or replace function public.get_my_field_agenda(start_date date, end_date date, brand_filter uuid default null)
returns table(event_key text,source_kind text,source_id uuid,event_type text,title text,start_at timestamptz,end_at timestamptz,
  pharmacy_id uuid,pharmacy_name text,city text,brand_ids uuid[],brand_names text[],assigned_user_id uuid,assigned_user_name text,
  ownership text,status text,draggable boolean,detail_url text,priority text,metadata jsonb)
language sql stable security definer set search_path = '' as $$
  with bounds as (select start_date::timestamp at time zone 'Europe/Paris' as from_at,(end_date+1)::timestamp at time zone 'Europe/Paris' as to_at),
  visits as (
    select 'visit:'||v.id,'field_visit',v.id,'field_visit',v.title,v.scheduled_start_at,v.scheduled_end_at,v.pharmacy_id,coalesce(p.trade_name,p.legal_name),p.city,
      array_agg(fvb.brand_id order by fvb.brand_id),array_agg(b.name order by b.name),v.owner_user_id,up.full_name,'mine',v.status::text,
      v.status in ('planned','confirmed'),'/dashboard/agenda','normal',jsonb_build_object('visit_kind',v.visit_kind)
    from public.field_visits v join bounds x on v.scheduled_start_at<x.to_at and v.scheduled_end_at>x.from_at join public.pharmacies p on p.id=v.pharmacy_id
    join public.field_visit_brands fvb on fvb.visit_id=v.id join public.brands b on b.id=fvb.brand_id left join public.user_profiles up on up.user_id=v.owner_user_id
    where v.owner_user_id=(select auth.uid()) and v.archived_at is null and (brand_filter is null or fvb.brand_id=brand_filter)
    group by v.id,p.id,up.full_name
  ), mission_events as (
    select 'mission:'||m.id,'mission',m.id,'mission',m.title,m.scheduled_start_at,coalesce(m.scheduled_end_at,m.scheduled_start_at+interval '1 hour'),m.pharmacy_id,
      coalesce(p.trade_name,p.legal_name),p.city,array[m.brand_id],array[b.name],m.assigned_user_id,up.full_name,
      case when m.assigned_user_id=(select auth.uid()) then 'mine' else 'pharmacy_activity' end,m.status::text,false,'/dashboard/missions/'||m.id,m.priority::text,
      jsonb_build_object('mission_type',m.mission_type,'proposal_review_status',m.proposal_review_status)
    from public.missions m join bounds x on m.scheduled_start_at<x.to_at and coalesce(m.scheduled_end_at,m.scheduled_start_at+interval '1 hour')>x.from_at
    join public.pharmacies p on p.id=m.pharmacy_id join public.brands b on b.id=m.brand_id left join public.user_profiles up on up.user_id=m.assigned_user_id
    where m.archived_at is null and (brand_filter is null or m.brand_id=brand_filter) and (
      (m.assigned_user_id=(select auth.uid()) and (m.proposal_source<>'provider' or m.proposal_review_status in ('pending','needs_correction','approved')))
      or (m.assigned_user_id<>(select auth.uid()) and m.status in ('scheduled','in_progress','report_pending','completed')
        and (m.proposal_source<>'provider' or m.proposal_review_status='approved') and private.user_is_assigned_to_relation((select auth.uid()),m.brand_pharmacy_id))
    )
  ), task_events as (
    select 'task:'||t.id,'task',t.id,'task',t.title,t.due_at,t.due_at+interval '30 minutes',bp.pharmacy_id,coalesce(p.trade_name,p.legal_name),p.city,
      array[t.brand_id],array[b.name],t.assigned_to,up.full_name,'mine',t.status::text,false,'/dashboard/tasks',t.priority::text,jsonb_build_object('task_type',t.task_type)
    from public.tasks t join bounds x on t.due_at>=x.from_at and t.due_at<x.to_at join public.brand_pharmacies bp on bp.id=t.brand_pharmacy_id
    join public.pharmacies p on p.id=bp.pharmacy_id join public.brands b on b.id=t.brand_id left join public.user_profiles up on up.user_id=t.assigned_to
    where t.assigned_to=(select auth.uid()) and t.archived_at is null and t.status in ('open','in_progress') and (brand_filter is null or t.brand_id=brand_filter)
  ), report_events as (
    select 'report:'||m.id,'report',m.id,'report_due','Compte rendu · '||m.title,m.report_due_at,m.report_due_at+interval '30 minutes',m.pharmacy_id,
      coalesce(p.trade_name,p.legal_name),p.city,array[m.brand_id],array[b.name],m.assigned_user_id,up.full_name,'mine',m.status::text,false,
      '/dashboard/missions/'||m.id,m.priority::text,'{}'::jsonb
    from public.missions m join bounds x on m.report_due_at>=x.from_at and m.report_due_at<x.to_at join public.pharmacies p on p.id=m.pharmacy_id
    join public.brands b on b.id=m.brand_id left join public.user_profiles up on up.user_id=m.assigned_user_id
    where m.assigned_user_id=(select auth.uid()) and m.archived_at is null and m.status in ('in_progress','report_pending') and (brand_filter is null or m.brand_id=brand_filter)
  ), blocks as (
    select 'block:'||ab.id,'agenda_block',ab.id,'agenda_block',ab.title,ab.start_at,ab.end_at,null::uuid,null::text,null::text,'{}'::uuid[],'{}'::text[],
      ab.owner_user_id,null::text,'mine',ab.block_type::text,false,'/dashboard/agenda','normal',jsonb_build_object('is_busy',ab.is_busy)
    from public.agenda_blocks ab join bounds x on ab.start_at<x.to_at and ab.end_at>x.from_at where ab.owner_user_id=(select auth.uid()) and ab.archived_at is null and brand_filter is null
  )
  select * from visits union all select * from mission_events union all select * from task_events union all select * from report_events union all select * from blocks
  order by 6,1;
$$;

create or replace function public.get_provider_mission_pharmacies(target_brand_id uuid)
returns table(brand_pharmacy_id uuid,pharmacy_id uuid,pharmacy_name text,city text)
language sql stable security definer set search_path = '' as $$
  select bp.id,bp.pharmacy_id,coalesce(p.trade_name,p.legal_name),p.city
  from public.brand_pharmacies bp join public.pharmacies p on p.id=bp.pharmacy_id
  where bp.brand_id=target_brand_id and bp.archived_at is null
    and private.has_brand_role(target_brand_id,array['agent','facilitator'])
    and (not private.has_brand_role(target_brand_id,array['agent']) or private.user_is_assigned_to_relation((select auth.uid()),bp.id))
  order by coalesce(p.trade_name,p.legal_name);
$$;

create or replace function private.can_access_mission(target_mission_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.missions m where m.id=target_mission_id and m.archived_at is null and (
    private.user_is_tr1_for_brand(m.brand_id)
    or (m.assigned_user_id=(select auth.uid()) and private.user_has_active_brand_membership((select auth.uid()),m.brand_id))
    or private.has_brand_role(m.brand_id,array['brand_admin','brand_user'])
    or (m.status in ('scheduled','in_progress','report_pending','completed') and (m.proposal_source<>'provider' or m.proposal_review_status='approved')
      and private.user_is_assigned_to_relation((select auth.uid()),m.brand_pharmacy_id))
  ));
$$;

create or replace function public.get_my_unplanned_agenda_items(brand_filter uuid default null)
returns table(item_key text,source_kind text,source_id uuid,title text,pharmacy_id uuid,pharmacy_name text,brand_id uuid,brand_name text,
  due_at timestamptz,status text,priority text,detail_url text,metadata jsonb)
language sql stable security definer set search_path = '' as $$
  select 'task:'||t.id,'task',t.id,t.title,bp.pharmacy_id,coalesce(p.trade_name,p.legal_name),t.brand_id,b.name,t.due_at,
    case when t.due_at<now() then 'overdue' else t.status::text end,t.priority::text,'/dashboard/tasks',jsonb_build_object('brand_pharmacy_id',t.brand_pharmacy_id)
  from public.tasks t join public.brand_pharmacies bp on bp.id=t.brand_pharmacy_id join public.pharmacies p on p.id=bp.pharmacy_id join public.brands b on b.id=t.brand_id
  where t.assigned_to=(select auth.uid()) and t.archived_at is null and t.status in ('open','in_progress')
    and (t.due_at is null or t.due_at<now()) and (brand_filter is null or t.brand_id=brand_filter)
  union all
  select 'proposal:'||m.id,'mission_proposal',m.id,m.title,m.pharmacy_id,coalesce(p.trade_name,p.legal_name),m.brand_id,b.name,m.scheduled_start_at,
    m.proposal_review_status::text,m.priority::text,'/dashboard/missions/'||m.id,jsonb_build_object('review_note',m.proposal_review_note)
  from public.missions m join public.pharmacies p on p.id=m.pharmacy_id join public.brands b on b.id=m.brand_id
  where m.proposed_by_user_id=(select auth.uid()) and m.proposal_source='provider' and m.proposal_review_status='needs_correction' and m.archived_at is null
    and (brand_filter is null or m.brand_id=brand_filter)
  order by 9 nulls first,1;
$$;

revoke all on function private.validate_field_visit_brand() from public,anon,authenticated;
revoke all on function public.create_field_visit(uuid,jsonb,uuid[]), public.reschedule_field_visit(uuid,timestamptz), public.create_agenda_block(jsonb),
  public.propose_mission(uuid,jsonb,jsonb), public.review_provider_mission_proposal(uuid,public.mission_proposal_review_status,text,timestamptz,timestamptz,numeric,text,text),
  public.resubmit_provider_mission_proposal(uuid,jsonb,jsonb), public.get_my_field_agenda(date,date,uuid), public.get_my_unplanned_agenda_items(uuid), public.get_provider_mission_pharmacies(uuid) from public,anon;
grant execute on function public.create_field_visit(uuid,jsonb,uuid[]), public.reschedule_field_visit(uuid,timestamptz), public.create_agenda_block(jsonb),
  public.propose_mission(uuid,jsonb,jsonb), public.review_provider_mission_proposal(uuid,public.mission_proposal_review_status,text,timestamptz,timestamptz,numeric,text,text),
  public.resubmit_provider_mission_proposal(uuid,jsonb,jsonb), public.get_my_field_agenda(date,date,uuid), public.get_my_unplanned_agenda_items(uuid), public.get_provider_mission_pharmacies(uuid) to authenticated,service_role;

comment on table public.field_visits is 'Single physical user visit, optionally linked to several brands.';
comment on column public.missions.proposal_review_status is 'Independent review gate for provider-originated mission proposals.';
