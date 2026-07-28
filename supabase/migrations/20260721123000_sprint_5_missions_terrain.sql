create type public.mission_type as enum ('commercial_visit','prospecting_visit','animation','training','merchandising','pharmacy_audit','reactivation','product_launch','stock_check','relationship_visit','other');
create type public.mission_priority as enum ('low','normal','high','urgent');
create type public.mission_location_mode as enum ('in_pharmacy','remote','hybrid','external_event');
create type public.field_provider_type as enum ('animator','trainer','commercial_agent','merchandiser','auditor','freelancer','agency','other');
create type public.field_provider_status as enum ('active','inactive','suspended');
create type public.provider_contract_status as enum ('pending','active','expired','terminated');
create type public.mission_history_source as enum ('manual','provider','system','automation','import');
create type public.mission_objective_type as enum ('awareness','training','sell_out','listing','distribution_increase','launch','stock_clearance','recommendation','other');
create type public.mission_report_status as enum ('draft','submitted','needs_correction','validated','rejected');
create type public.data_quality_status as enum ('pending','complete','incomplete','inconsistent');
create type public.mission_visibility as enum ('shared','tr1_internal','provider_private');
create type public.mission_rating as enum ('poor','fair','good','very_good','excellent');

drop policy if exists missions_select on public.missions;
drop policy if exists missions_manage on public.missions;
drop policy if exists missions_insert on public.missions;
drop policy if exists missions_update on public.missions;
drop policy if exists missions_delete on public.missions;
drop policy if exists mission_reports_select on public.mission_reports;
drop policy if exists mission_reports_insert on public.mission_reports;
drop policy if exists mission_reports_update on public.mission_reports;

alter table public.missions alter column status drop default;
alter type public.mission_status rename to mission_status_legacy;
create type public.mission_status as enum ('draft','requested','to_assign','assigned','accepted','scheduled','in_progress','report_pending','completed','cancelled','rejected','no_show');
alter table public.missions alter column status type public.mission_status using (
  case status::text when 'planned' then 'scheduled' when 'in_progress' then 'in_progress' when 'completed' then 'completed' else 'cancelled' end
)::public.mission_status;
alter table public.missions alter column status set default 'draft';

alter table public.missions rename column intervenor_user_id to assigned_user_id;
alter table public.missions rename column starts_at to scheduled_start_at;
alter table public.missions rename column ends_at to scheduled_end_at;
alter table public.missions alter column assigned_user_id drop not null;
alter table public.missions alter column scheduled_start_at drop not null;
alter table public.missions drop constraint if exists missions_check;
alter table public.missions
  add column mission_type public.mission_type not null default 'other',
  add column objective text not null default 'Objectif à préciser',
  add column internal_notes text,
  add column requested_by uuid references public.users(id) on delete set null,
  add column managed_by uuid references public.users(id) on delete restrict,
  add column assigned_external_provider_id uuid,
  add column actual_start_at timestamptz,
  add column actual_end_at timestamptz,
  add column estimated_duration_minutes integer,
  add column priority public.mission_priority not null default 'normal',
  add column location_mode public.mission_location_mode not null default 'in_pharmacy',
  add column address_snapshot jsonb,
  add column budget_estimated_ht numeric(12,2),
  add column provider_cost_ht numeric(12,2) not null default 0,
  add column cost_estimated_ht numeric(12,2),
  add column cost_actual_ht numeric(12,2) not null default 0,
  add column travel_cost_ht numeric(12,2) not null default 0,
  add column meal_cost_ht numeric(12,2) not null default 0,
  add column additional_cost_ht numeric(12,2) not null default 0,
  add column currency_code text not null default 'EUR',
  add column report_due_at timestamptz,
  add column completed_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancellation_reason text,
  add column rejection_reason text,
  add column no_show_reason text,
  add column source public.mission_history_source not null default 'manual',
  add column source_task_id uuid references public.tasks(id) on delete set null,
  add column source_interaction_id uuid references public.interactions(id) on delete set null,
  add column archived_at timestamptz,
  add column created_by uuid references public.users(id) on delete restrict;

update public.missions set requested_by = assigned_user_id, managed_by = assigned_user_id, created_by = assigned_user_id,
  objective = coalesce(nullif(title, ''), 'Mission terrain'),
  address_snapshot = jsonb_build_object('legal_name', p.legal_name, 'trade_name', p.trade_name, 'address', p.address_line_1, 'postal_code', p.postal_code, 'city', p.city)
from public.pharmacies p where p.id = missions.pharmacy_id;
alter table public.missions alter column managed_by set not null;
alter table public.missions alter column created_by set not null;
alter table public.missions
  add constraint missions_schedule_check check (scheduled_end_at is null or scheduled_start_at is null or scheduled_end_at >= scheduled_start_at),
  add constraint missions_actual_schedule_check check (actual_end_at is null or actual_start_at is null or actual_end_at >= actual_start_at),
  add constraint missions_duration_check check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  add constraint missions_costs_check check (coalesce(budget_estimated_ht,0) >= 0 and provider_cost_ht >= 0 and coalesce(cost_estimated_ht,0) >= 0 and cost_actual_ht >= 0 and travel_cost_ht >= 0 and meal_cost_ht >= 0 and additional_cost_ht >= 0),
  add constraint missions_currency_check check (currency_code ~ '^[A-Z]{3}$'),
  add constraint missions_cancellation_reason_check check (status <> 'cancelled' or nullif(btrim(cancellation_reason),'') is not null),
  add constraint missions_rejection_reason_check check (status <> 'rejected' or nullif(btrim(rejection_reason),'') is not null),
  add constraint missions_no_show_reason_check check (status <> 'no_show' or nullif(btrim(no_show_reason),'') is not null),
  add constraint missions_one_provider_check check (not (assigned_user_id is not null and assigned_external_provider_id is not null)),
  add constraint missions_id_brand_unique unique (id, brand_id);

