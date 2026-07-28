create type public.geocoding_status as enum ('pending', 'resolved', 'failed', 'manual');
create type public.product_event_name as enum (
  'agent_dashboard_viewed',
  'pharmacy_opened',
  'navigation_waze_clicked',
  'navigation_maps_clicked',
  'interaction_started',
  'interaction_submitted',
  'next_action_created',
  'task_completed',
  'mission_opened',
  'report_started',
  'report_submitted'
);

alter table public.pharmacies
  add column geocoding_status public.geocoding_status not null default 'pending',
  add column geocoded_at timestamptz,
  add column geocoding_source text,
  add constraint pharmacies_coordinates_pair_check
    check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null)),
  add constraint pharmacies_geocoding_state_check
    check (
      (geocoding_status in ('resolved', 'manual') and latitude is not null and geocoded_at is not null and nullif(btrim(geocoding_source), '') is not null)
      or (geocoding_status in ('pending', 'failed'))
    );

create table public.product_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  pharmacy_id uuid references public.pharmacies(id) on delete set null,
  event_name public.product_event_name not null,
  occurred_at timestamptz not null default now(),
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint product_events_source_check check (char_length(btrim(source)) between 1 and 80),
  constraint product_events_metadata_check check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096
  )
);

create index product_events_brand_time_idx on public.product_events(brand_id, occurred_at desc);
create index product_events_user_time_idx on public.product_events(user_id, occurred_at desc);
create index product_events_pharmacy_time_idx on public.product_events(pharmacy_id, occurred_at desc)
  where pharmacy_id is not null;

alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;
grant select on public.product_events to authenticated;
grant all on public.product_events to service_role;
grant usage, select on sequence public.product_events_id_seq to service_role;

create policy product_events_select on public.product_events
for select to authenticated
using (
  (user_id = (select auth.uid()) and private.can_access_brand(brand_id))
  or private.has_brand_role(brand_id, array['tr1_manager', 'brand_admin'])
);

