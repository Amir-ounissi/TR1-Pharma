create or replace function private.mission_execution_role_allowed(
  target_brand_id uuid,
  target_user_id uuid,
  target_mission_type public.mission_type
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = target_user_id
      and m.brand_id = target_brand_id
      and m.status = 'active'
      and (
        (target_mission_type in ('commercial_visit','prospecting_visit','reactivation','relationship_visit') and r.key = 'agent')
        or (target_mission_type in ('animation','training','merchandising','pharmacy_audit','product_launch','stock_check','other') and r.key in ('agent','facilitator'))
      )
  );
$$;

create or replace function private.validate_mission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_record public.brand_pharmacies%rowtype;
  provider_record public.field_providers%rowtype;
  has_final_report boolean;
begin
  select * into relation_record
  from public.brand_pharmacies
  where id = new.brand_pharmacy_id and archived_at is null;

  if relation_record.id is null
     or relation_record.brand_id <> new.brand_id
     or relation_record.pharmacy_id <> new.pharmacy_id
  then
    raise exception 'Mission brand pharmacy mismatch' using errcode='23514';
  end if;

  if new.assigned_user_id is not null then
    if not private.user_has_active_brand_membership(new.assigned_user_id, new.brand_id) then
      raise exception 'Assigned user is not active for this brand' using errcode='23514';
    end if;
    if not private.mission_execution_role_allowed(new.brand_id, new.assigned_user_id, new.mission_type) then
      raise exception 'Assigned user role is incompatible with this mission' using errcode='23514';
    end if;
  end if;

  if new.assigned_external_provider_id is not null then
    select * into provider_record
    from public.field_providers
    where id = new.assigned_external_provider_id
      and archived_at is null
      and status = 'active';
    if provider_record.id is null or not (new.brand_id = any(provider_record.brands_authorized)) then
      raise exception 'Provider is not authorized for this brand' using errcode='23514';
    end if;
  end if;

  if new.status in ('assigned','accepted','scheduled','in_progress','report_pending','completed')
     and new.assigned_user_id is null
     and new.assigned_external_provider_id is null
  then
    raise exception 'Mission status requires an assigned provider' using errcode='23514';
  end if;

  if new.status in ('scheduled','in_progress','report_pending','completed')
     and new.scheduled_start_at is null
  then
    raise exception 'Scheduled mission requires a start date' using errcode='23514';
  end if;

  if new.status in ('in_progress','report_pending','completed') and new.actual_start_at is null then
    raise exception 'Mission execution must be started first' using errcode='23514';
  end if;

  if new.status = 'completed' then
    select exists (
      select 1
      from public.mission_reports report
      where report.mission_id = new.id
        and report.archived_at is null
        and report.report_status in ('validated','rejected')
    ) into has_final_report;
    if not has_final_report then
      raise exception 'Mission completion requires a final reviewed report' using errcode='23514';
    end if;
  end if;

  if new.assigned_user_id is not null
     and new.scheduled_start_at is not null
     and new.scheduled_end_at is not null
     and exists (
       select 1
       from public.missions concurrent
       where concurrent.id <> new.id
         and concurrent.assigned_user_id = new.assigned_user_id
         and concurrent.archived_at is null
         and concurrent.status not in ('cancelled','rejected','no_show','completed')
         and concurrent.scheduled_start_at is not null
         and concurrent.scheduled_end_at is not null
         and tstzrange(concurrent.scheduled_start_at, concurrent.scheduled_end_at, '[)')
           && tstzrange(new.scheduled_start_at, new.scheduled_end_at, '[)')
     )
  then
    raise exception 'Provider schedule overlap' using errcode='23P01';
  end if;

  new.cost_actual_ht := round(
    coalesce(new.provider_cost_ht,0)
    + coalesce(new.travel_cost_ht,0)
    + coalesce(new.meal_cost_ht,0)
    + coalesce(new.additional_cost_ht,0),
    2
  );

  if new.status = 'completed' and new.completed_at is null then new.completed_at := now(); end if;
  if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;

  return new;
end;
$$;

drop policy if exists missions_insert on public.missions;
create policy missions_insert on public.missions
for insert
with check (
  private.user_is_tr1_for_brand(brand_id)
  or (
    private.has_brand_role(brand_id, array['brand_admin'])
    and status = 'requested'
    and assigned_user_id is null
    and assigned_external_provider_id is null
  )
);