create table public.field_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid references public.users(id) on delete set null,
  provider_type public.field_provider_type not null,
  legal_name text,
  display_name text not null,
  email text not null,
  phone text,
  status public.field_provider_status not null default 'active',
  coverage_areas text[] not null default '{}',
  skills text[] not null default '{}',
  brands_authorized uuid[] not null default '{}',
  contract_status public.provider_contract_status not null default 'pending',
  daily_rate_ht numeric(12,2),
  half_day_rate_ht numeric(12,2),
  travel_rate_type text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email),
  check (coalesce(daily_rate_ht,0) >= 0 and coalesce(half_day_rate_ht,0) >= 0)
);
alter table public.missions add constraint missions_external_provider_fk foreign key (assigned_external_provider_id) references public.field_providers(id) on delete set null;

create table public.mission_status_history (
  id bigint generated always as identity primary key,
  mission_id uuid not null,
  brand_id uuid not null,
  previous_status public.mission_status,
  new_status public.mission_status not null,
  reason text,
  changed_by uuid references public.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  source public.mission_history_source not null default 'manual',
  metadata jsonb not null default '{}',
  foreign key (mission_id, brand_id) references public.missions(id, brand_id) on delete cascade
);

create table public.mission_products (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null,
  brand_id uuid not null,
  product_id uuid not null,
  objective_type public.mission_objective_type not null default 'other',
  target_quantity integer,
  priority public.mission_priority not null default 'normal',
  briefing_notes text,
  created_at timestamptz not null default now(),
  unique (mission_id, product_id),
  foreign key (mission_id, brand_id) references public.missions(id, brand_id) on delete cascade,
  foreign key (product_id, brand_id) references public.products(id, brand_id) on delete restrict,
  check (target_quantity is null or target_quantity >= 0)
);

alter table public.mission_reports rename column author_user_id to submitted_by;
alter table public.mission_reports drop constraint if exists mission_reports_mission_id_author_user_id_key;
alter table public.mission_reports alter column submitted_by drop not null;
alter table public.mission_reports alter column content drop not null;
alter table public.mission_reports
  add column report_status public.mission_report_status not null default 'draft',
  add column visibility public.mission_visibility not null default 'shared',
  add column summary text,
  add column pharmacy_feedback text,
  add column team_feedback text,
  add column objections text,
  add column opportunities text,
  add column recommended_next_action text,
  add column recommended_next_action_at timestamptz,
  add column follow_up_required boolean not null default false,
  add column follow_up_owner_id uuid references public.users(id) on delete set null,
  add column data_quality_status public.data_quality_status not null default 'pending',
  add column validated_by uuid references public.users(id) on delete set null,
  add column validated_at timestamptz,
  add column rejection_reason text,
  add column archived_at timestamptz,
  add column stock_before integer,
  add column stock_after integer,
  add column units_sold integer,
  add column gross_sales_ttc numeric(12,2),
  add column net_sales_ttc numeric(12,2),
  add column customer_contacts integer,
  add column qualified_contacts integer,
  add column samples_distributed integer,
  add column coupons_distributed integer,
  add column duration_minutes integer,
  add column team_members_present integer,
  add column placement_quality public.mission_rating,
  add column visibility_quality public.mission_rating,
  add column customer_reception public.mission_rating,
  add column pharmacy_satisfaction public.mission_rating,
  add column reorder_recommended boolean,
  add column reorder_quantity_recommended integer,
  add column participant_count integer,
  add column participant_roles text[] not null default '{}',
  add column topics_covered text[] not null default '{}',
  add column products_covered uuid[] not null default '{}',
  add column knowledge_before numeric(5,2),
  add column knowledge_after numeric(5,2),
  add column quiz_score numeric(5,2),
  add column satisfaction_score numeric(5,2),
  add column materials_provided text[] not null default '{}',
  add column objections_identified text,
  add column follow_up_training_required boolean,
  add column contact_met text,
  add column contact_role text,
  add column meeting_outcome text,
  add column offer_presented boolean,
  add column products_discussed uuid[] not null default '{}',
  add column order_expected boolean,
  add column estimated_order_amount_ht numeric(12,2),
  add column commitments text,
  add column next_step text,
  add column next_step_at timestamptz,
  add constraint mission_reports_one_active unique (mission_id),
  add constraint mission_reports_values_check check (
    coalesce(stock_before,0) >= 0 and coalesce(stock_after,0) >= 0 and coalesce(units_sold,0) >= 0 and
    coalesce(customer_contacts,0) >= 0 and coalesce(participant_count,0) >= 0 and coalesce(duration_minutes,0) >= 0 and
    coalesce(gross_sales_ttc,0) >= 0 and coalesce(net_sales_ttc,0) >= 0 and coalesce(estimated_order_amount_ht,0) >= 0 and
    (knowledge_before is null or knowledge_before between 0 and 100) and (knowledge_after is null or knowledge_after between 0 and 100) and
    (quiz_score is null or quiz_score between 0 and 100) and (satisfaction_score is null or satisfaction_score between 0 and 100)
  );

create table public.mission_product_results (
  id uuid primary key default gen_random_uuid(),
  mission_report_id uuid not null references public.mission_reports(id) on delete cascade,
  mission_product_id uuid not null references public.mission_products(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  stock_before integer,
  stock_after integer,
  units_sold integer not null default 0,
  samples_distributed integer,
  sales_ttc numeric(12,2),
  observed_objections text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_report_id, mission_product_id),
  check (coalesce(stock_before,0) >= 0 and coalesce(stock_after,0) >= 0 and units_sold >= 0 and coalesce(samples_distributed,0) >= 0 and coalesce(sales_ttc,0) >= 0)
);