create or replace function public.track_product_event(
  target_event public.product_event_name,
  target_brand_id uuid,
  target_pharmacy_id uuid default null,
  target_source text default 'web',
  target_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  target_organization_id uuid;
  target_event_id bigint;
begin
  if target_user_id is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Product event forbidden' using errcode = '42501';
  end if;
  if target_pharmacy_id is not null and not exists (
    select 1
    from public.brand_pharmacies bp
    where bp.brand_id = target_brand_id
      and bp.pharmacy_id = target_pharmacy_id
      and bp.archived_at is null
      and private.can_access_brand_pharmacy(bp.id)
  ) then
    raise exception 'Product event pharmacy forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(target_metadata, '{}'::jsonb)::text) > 4096 then
    raise exception 'Product event metadata invalid' using errcode = '22023';
  end if;
  select b.organization_id into target_organization_id
  from public.brands b where b.id = target_brand_id;
  insert into public.product_events (
    organization_id, brand_id, user_id, pharmacy_id, event_name, source, metadata
  ) values (
    target_organization_id, target_brand_id, target_user_id, target_pharmacy_id,
    target_event, btrim(target_source), coalesce(target_metadata, '{}'::jsonb)
  ) returning id into target_event_id;
  return target_event_id;
end;
$$;

create or replace function public.search_authorized_pharmacies(
  target_brand_id uuid,
  search_text text default null,
  result_limit integer default 20
)
returns table (
  brand_pharmacy_id uuid,
  pharmacy_id uuid,
  pharmacy_name text,
  city text,
  postal_code text,
  address_line_1 text,
  phone text,
  commercial_status public.commercial_status,
  priority_level public.priority_level,
  potential_level public.potential_level,
  territory_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    bp.id, p.id, coalesce(p.trade_name, p.legal_name), p.city, p.postal_code,
    p.address_line_1, p.phone, bp.commercial_status, bp.priority_level,
    bp.potential_level, bp.territory_id
  from public.brand_pharmacies bp
  join public.pharmacies p on p.id = bp.pharmacy_id
  where bp.brand_id = target_brand_id
    and bp.archived_at is null
    and private.can_access_brand_pharmacy(bp.id)
    and (
      nullif(btrim(search_text), '') is null
      or concat_ws(' ', p.trade_name, p.legal_name, p.city, p.postal_code, p.cip_code)
        ilike '%' || btrim(search_text) || '%'
    )
  order by bp.priority_level desc, coalesce(p.trade_name, p.legal_name)
  limit least(greatest(result_limit, 1), 50);
$$;

create or replace function public.get_field_pharmacy_summary(target_brand_pharmacy_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare result jsonb;
begin
  if not private.can_access_brand_pharmacy(target_brand_pharmacy_id) then
    raise exception 'Pharmacy summary forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'brand_pharmacy_id', bp.id,
    'brand_id', bp.brand_id,
    'pharmacy_id', p.id,
    'name', coalesce(p.trade_name, p.legal_name),
    'address', concat_ws(', ', p.address_line_1, concat_ws(' ', p.postal_code, p.city)),
    'phone', p.phone,
    'latitude', p.latitude,
    'longitude', p.longitude,
    'status', bp.commercial_status,
    'priority', bp.priority_level,
    'potential', bp.potential_level,
    'last_interaction_at', bp.last_interaction_at,
    'last_order_at', bp.last_order_at,
    'next_action_type', bp.next_action_type,
    'next_action_at', bp.next_action_at,
    'primary_contact', (
      select jsonb_build_object('name', concat_ws(' ', c.first_name, c.last_name), 'phone', c.phone)
      from public.pharmacy_contacts c
      where c.pharmacy_id = p.id and c.is_primary and c.archived_at is null
      limit 1
    )
  ) into result
  from public.brand_pharmacies bp
  join public.pharmacies p on p.id = bp.pharmacy_id
  where bp.id = target_brand_pharmacy_id and bp.archived_at is null;
  return result;
end;
$$;

create or replace function public.get_agent_today(
  target_brand_id uuid,
  target_date date default current_date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare result jsonb;
begin
  if not private.can_access_brand(target_brand_id) then
    raise exception 'Agent agenda forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.is_overdue desc, rows.due_at asc nulls last, rows.priority_rank desc)
      from (
        select t.id, t.brand_pharmacy_id, t.title, t.task_type, t.priority, t.due_at,
          t.due_at < now() as is_overdue,
          case t.priority when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end as priority_rank,
          coalesce(p.trade_name, p.legal_name) as pharmacy_name, p.city
        from public.tasks t
        join public.brand_pharmacies bp on bp.id = t.brand_pharmacy_id
        join public.pharmacies p on p.id = bp.pharmacy_id
        where t.brand_id = target_brand_id and t.assigned_to = (select auth.uid())
          and t.status in ('open', 'in_progress') and t.archived_at is null
          and (t.due_at::date <= target_date or t.due_at is null)
      ) rows
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'brand_pharmacy_id', m.brand_pharmacy_id, 'title', m.title,
        'objective', m.objective, 'scheduled_start_at', m.scheduled_start_at,
        'priority', m.priority, 'status', m.status,
        'pharmacy_name', coalesce(p.trade_name, p.legal_name)
      ) order by m.scheduled_start_at asc)
      from public.missions m
      join public.pharmacies p on p.id = m.pharmacy_id
      where m.brand_id = target_brand_id and m.assigned_user_id = (select auth.uid())
        and m.archived_at is null and m.scheduled_start_at::date = target_date
        and m.status not in ('completed', 'cancelled', 'rejected', 'no_show')
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'mission_id', r.mission_id, 'title', m.title,
        'brand_pharmacy_id', m.brand_pharmacy_id, 'report_status', r.report_status
      ) order by r.updated_at asc)
      from public.mission_reports r
      join public.missions m on m.id = r.mission_id
      where r.brand_id = target_brand_id and r.submitted_by = (select auth.uid())
        and r.archived_at is null and r.report_status in ('draft', 'needs_correction')
    ), '[]'::jsonb),
    'follow_ups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand_pharmacy_id', bp.id, 'pharmacy_name', coalesce(p.trade_name, p.legal_name),
        'last_interaction_at', bp.last_interaction_at, 'priority', bp.priority_level
      ) order by bp.priority_level desc, bp.last_interaction_at asc nulls first)
      from public.brand_pharmacies bp
      join public.pharmacies p on p.id = bp.pharmacy_id
      where bp.brand_id = target_brand_id and bp.current_agent_user_id = (select auth.uid())
        and bp.archived_at is null and bp.commercial_status <> 'lost'
        and not exists (
          select 1 from public.tasks t
          where t.brand_pharmacy_id = bp.id and t.status in ('open', 'in_progress') and t.archived_at is null
        )
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_next_agent_visit(target_brand_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare result jsonb;
begin
  if not private.can_access_brand(target_brand_id) then
    raise exception 'Next visit forbidden' using errcode = '42501';
  end if;
  select public.get_field_pharmacy_summary(candidate.brand_pharmacy_id)
    || jsonb_build_object(
      'scheduled_at', candidate.scheduled_at,
      'objective', candidate.objective,
      'source_type', candidate.source_type,
      'source_id', candidate.source_id
    )
  into result
  from (
    select t.brand_pharmacy_id, t.due_at as scheduled_at, t.title as objective,
      'task'::text as source_type, t.id as source_id, t.priority::text as priority
    from public.tasks t
    where t.brand_id = target_brand_id and t.assigned_to = (select auth.uid())
      and t.task_type in ('visit', 'appointment') and t.status in ('open', 'in_progress')
      and t.archived_at is null
    union all
    select m.brand_pharmacy_id, m.scheduled_start_at, m.objective,
      'mission'::text, m.id, m.priority::text
    from public.missions m
    where m.brand_id = target_brand_id and m.assigned_user_id = (select auth.uid())
      and m.status in ('assigned', 'accepted', 'scheduled', 'in_progress')
      and m.archived_at is null
  ) candidate
  where candidate.brand_pharmacy_id is not null
  order by candidate.scheduled_at asc nulls last,
    case candidate.priority when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end desc
  limit 1;
  return result;
end;
$$;

create or replace function public.create_agent_task(
  target_brand_pharmacy_id uuid,
  target_task_type public.commercial_task_type,
  target_title text,
  target_due_at timestamptz,
  target_priority public.task_priority default 'normal',
  target_description text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_brand_id uuid;
  target_task_id uuid;
begin
  select bp.brand_id into target_brand_id
  from public.brand_pharmacies bp
  where bp.id = target_brand_pharmacy_id and bp.archived_at is null;
  if target_brand_id is null or not private.can_access_brand_pharmacy(target_brand_pharmacy_id) then
    raise exception 'Agent task forbidden' using errcode = '42501';
  end if;
  if nullif(btrim(target_title), '') is null then
    raise exception 'Task title is required' using errcode = '23514';
  end if;
  insert into public.tasks (
    brand_id, brand_pharmacy_id, task_type, title, description, priority,
    due_at, assigned_to, created_by, source
  ) values (
    target_brand_id, target_brand_pharmacy_id, target_task_type, btrim(target_title),
    nullif(btrim(target_description), ''), target_priority, target_due_at,
    (select auth.uid()), (select auth.uid()), 'manual'
  ) returning id into target_task_id;
  return target_task_id;
end;
$$;

revoke all on function public.track_product_event(public.product_event_name, uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.search_authorized_pharmacies(uuid, text, integer) from public, anon;
revoke all on function public.get_field_pharmacy_summary(uuid) from public, anon;
revoke all on function public.get_agent_today(uuid, date) from public, anon;
revoke all on function public.get_next_agent_visit(uuid) from public, anon;
revoke all on function public.create_agent_task(uuid, public.commercial_task_type, text, timestamptz, public.task_priority, text) from public, anon;

grant execute on function public.track_product_event(public.product_event_name, uuid, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.search_authorized_pharmacies(uuid, text, integer) to authenticated, service_role;
grant execute on function public.get_field_pharmacy_summary(uuid) to authenticated, service_role;
grant execute on function public.get_agent_today(uuid, date) to authenticated, service_role;
grant execute on function public.get_next_agent_visit(uuid) to authenticated, service_role;
grant execute on function public.create_agent_task(uuid, public.commercial_task_type, text, timestamptz, public.task_priority, text) to authenticated, service_role;