drop policy if exists mission_products_insert on public.mission_products;
create policy mission_products_insert on public.mission_products
for insert
with check (
  private.user_is_tr1_for_brand(brand_id)
  or (
    private.has_brand_role(brand_id, array['brand_admin'])
    and exists (
      select 1
      from public.missions mission
      where mission.id = mission_id
        and mission.brand_id = brand_id
        and mission.status = 'requested'
        and mission.requested_by = (select auth.uid())
    )
  )
);

create or replace function public.create_mission(
  target_brand_pharmacy_id uuid,
  mission_payload jsonb,
  product_payload jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  relation_record public.brand_pharmacies%rowtype;
  mission_id uuid;
  product_record jsonb;
  actor uuid := (select auth.uid());
begin
  select * into relation_record
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id and archived_at is null;

  if relation_record.id is null
     or not (
       private.user_is_tr1_for_brand(relation_record.brand_id)
       or private.has_brand_role(relation_record.brand_id, array['brand_admin'])
     )
  then
    raise exception 'Brand pharmacy unavailable' using errcode='42501';
  end if;

  insert into public.missions(
    organization_id,brand_id,brand_pharmacy_id,pharmacy_id,mission_type,status,title,objective,briefing,
    internal_notes,requested_by,managed_by,assigned_user_id,assigned_external_provider_id,scheduled_start_at,
    scheduled_end_at,estimated_duration_minutes,priority,location_mode,budget_estimated_ht,cost_estimated_ht,
    provider_cost_ht,travel_cost_ht,meal_cost_ht,additional_cost_ht,report_due_at,source,created_by
  )
  select
    b.organization_id,relation_record.brand_id,relation_record.id,relation_record.pharmacy_id,
    (mission_payload->>'mission_type')::public.mission_type,'requested'::public.mission_status,
    mission_payload->>'title',mission_payload->>'objective',mission_payload->>'briefing',mission_payload->>'internal_notes',
    actor,actor,null,null,
    nullif(mission_payload->>'scheduled_start_at','')::timestamptz,
    nullif(mission_payload->>'scheduled_end_at','')::timestamptz,
    nullif(mission_payload->>'estimated_duration_minutes','')::integer,
    coalesce((mission_payload->>'priority')::public.mission_priority,'normal'),
    coalesce((mission_payload->>'location_mode')::public.mission_location_mode,'in_pharmacy'),
    nullif(mission_payload->>'budget_estimated_ht','')::numeric,
    nullif(mission_payload->>'cost_estimated_ht','')::numeric,
    coalesce(nullif(mission_payload->>'provider_cost_ht','')::numeric,0),
    coalesce(nullif(mission_payload->>'travel_cost_ht','')::numeric,0),
    coalesce(nullif(mission_payload->>'meal_cost_ht','')::numeric,0),
    coalesce(nullif(mission_payload->>'additional_cost_ht','')::numeric,0),
    nullif(mission_payload->>'report_due_at','')::timestamptz,
    'manual',actor
  from public.brands b
  where b.id = relation_record.brand_id
  returning id into mission_id;

  for product_record in select value from jsonb_array_elements(product_payload) loop
    insert into public.mission_products(
      mission_id,brand_id,product_id,objective_type,target_quantity,priority,briefing_notes
    ) values (
      mission_id,relation_record.brand_id,(product_record->>'product_id')::uuid,
      coalesce((product_record->>'objective_type')::public.mission_objective_type,'other'),
      nullif(product_record->>'target_quantity','')::integer,
      coalesce((product_record->>'priority')::public.mission_priority,'normal'),
      product_record->>'briefing_notes'
    );
  end loop;

  return mission_id;
end;
$$;

create or replace function public.assign_mission(
  target_mission_id uuid,
  target_user_id uuid,
  target_scheduled_start_at timestamptz default null,
  target_scheduled_end_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.missions%rowtype;
begin
  select * into target from public.missions where id = target_mission_id for update;

  if target.id is null or not private.user_is_tr1_for_brand(target.brand_id) then
    raise exception 'Mission unavailable' using errcode='42501';
  end if;

  if target.status <> 'to_assign' then
    raise exception 'Mission must be ready for assignment' using errcode='23514';
  end if;

  if not private.mission_execution_role_allowed(target.brand_id, target_user_id, target.mission_type) then
    raise exception 'Assigned user role is incompatible with this mission' using errcode='23514';
  end if;

  update public.missions
  set assigned_user_id = target_user_id,
      assigned_external_provider_id = null,
      scheduled_start_at = coalesce(target_scheduled_start_at, scheduled_start_at),
      scheduled_end_at = coalesce(target_scheduled_end_at, scheduled_end_at),
      managed_by = (select auth.uid()),
      status = 'assigned'
  where id = target_mission_id;
end;
$$;

revoke all on function public.assign_mission(uuid,uuid,timestamptz,timestamptz) from public;
grant execute on function public.assign_mission(uuid,uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.change_mission_status(
  target_mission_id uuid,
  target_status public.mission_status,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.missions%rowtype;
  actor uuid := (select auth.uid());
  is_tr1 boolean;
  is_brand_admin boolean;
  is_assigned boolean;
  allowed boolean := false;
  clean_reason text := nullif(btrim(reason), '');
begin
  select * into target from public.missions where id = target_mission_id for update;

  if target.id is null or not private.can_access_mission(target.id) then
    raise exception 'Mission unavailable' using errcode='42501';
  end if;

  is_tr1 := private.user_is_tr1_for_brand(target.brand_id);
  is_brand_admin := private.has_brand_role(target.brand_id, array['brand_admin']);
  is_assigned := target.assigned_user_id = actor;

  if target_status = 'cancelled' then
    allowed := is_tr1 or (is_brand_admin and target.status in ('requested','to_assign'));
  elsif target.status = 'draft' and target_status = 'requested' then
    allowed := is_tr1 or is_brand_admin;
  elsif target.status = 'requested' and target_status = 'to_assign' then
    allowed := is_tr1;
  elsif target.status = 'assigned' and target_status in ('accepted','rejected') then
    allowed := is_assigned;
  elsif target.status = 'accepted' and target_status = 'scheduled' then
    allowed := is_tr1;
  elsif target.status = 'scheduled' and target_status in ('in_progress','no_show') then
    allowed := is_assigned;
  end if;

  if not allowed then
    raise exception 'Invalid mission status transition for this actor' using errcode='42501';
  end if;

  if target_status in ('cancelled','rejected','no_show') and clean_reason is null then
    raise exception 'A reason is required' using errcode='23514';
  end if;

  if target_status = 'scheduled' and target.scheduled_start_at is null then
    raise exception 'A start date is required before scheduling' using errcode='23514';
  end if;

  update public.missions
  set status = target_status,
      managed_by = case when is_tr1 then actor else managed_by end,
      cancellation_reason = case when target_status='cancelled' then clean_reason else cancellation_reason end,
      rejection_reason = case when target_status='rejected' then clean_reason else rejection_reason end,
      no_show_reason = case when target_status='no_show' then clean_reason else no_show_reason end,
      actual_start_at = case when target_status='in_progress' then coalesce(actual_start_at,now()) else actual_start_at end,
      actual_end_at = case when target_status='no_show' then coalesce(actual_end_at,now()) else actual_end_at end
  where id = target_mission_id;

  update public.mission_status_history history
  set reason = coalesce(history.reason, clean_reason),
      source = (case when is_assigned then 'provider' else 'manual' end)::public.mission_history_source
  where history.id = (
    select max(id) from public.mission_status_history where mission_id = target_mission_id
  );
end;
$$;

create or replace function private.enforce_mission_report_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_mission public.missions%rowtype;
  actor uuid := (select auth.uid());
  is_tr1 boolean;
begin
  select * into target_mission from public.missions where id = new.mission_id;

  if target_mission.id is null then
    raise exception 'Mission unavailable' using errcode='42501';
  end if;

  is_tr1 := private.user_is_tr1_for_brand(target_mission.brand_id);

  if not is_tr1 and target_mission.assigned_user_id is distinct from actor then
    raise exception 'Only the assigned provider can report' using errcode='42501';
  end if;

  if not is_tr1 and target_mission.status not in ('in_progress','report_pending') then
    raise exception 'Mission must be in progress before reporting' using errcode='23514';
  end if;

  if not is_tr1 and new.report_status in ('validated','rejected') then
    raise exception 'Only TR1 can finalize a report' using errcode='42501';
  end if;

  if new.report_status = 'submitted' and target_mission.status not in ('in_progress','report_pending') then
    raise exception 'Mission must be in progress before report submission' using errcode='23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_mission_report_lifecycle on public.mission_reports;
create trigger enforce_mission_report_lifecycle
before insert or update on public.mission_reports
for each row execute function private.enforce_mission_report_lifecycle();

create or replace function private.sync_mission_report_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.report_status = 'submitted' and (tg_op = 'INSERT' or old.report_status is distinct from new.report_status) then
    update public.missions
    set status = 'report_pending',
        actual_end_at = coalesce(actual_end_at, now())
    where id = new.mission_id
      and status in ('in_progress','report_pending');
  end if;
  return new;
end;
$$;

drop trigger if exists sync_mission_report_submission on public.mission_reports;
create trigger sync_mission_report_submission
after insert or update of report_status on public.mission_reports
for each row execute function private.sync_mission_report_submission();

drop policy if exists mission_reports_insert on public.mission_reports;
create policy mission_reports_insert on public.mission_reports
for insert
with check (
  submitted_by = (select auth.uid())
  and (
    private.user_is_tr1_for_brand(brand_id)
    or exists (
      select 1
      from public.missions mission
      where mission.id = mission_id
        and mission.assigned_user_id = (select auth.uid())
        and mission.archived_at is null
    )
  )
);

drop policy if exists mission_reports_update on public.mission_reports;
create policy mission_reports_update on public.mission_reports
for update
using (
  private.user_is_tr1_for_brand(brand_id)
  or (submitted_by = (select auth.uid()) and report_status in ('draft','needs_correction'))
)
with check (
  private.user_is_tr1_for_brand(brand_id)
  or exists (
    select 1
    from public.missions mission
    where mission.id = mission_id
      and mission.assigned_user_id = (select auth.uid())
      and mission.archived_at is null
  )
);

create or replace function public.review_mission_report(
  target_report_id uuid,
  target_status public.mission_report_status,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.mission_reports%rowtype;
  mission_record public.missions%rowtype;
  clean_reason text := nullif(btrim(reason),'');
begin
  select * into target from public.mission_reports where id = target_report_id for update;

  if target.id is null or not private.user_is_tr1_for_brand(target.brand_id) then
    raise exception 'Report unavailable' using errcode='42501';
  end if;

  if target.report_status <> 'submitted' then
    raise exception 'Only submitted reports can be reviewed' using errcode='23514';
  end if;

  if target_status not in ('validated','needs_correction','rejected') then
    raise exception 'Invalid review status' using errcode='23514';
  end if;

  if target_status in ('needs_correction','rejected') and clean_reason is null then
    raise exception 'Review reason is required' using errcode='23514';
  end if;

  select * into mission_record from public.missions where id = target.mission_id for update;

  if mission_record.id is null or mission_record.status <> 'report_pending' then
    raise exception 'Mission is not awaiting report review' using errcode='23514';
  end if;

  update public.mission_reports
  set report_status = target_status,
      rejection_reason = clean_reason,
      validated_by = case when target_status='validated' then (select auth.uid()) else null end,
      validated_at = case when target_status='validated' then now() else null end
  where id = target_report_id;

  if target_status in ('validated','rejected') then
    update public.missions
    set status='completed',
        actual_end_at=coalesce(actual_end_at,now()),
        completed_at=now()
    where id=target.mission_id;

    if target_status = 'validated' then
      insert into public.interactions(
        brand_id,brand_pharmacy_id,created_by,subject,notes,interaction_type,outcome,occurred_at,visibility
      )
      select m.brand_id,m.brand_pharmacy_id,(select auth.uid()),'Mission terrain validée',target.summary,
             'visit','completed',coalesce(m.actual_end_at,now()),'shared'
      from public.missions m
      where m.id=target.mission_id;
    end if;
  else
    update public.missions set status='report_pending' where id=target.mission_id;
  end if;
end;
$$;;