create table public.mission_attachments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null,
  brand_id uuid not null,
  mission_report_id uuid references public.mission_reports(id) on delete set null,
  bucket_id text not null default 'mission-evidence',
  object_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  visibility public.mission_visibility not null default 'shared',
  uploaded_by uuid not null references public.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (mission_id, brand_id) references public.missions(id, brand_id) on delete cascade,
  check (size_bytes > 0 and size_bytes <= 10485760),
  check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  check (object_path = brand_id::text || '/' || mission_id::text || '/' || split_part(object_path, '/', 3))
);

alter table public.brand_settings
  add column allow_brand_to_request_missions boolean not null default false,
  add column allow_brand_to_view_reports boolean not null default true,
  add column allow_brand_to_view_photos boolean not null default true,
  add column allow_provider_to_view_sales_history boolean not null default false,
  add column report_validation_required boolean not null default true,
  add column report_due_delay_hours integer not null default 24 check (report_due_delay_hours between 1 and 720),
  add column default_animation_duration_minutes integer not null default 420 check (default_animation_duration_minutes > 0),
  add column default_training_duration_minutes integer not null default 120 check (default_training_duration_minutes > 0),
  add column gross_margin_rate numeric(5,2) check (gross_margin_rate is null or gross_margin_rate between 0 and 100),
  add column roi_measurement_window_days integer not null default 30 check (roi_measurement_window_days between 1 and 365),
  add column mission_reminder_hours integer not null default 24 check (mission_reminder_hours between 1 and 720),
  add column animation_report_required boolean not null default true,
  add column training_report_required boolean not null default true,
  add column require_photos_for_animation boolean not null default false,
  add column require_participant_count_for_training boolean not null default true,
  add column allow_provider_to_create_follow_up_task boolean not null default false;

create index missions_brand_schedule_idx on public.missions(brand_id, scheduled_start_at, status) where archived_at is null;
create index missions_assignee_schedule_idx on public.missions(assigned_user_id, scheduled_start_at, scheduled_end_at) where archived_at is null and status not in ('cancelled','rejected','no_show','completed');
create index mission_reports_validation_idx on public.mission_reports(brand_id, report_status, submitted_at) where archived_at is null;
create index mission_history_mission_idx on public.mission_status_history(mission_id, changed_at desc);
create index mission_attachments_mission_idx on public.mission_attachments(mission_id, created_at) where archived_at is null;

create or replace function private.user_is_tr1_for_brand(target_brand_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_global_role(array['super_admin']) or private.has_brand_role(target_brand_id, array['tr1_manager']);
$$;

create or replace function private.can_access_mission(target_mission_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.missions m
    where m.id = target_mission_id and m.archived_at is null and (
      private.user_is_tr1_for_brand(m.brand_id)
      or (m.assigned_user_id = (select auth.uid()) and private.user_has_active_brand_membership((select auth.uid()), m.brand_id))
      or private.has_brand_role(m.brand_id, array['brand_admin','brand_user'])
    )
  );
$$;

create or replace function private.validate_mission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare relation_record public.brand_pharmacies%rowtype; provider_record public.field_providers%rowtype;
begin
  select * into relation_record from public.brand_pharmacies where id = new.brand_pharmacy_id and archived_at is null;
  if relation_record.id is null or relation_record.brand_id <> new.brand_id or relation_record.pharmacy_id <> new.pharmacy_id then raise exception 'Mission brand pharmacy mismatch' using errcode='23514'; end if;
  if new.assigned_user_id is not null and not private.user_has_active_brand_membership(new.assigned_user_id, new.brand_id) then raise exception 'Assigned user is not active for this brand' using errcode='23514'; end if;
  if new.assigned_external_provider_id is not null then
    select * into provider_record from public.field_providers where id = new.assigned_external_provider_id and archived_at is null and status = 'active';
    if provider_record.id is null or not (new.brand_id = any(provider_record.brands_authorized)) then raise exception 'Provider is not authorized for this brand' using errcode='23514'; end if;
  end if;
  if new.assigned_user_id is not null and new.scheduled_start_at is not null and new.scheduled_end_at is not null and exists (
    select 1 from public.missions concurrent where concurrent.id <> new.id and concurrent.assigned_user_id = new.assigned_user_id
      and concurrent.archived_at is null and concurrent.status not in ('cancelled','rejected','no_show','completed')
      and tstzrange(concurrent.scheduled_start_at, concurrent.scheduled_end_at, '[)') && tstzrange(new.scheduled_start_at, new.scheduled_end_at, '[)')
  ) then raise exception 'Provider schedule overlap' using errcode='23P01'; end if;
  new.cost_actual_ht := round(coalesce(new.provider_cost_ht,0) + coalesce(new.travel_cost_ht,0) + coalesce(new.meal_cost_ht,0) + coalesce(new.additional_cost_ht,0), 2);
  if new.status = 'completed' and new.completed_at is null then new.completed_at := now(); end if;
  if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
  return new;
end;
$$;

create or replace function private.record_mission_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.mission_status_history(mission_id,brand_id,previous_status,new_status,reason,changed_by,source)
    values (new.id,new.brand_id,case when tg_op='UPDATE' then old.status else null end,new.status,
      case new.status when 'cancelled' then new.cancellation_reason when 'rejected' then new.rejection_reason when 'no_show' then new.no_show_reason else null end,
      coalesce((select auth.uid()),new.created_by),new.source);
  end if;
  return new;
end;
$$;

create or replace function private.validate_mission_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_mission public.missions%rowtype; settings public.brand_settings%rowtype;
begin
  select * into target_mission from public.missions where id = new.mission_id;
  if target_mission.id is null or target_mission.brand_id <> new.brand_id then raise exception 'Mission report brand mismatch' using errcode='23514'; end if;
  if tg_op='UPDATE' and old.report_status in ('validated','rejected') and not private.user_is_tr1_for_brand(new.brand_id) then raise exception 'Final report is immutable' using errcode='42501'; end if;
  if new.report_status in ('submitted','validated') then
    if nullif(btrim(new.summary),'') is null then raise exception 'Report summary is required' using errcode='23514'; end if;
    if target_mission.mission_type = 'animation' and (new.units_sold is null or new.duration_minutes is null or new.customer_contacts is null) then raise exception 'Animation results are incomplete' using errcode='23514'; end if;
    select * into settings from public.brand_settings where brand_id = new.brand_id;
    if target_mission.mission_type = 'training' and settings.require_participant_count_for_training and coalesce(new.participant_count,0) <= 0 then raise exception 'Training participant count is required' using errcode='23514'; end if;
  end if;
  if new.report_status='submitted' and new.submitted_at is null then new.submitted_at := now(); end if;
  return new;
end;
$$;

drop trigger if exists set_missions_updated_at on public.missions;
drop trigger if exists set_mission_reports_updated_at on public.mission_reports;
create trigger validate_mission before insert or update on public.missions for each row execute function private.validate_mission();
create trigger record_mission_status after insert or update of status on public.missions for each row execute function private.record_mission_status();
create trigger set_missions_updated_at before update on public.missions for each row execute function private.set_updated_at();
create trigger set_field_providers_updated_at before update on public.field_providers for each row execute function private.set_updated_at();
create trigger validate_mission_report before insert or update on public.mission_reports for each row execute function private.validate_mission_report();
create trigger set_mission_reports_updated_at before update on public.mission_reports for each row execute function private.set_updated_at();
create trigger set_mission_product_results_updated_at before update on public.mission_product_results for each row execute function private.set_updated_at();

create or replace function public.create_mission(target_brand_pharmacy_id uuid, mission_payload jsonb, product_payload jsonb default '[]')
returns uuid language plpgsql security invoker set search_path = '' as $$
declare relation_record public.brand_pharmacies%rowtype; mission_id uuid; product_record jsonb;
begin
  select * into relation_record from public.brand_pharmacies where id=target_brand_pharmacy_id and archived_at is null;
  if relation_record.id is null or not private.user_is_tr1_for_brand(relation_record.brand_id) then raise exception 'Brand pharmacy unavailable' using errcode='42501'; end if;
  insert into public.missions(organization_id,brand_id,brand_pharmacy_id,pharmacy_id,mission_type,status,title,objective,briefing,internal_notes,requested_by,managed_by,assigned_user_id,scheduled_start_at,scheduled_end_at,estimated_duration_minutes,priority,location_mode,budget_estimated_ht,cost_estimated_ht,provider_cost_ht,travel_cost_ht,meal_cost_ht,additional_cost_ht,report_due_at,source,created_by)
  select b.organization_id,relation_record.brand_id,relation_record.id,relation_record.pharmacy_id,
    (mission_payload->>'mission_type')::public.mission_type,coalesce((mission_payload->>'status')::public.mission_status,'draft'),
    mission_payload->>'title',mission_payload->>'objective',mission_payload->>'briefing',mission_payload->>'internal_notes',(select auth.uid()),
    coalesce((mission_payload->>'managed_by')::uuid,(select auth.uid())),nullif(mission_payload->>'assigned_user_id','')::uuid,
    nullif(mission_payload->>'scheduled_start_at','')::timestamptz,nullif(mission_payload->>'scheduled_end_at','')::timestamptz,
    nullif(mission_payload->>'estimated_duration_minutes','')::integer,coalesce((mission_payload->>'priority')::public.mission_priority,'normal'),
    coalesce((mission_payload->>'location_mode')::public.mission_location_mode,'in_pharmacy'),nullif(mission_payload->>'budget_estimated_ht','')::numeric,
    nullif(mission_payload->>'cost_estimated_ht','')::numeric,coalesce(nullif(mission_payload->>'provider_cost_ht','')::numeric,0),coalesce(nullif(mission_payload->>'travel_cost_ht','')::numeric,0),coalesce(nullif(mission_payload->>'meal_cost_ht','')::numeric,0),coalesce(nullif(mission_payload->>'additional_cost_ht','')::numeric,0),
    nullif(mission_payload->>'report_due_at','')::timestamptz,'manual',(select auth.uid()) from public.brands b where b.id=relation_record.brand_id returning id into mission_id;
  for product_record in select value from jsonb_array_elements(product_payload) loop
    insert into public.mission_products(mission_id,brand_id,product_id,objective_type,target_quantity,priority,briefing_notes)
    values (mission_id,relation_record.brand_id,(product_record->>'product_id')::uuid,coalesce((product_record->>'objective_type')::public.mission_objective_type,'other'),nullif(product_record->>'target_quantity','')::integer,coalesce((product_record->>'priority')::public.mission_priority,'normal'),product_record->>'briefing_notes');
  end loop;
  return mission_id;
end;
$$;

create or replace function public.change_mission_status(target_mission_id uuid, target_status public.mission_status, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.missions%rowtype; allowed boolean := false;
begin
  select * into target from public.missions where id=target_mission_id for update;
  if target.id is null or not private.can_access_mission(target.id) then raise exception 'Mission unavailable' using errcode='42501'; end if;
  allowed := case target.status
    when 'draft' then target_status in ('requested','cancelled')
    when 'requested' then target_status in ('to_assign','cancelled')
    when 'to_assign' then target_status in ('assigned','cancelled')
    when 'assigned' then target_status in ('accepted','rejected','cancelled')
    when 'accepted' then target_status in ('scheduled','cancelled')
    when 'scheduled' then target_status in ('in_progress','no_show','cancelled')
    when 'in_progress' then target_status in ('report_pending','cancelled')
    when 'report_pending' then target_status in ('completed','cancelled')
    else false end;
  if not allowed then raise exception 'Invalid mission status transition' using errcode='23514'; end if;
  if target.assigned_user_id=(select auth.uid()) and not private.user_is_tr1_for_brand(target.brand_id) and target_status not in ('accepted','rejected','in_progress','report_pending') then raise exception 'Provider cannot perform this transition' using errcode='42501'; end if;
  update public.missions set status=target_status,
    cancellation_reason=case when target_status='cancelled' then reason else cancellation_reason end,
    rejection_reason=case when target_status='rejected' then reason else rejection_reason end,
    no_show_reason=case when target_status='no_show' then reason else no_show_reason end,
    actual_start_at=case when target_status='in_progress' then coalesce(actual_start_at,now()) else actual_start_at end
  where id=target_mission_id;
  update public.mission_status_history history set reason=coalesce(history.reason,change_mission_status.reason), source=(case when target.assigned_user_id=(select auth.uid()) then 'provider' else 'manual' end)::public.mission_history_source
  where history.id=(select max(id) from public.mission_status_history where mission_id=target_mission_id);
end;
$$;

create or replace function public.save_mission_report(target_mission_id uuid, report_payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare target public.missions%rowtype; report_id uuid;
begin
  select * into target from public.missions where id=target_mission_id;
  if target.id is null or not private.can_access_mission(target.id) then raise exception 'Mission unavailable' using errcode='42501'; end if;
  if target.assigned_user_id is distinct from (select auth.uid()) and not private.user_is_tr1_for_brand(target.brand_id) then raise exception 'Only the assigned provider can report' using errcode='42501'; end if;
  insert into public.mission_reports(organization_id,brand_id,mission_id,submitted_by,report_status,visibility,summary,pharmacy_feedback,team_feedback,objections,opportunities,recommended_next_action,recommended_next_action_at,follow_up_required,follow_up_owner_id,data_quality_status,stock_before,stock_after,units_sold,gross_sales_ttc,net_sales_ttc,customer_contacts,qualified_contacts,samples_distributed,coupons_distributed,duration_minutes,team_members_present,reorder_recommended,reorder_quantity_recommended,participant_count,participant_roles,topics_covered,knowledge_before,knowledge_after,quiz_score,satisfaction_score,materials_provided,objections_identified,follow_up_training_required,contact_met,contact_role,meeting_outcome,offer_presented,order_expected,estimated_order_amount_ht,commitments,next_step,next_step_at)
  values (target.organization_id,target.brand_id,target.id,(select auth.uid()),coalesce((report_payload->>'report_status')::public.mission_report_status,'draft'),coalesce((report_payload->>'visibility')::public.mission_visibility,'shared'),report_payload->>'summary',report_payload->>'pharmacy_feedback',report_payload->>'team_feedback',report_payload->>'objections',report_payload->>'opportunities',report_payload->>'recommended_next_action',nullif(report_payload->>'recommended_next_action_at','')::timestamptz,coalesce((report_payload->>'follow_up_required')::boolean,false),nullif(report_payload->>'follow_up_owner_id','')::uuid,coalesce((report_payload->>'data_quality_status')::public.data_quality_status,'pending'),nullif(report_payload->>'stock_before','')::integer,nullif(report_payload->>'stock_after','')::integer,nullif(report_payload->>'units_sold','')::integer,nullif(report_payload->>'gross_sales_ttc','')::numeric,nullif(report_payload->>'net_sales_ttc','')::numeric,nullif(report_payload->>'customer_contacts','')::integer,nullif(report_payload->>'qualified_contacts','')::integer,nullif(report_payload->>'samples_distributed','')::integer,nullif(report_payload->>'coupons_distributed','')::integer,nullif(report_payload->>'duration_minutes','')::integer,nullif(report_payload->>'team_members_present','')::integer,nullif(report_payload->>'reorder_recommended','')::boolean,nullif(report_payload->>'reorder_quantity_recommended','')::integer,nullif(report_payload->>'participant_count','')::integer,coalesce(array(select jsonb_array_elements_text(report_payload->'participant_roles')),'{}'),coalesce(array(select jsonb_array_elements_text(report_payload->'topics_covered')),'{}'),nullif(report_payload->>'knowledge_before','')::numeric,nullif(report_payload->>'knowledge_after','')::numeric,nullif(report_payload->>'quiz_score','')::numeric,nullif(report_payload->>'satisfaction_score','')::numeric,coalesce(array(select jsonb_array_elements_text(report_payload->'materials_provided')),'{}'),report_payload->>'objections_identified',nullif(report_payload->>'follow_up_training_required','')::boolean,report_payload->>'contact_met',report_payload->>'contact_role',report_payload->>'meeting_outcome',nullif(report_payload->>'offer_presented','')::boolean,nullif(report_payload->>'order_expected','')::boolean,nullif(report_payload->>'estimated_order_amount_ht','')::numeric,report_payload->>'commitments',report_payload->>'next_step',nullif(report_payload->>'next_step_at','')::timestamptz)
  on conflict (mission_id) do update set report_status=excluded.report_status,visibility=excluded.visibility,summary=excluded.summary,pharmacy_feedback=excluded.pharmacy_feedback,team_feedback=excluded.team_feedback,objections=excluded.objections,opportunities=excluded.opportunities,recommended_next_action=excluded.recommended_next_action,recommended_next_action_at=excluded.recommended_next_action_at,follow_up_required=excluded.follow_up_required,follow_up_owner_id=excluded.follow_up_owner_id,data_quality_status=excluded.data_quality_status,stock_before=excluded.stock_before,stock_after=excluded.stock_after,units_sold=excluded.units_sold,gross_sales_ttc=excluded.gross_sales_ttc,net_sales_ttc=excluded.net_sales_ttc,customer_contacts=excluded.customer_contacts,qualified_contacts=excluded.qualified_contacts,samples_distributed=excluded.samples_distributed,coupons_distributed=excluded.coupons_distributed,duration_minutes=excluded.duration_minutes,team_members_present=excluded.team_members_present,reorder_recommended=excluded.reorder_recommended,reorder_quantity_recommended=excluded.reorder_quantity_recommended,participant_count=excluded.participant_count,participant_roles=excluded.participant_roles,topics_covered=excluded.topics_covered,knowledge_before=excluded.knowledge_before,knowledge_after=excluded.knowledge_after,quiz_score=excluded.quiz_score,satisfaction_score=excluded.satisfaction_score,materials_provided=excluded.materials_provided,objections_identified=excluded.objections_identified,follow_up_training_required=excluded.follow_up_training_required,contact_met=excluded.contact_met,contact_role=excluded.contact_role,meeting_outcome=excluded.meeting_outcome,offer_presented=excluded.offer_presented,order_expected=excluded.order_expected,estimated_order_amount_ht=excluded.estimated_order_amount_ht,commitments=excluded.commitments,next_step=excluded.next_step,next_step_at=excluded.next_step_at returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.review_mission_report(target_report_id uuid, target_status public.mission_report_status, reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare target public.mission_reports%rowtype;
begin
  select * into target from public.mission_reports where id=target_report_id for update;
  if target.id is null or not private.user_is_tr1_for_brand(target.brand_id) then raise exception 'Report unavailable' using errcode='42501'; end if;
  if target_status not in ('validated','needs_correction','rejected') then raise exception 'Invalid review status' using errcode='23514'; end if;
  if target_status in ('needs_correction','rejected') and nullif(btrim(reason),'') is null then raise exception 'Review reason is required' using errcode='23514'; end if;
  update public.mission_reports set report_status=target_status,rejection_reason=reason,validated_by=case when target_status='validated' then (select auth.uid()) else null end,validated_at=case when target_status='validated' then now() else null end where id=target_report_id;
  if target_status='validated' then
    update public.missions set status='completed',actual_end_at=coalesce(actual_end_at,now()),completed_at=now() where id=target.mission_id;
    insert into public.interactions(brand_id,brand_pharmacy_id,created_by,subject,notes,interaction_type,outcome,occurred_at,visibility)
    select m.brand_id,m.brand_pharmacy_id,(select auth.uid()),'Mission terrain validée',target.summary,'visit','completed',coalesce(m.actual_end_at,now()),'shared' from public.missions m where m.id=target.mission_id;
  else
    update public.missions set status='report_pending' where id=target.mission_id;
  end if;
end;
$$;

create or replace function public.process_overdue_mission_reports()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.missions set status='report_pending',report_due_at=coalesce(report_due_at,scheduled_end_at + make_interval(hours => settings.report_due_delay_hours))
  from public.brand_settings settings where settings.brand_id=missions.brand_id and missions.status in ('scheduled','in_progress') and missions.scheduled_end_at < now() and not exists (select 1 from public.mission_reports r where r.mission_id=missions.id and r.report_status in ('submitted','validated'));
  get diagnostics affected=row_count; return affected;
end;
$$;

create or replace view public.mission_performance with (security_invoker=true) as
select m.id mission_id,m.brand_id,m.brand_pharmacy_id,m.assigned_user_id,m.mission_type,coalesce(m.actual_start_at,m.scheduled_start_at) mission_date,m.cost_actual_ht,
  coalesce(r.units_sold,0) units_sold_immediate,coalesce(r.net_sales_ttc,r.gross_sales_ttc) reported_sell_out_ttc,
  coalesce(r.units_sold,0)::numeric/nullif(r.duration_minutes/60.0,0) units_per_hour,
  m.cost_actual_ht/nullif(r.units_sold,0) cost_per_unit,m.cost_actual_ht/nullif(r.customer_contacts,0) cost_per_contact,
  sum(o.net_amount_ht) filter(where o.order_date <= coalesce(m.actual_end_at,m.scheduled_end_at)+interval '7 days' and o.order_date > coalesce(m.actual_end_at,m.scheduled_end_at)) order_revenue_7d_ht,
  sum(o.net_amount_ht) filter(where o.order_date <= coalesce(m.actual_end_at,m.scheduled_end_at)+interval '30 days' and o.order_date > coalesce(m.actual_end_at,m.scheduled_end_at)) order_revenue_30d_ht,
  sum(o.net_amount_ht) filter(where o.order_date <= coalesce(m.actual_end_at,m.scheduled_end_at)+interval '60 days' and o.order_date > coalesce(m.actual_end_at,m.scheduled_end_at)) order_revenue_60d_ht,
  sum(o.net_amount_ht) filter(where o.order_date <= coalesce(m.actual_end_at,m.scheduled_end_at)+interval '90 days' and o.order_date > coalesce(m.actual_end_at,m.scheduled_end_at)) order_revenue_90d_ht,
  (select s.distribution_rate from public.brand_pharmacy_distribution_snapshots s where s.brand_pharmacy_id=m.brand_pharmacy_id and s.snapshot_date <= coalesce(m.actual_start_at,m.scheduled_start_at)::date order by s.snapshot_date desc limit 1) dn_before,
  (select s.distribution_rate from public.brand_pharmacy_distribution_snapshots s where s.brand_pharmacy_id=m.brand_pharmacy_id and s.snapshot_date <= (coalesce(m.actual_end_at,m.scheduled_end_at)+interval '30 days')::date order by s.snapshot_date desc limit 1) dn_after_30d,
  (select h.previous_activity_status from public.brand_pharmacy_activity_history h where h.brand_pharmacy_id=m.brand_pharmacy_id and h.calculated_at <= coalesce(m.actual_start_at,m.scheduled_start_at) order by h.calculated_at desc limit 1) activity_status_before,
  (select h.new_activity_status from public.brand_pharmacy_activity_history h where h.brand_pharmacy_id=m.brand_pharmacy_id and h.calculated_at <= coalesce(m.actual_end_at,m.scheduled_end_at)+interval '30 days' order by h.calculated_at desc limit 1) activity_status_after_30d,
  min(o.order_date) filter(where o.order_date > coalesce(m.actual_end_at,m.scheduled_end_at)) first_order_after_mission_at,
  extract(day from min(o.order_date) filter(where o.order_date > coalesce(m.actual_end_at,m.scheduled_end_at))-coalesce(m.actual_end_at,m.scheduled_end_at))::integer days_to_first_order,
  case when settings.gross_margin_rate is not null and m.cost_actual_ht>0 then round(((coalesce(sum(o.net_amount_ht) filter(where o.order_date <= coalesce(m.actual_end_at,m.scheduled_end_at)+interval '30 days' and o.order_date > coalesce(m.actual_end_at,m.scheduled_end_at)),0)*settings.gross_margin_rate/100-m.cost_actual_ht)/m.cost_actual_ht)*100,2) end roi_30d,
  case when settings.gross_margin_rate is not null and m.cost_actual_ht>0 then round(((coalesce(sum(o.net_amount_ht) filter(where o.order_date <= coalesce(m.actual_end_at,m.scheduled_end_at)+interval '90 days' and o.order_date > coalesce(m.actual_end_at,m.scheduled_end_at)),0)*settings.gross_margin_rate/100-m.cost_actual_ht)/m.cost_actual_ht)*100,2) end roi_90d
from public.missions m left join public.mission_reports r on r.mission_id=m.id and r.report_status in ('submitted','validated')
left join public.orders o on o.brand_pharmacy_id=m.brand_pharmacy_id and o.order_status in ('confirmed','invoiced','partially_delivered','delivered') and o.archived_at is null
join public.brand_settings settings on settings.brand_id=m.brand_id where m.archived_at is null
group by m.id,r.id,settings.gross_margin_rate;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mission-evidence','mission-evidence',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.can_access_mission_object(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' and exists (
    select 1 from public.mission_attachments attachment
    join public.missions mission on mission.id=attachment.mission_id and mission.brand_id=attachment.brand_id
    where attachment.object_path=object_name and attachment.archived_at is null and (
      private.user_is_tr1_for_brand(attachment.brand_id)
      or attachment.uploaded_by=(select auth.uid())
      or (mission.assigned_user_id=(select auth.uid()) and private.user_has_active_brand_membership((select auth.uid()),mission.brand_id))
      or (attachment.visibility='shared' and private.has_brand_role(attachment.brand_id,array['brand_admin','brand_user']))
    )
  );
$$;

create or replace function private.can_write_mission_object(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' and exists (
    select 1 from public.missions mission
    where mission.brand_id=split_part(object_name,'/',1)::uuid and mission.id=split_part(object_name,'/',2)::uuid and (
      private.user_is_tr1_for_brand(mission.brand_id)
      or (mission.assigned_user_id=(select auth.uid()) and private.user_has_active_brand_membership((select auth.uid()),mission.brand_id))
    )
  );
$$;

create or replace function public.archive_mission_attachment(target_attachment_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare target public.mission_attachments%rowtype;
begin
  select * into target from public.mission_attachments where id=target_attachment_id for update;
  if target.id is null or not (target.uploaded_by=(select auth.uid()) or private.user_is_tr1_for_brand(target.brand_id)) then
    raise exception 'Attachment unavailable' using errcode='42501';
  end if;
  update public.mission_attachments set archived_at=now() where id=target.id;
end;
$$;

alter table public.field_providers enable row level security;
alter table public.mission_status_history enable row level security;
alter table public.mission_products enable row level security;
alter table public.mission_product_results enable row level security;
alter table public.mission_attachments enable row level security;

create policy missions_select on public.missions for select to authenticated using (private.user_is_tr1_for_brand(brand_id) or private.can_access_mission(id));
create policy missions_insert on public.missions for insert to authenticated with check (private.user_is_tr1_for_brand(brand_id));
create policy missions_update on public.missions for update to authenticated using (private.user_is_tr1_for_brand(brand_id)) with check (private.user_is_tr1_for_brand(brand_id));
create policy field_providers_select on public.field_providers for select to authenticated using (private.has_global_role(array['super_admin']) or exists(select 1 from unnest(brands_authorized) brand_id where private.user_is_tr1_for_brand(brand_id)) or user_id=(select auth.uid()));
create policy field_providers_insert on public.field_providers for insert to authenticated with check (private.has_global_role(array['super_admin']) or exists(select 1 from unnest(brands_authorized) brand_id where private.user_is_tr1_for_brand(brand_id)));
create policy field_providers_update on public.field_providers for update to authenticated using (private.has_global_role(array['super_admin']) or exists(select 1 from unnest(brands_authorized) brand_id where private.user_is_tr1_for_brand(brand_id))) with check (private.has_global_role(array['super_admin']) or exists(select 1 from unnest(brands_authorized) brand_id where private.user_is_tr1_for_brand(brand_id)));
create policy mission_history_select on public.mission_status_history for select to authenticated using (private.can_access_mission(mission_id));
create policy mission_products_select on public.mission_products for select to authenticated using (private.can_access_mission(mission_id));
create policy mission_products_insert on public.mission_products for insert to authenticated with check (private.user_is_tr1_for_brand(brand_id));
create policy mission_products_update on public.mission_products for update to authenticated using (private.user_is_tr1_for_brand(brand_id)) with check (private.user_is_tr1_for_brand(brand_id));
create policy mission_reports_select on public.mission_reports for select to authenticated using (private.can_access_mission(mission_id) and (visibility='shared' or private.user_is_tr1_for_brand(brand_id) or submitted_by=(select auth.uid())));
create policy mission_reports_insert on public.mission_reports for insert to authenticated with check (submitted_by=(select auth.uid()) and private.can_access_mission(mission_id));
create policy mission_reports_update on public.mission_reports for update to authenticated using (private.user_is_tr1_for_brand(brand_id) or (submitted_by=(select auth.uid()) and report_status in ('draft','needs_correction'))) with check (private.can_access_mission(mission_id));
create policy mission_product_results_select on public.mission_product_results for select to authenticated using (exists(select 1 from public.mission_reports r where r.id=mission_report_id and private.can_access_mission(r.mission_id)));
create policy mission_product_results_insert on public.mission_product_results for insert to authenticated with check (exists(select 1 from public.mission_reports r join public.mission_products mp on mp.mission_id=r.mission_id where r.id=mission_report_id and mp.id=mission_product_id and mp.product_id=mission_product_results.product_id and (r.submitted_by=(select auth.uid()) or private.user_is_tr1_for_brand(r.brand_id))));
create policy mission_product_results_update on public.mission_product_results for update to authenticated using (exists(select 1 from public.mission_reports r where r.id=mission_report_id and (r.submitted_by=(select auth.uid()) or private.user_is_tr1_for_brand(r.brand_id)))) with check (exists(select 1 from public.mission_reports r join public.mission_products mp on mp.mission_id=r.mission_id where r.id=mission_report_id and mp.id=mission_product_id and mp.product_id=mission_product_results.product_id));
create policy mission_attachments_select on public.mission_attachments for select to authenticated using (private.can_access_mission(mission_id) and (visibility='shared' or private.user_is_tr1_for_brand(brand_id) or uploaded_by=(select auth.uid())));
create policy mission_attachments_insert on public.mission_attachments for insert to authenticated with check (uploaded_by=(select auth.uid()) and private.can_access_mission(mission_id));
create policy mission_attachments_update on public.mission_attachments for update to authenticated using (uploaded_by=(select auth.uid()) or private.user_is_tr1_for_brand(brand_id)) with check (private.can_access_mission(mission_id));
create policy mission_storage_select on storage.objects for select to authenticated using (bucket_id='mission-evidence' and private.can_access_mission_object(name));
create policy mission_storage_insert on storage.objects for insert to authenticated with check (bucket_id='mission-evidence' and owner_id=(select auth.uid())::text and private.can_write_mission_object(name));
create policy mission_storage_delete on storage.objects for delete to authenticated using (bucket_id='mission-evidence' and private.can_access_mission_object(name) and (owner_id=(select auth.uid())::text or private.user_is_tr1_for_brand(split_part(name,'/',1)::uuid)));

revoke all on public.field_providers,public.mission_status_history,public.mission_products,public.mission_product_results,public.mission_attachments from anon;
grant select,insert,update on public.field_providers,public.mission_products,public.mission_reports,public.mission_product_results,public.mission_attachments to authenticated;
grant select on public.mission_status_history,public.mission_performance to authenticated,service_role;
grant all on public.field_providers,public.mission_status_history,public.mission_products,public.mission_product_results,public.mission_attachments to service_role;
grant usage,select on sequence public.mission_status_history_id_seq to authenticated,service_role;
revoke all on function private.user_is_tr1_for_brand(uuid),private.validate_mission(),private.record_mission_status(),private.validate_mission_report(),private.can_access_mission_object(text),private.can_write_mission_object(text) from public,anon,authenticated;
grant execute on function private.user_is_tr1_for_brand(uuid),private.can_access_mission(uuid),private.can_access_mission_object(text),private.can_write_mission_object(text) to authenticated;
revoke all on function public.create_mission(uuid,jsonb,jsonb),public.change_mission_status(uuid,public.mission_status,text),public.save_mission_report(uuid,jsonb),public.review_mission_report(uuid,public.mission_report_status,text),public.process_overdue_mission_reports(),public.archive_mission_attachment(uuid) from public,anon;
grant execute on function public.create_mission(uuid,jsonb,jsonb),public.change_mission_status(uuid,public.mission_status,text),public.save_mission_report(uuid,jsonb),public.review_mission_report(uuid,public.mission_report_status,text),public.archive_mission_attachment(uuid) to authenticated,service_role;
grant execute on function public.process_overdue_mission_reports() to service_role;

comment on view public.mission_performance is 'Corrélations post-mission observées, sans attribution causale.';
comment on column public.missions.cost_actual_ht is 'Somme serveur des coûts intervenant, déplacement, repas et frais additionnels.';
