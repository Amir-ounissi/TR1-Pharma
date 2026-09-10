-- Monthly animation request model.
-- A request is an undated parent animation mission. After facilitator acceptance,
-- each concrete date creates a child animation mission linked to the request.

alter table public.missions
  add column if not exists animation_parent_request_id uuid references public.missions(id) on delete set null,
  add column if not exists animation_days_per_month integer,
  add column if not exists animation_start_month date,
  add column if not exists animation_end_month date,
  add column if not exists animation_remuneration_model text,
  add column if not exists animation_remuneration_config jsonb not null default '{}'::jsonb;

alter table public.missions
  drop constraint if exists missions_animation_days_per_month_check;
alter table public.missions
  add constraint missions_animation_days_per_month_check
  check (animation_days_per_month is null or animation_days_per_month between 1 and 31);

alter table public.missions
  drop constraint if exists missions_animation_months_check;
alter table public.missions
  add constraint missions_animation_months_check
  check (
    animation_start_month is null
    or (
      animation_start_month = date_trunc('month', animation_start_month)::date
      and (animation_end_month is null or (
        animation_end_month = date_trunc('month', animation_end_month)::date
        and animation_end_month >= animation_start_month
      ))
    )
  );

alter table public.missions
  drop constraint if exists missions_animation_remuneration_model_check;
alter table public.missions
  add constraint missions_animation_remuneration_model_check
  check (animation_remuneration_model is null or animation_remuneration_model in ('fixed','tiered'));

alter table public.missions
  drop constraint if exists missions_animation_remuneration_config_check;
alter table public.missions
  add constraint missions_animation_remuneration_config_check
  check (jsonb_typeof(animation_remuneration_config) = 'object');

create index if not exists missions_animation_parent_request_idx
  on public.missions(animation_parent_request_id)
  where animation_parent_request_id is not null;

comment on column public.missions.animation_parent_request_id is
  'Parent monthly animation request for a concrete dated animation day.';
comment on column public.missions.animation_days_per_month is
  'Number of animation days expected each month for an undated parent request.';
comment on column public.missions.animation_start_month is
  'First month covered by an animation request, stored on the first day of the month.';
comment on column public.missions.animation_remuneration_config is
  'Remuneration configuration. fixed: fixed_amount_ht; tiered: tiers[{min_sales,max_sales,amount_ht}].';

create or replace function public.request_animation(
  target_brand_pharmacy_id uuid,
  target_assigned_user_id uuid default null,
  mission_payload jsonb default '{}'::jsonb,
  product_payload jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_record public.brand_pharmacies%rowtype;
  mission_id uuid;
  product_record jsonb;
  actor uuid := (select auth.uid());
  requirements jsonb;
  target_status public.mission_status;
  days_per_month integer;
  start_month date;
  end_month date;
  remuneration_model text;
  remuneration_config jsonb;
  fixed_amount numeric := 0;
  travel_amount numeric := 0;
  estimated_monthly_cost numeric := 0;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into relation_record
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id
    and archived_at is null;

  if relation_record.id is null
     or not private.can_request_animation_for_pharmacy(target_brand_pharmacy_id, actor)
  then
    raise exception 'Animation pharmacy unavailable' using errcode='42501';
  end if;

  if coalesce(nullif(btrim(mission_payload->>'title'),''),'') = ''
     or coalesce(nullif(btrim(mission_payload->>'objective'),''),'') = ''
  then
    raise exception 'Animation title and objective are required' using errcode='23514';
  end if;

  days_per_month := nullif(mission_payload->>'days_per_month','')::integer;
  start_month := nullif(mission_payload->>'start_month','')::date;
  end_month := nullif(mission_payload->>'end_month','')::date;

  if days_per_month is null or days_per_month < 1 or days_per_month > 31 then
    raise exception 'Animation days per month must be between 1 and 31' using errcode='23514';
  end if;
  if start_month is null or start_month <> date_trunc('month', start_month)::date then
    raise exception 'Animation start month is required' using errcode='23514';
  end if;
  if end_month is not null and (end_month <> date_trunc('month', end_month)::date or end_month < start_month) then
    raise exception 'Animation end month is invalid' using errcode='23514';
  end if;

  remuneration_model := nullif(mission_payload->>'remuneration_model','');
  remuneration_config := coalesce(mission_payload->'remuneration_config','{}'::jsonb);
  if remuneration_model not in ('fixed','tiered') then
    raise exception 'Animation remuneration model is invalid' using errcode='23514';
  end if;
  if jsonb_typeof(remuneration_config) <> 'object' then
    raise exception 'Animation remuneration configuration is invalid' using errcode='23514';
  end if;

  if remuneration_model = 'fixed' then
    fixed_amount := coalesce(nullif(remuneration_config->>'fixed_amount_ht','')::numeric, -1);
    if fixed_amount < 0 then
      raise exception 'Fixed animation remuneration is invalid' using errcode='23514';
    end if;
  else
    if jsonb_typeof(remuneration_config->'tiers') <> 'array'
       or jsonb_array_length(remuneration_config->'tiers') = 0
    then
      raise exception 'Tiered animation remuneration requires at least one tier' using errcode='23514';
    end if;
  end if;

  if target_assigned_user_id is not null then
    if not private.mission_execution_role_allowed(relation_record.brand_id, target_assigned_user_id, 'animation'::public.mission_type)
       or not exists (
         select 1
         from public.memberships membership
         join public.roles role on role.id = membership.role_id
         where membership.user_id = target_assigned_user_id
           and membership.brand_id = relation_record.brand_id
           and membership.status = 'active'
           and role.key = 'facilitator'
       )
    then
      raise exception 'Selected facilitator is unavailable for this brand' using errcode='42501';
    end if;
    target_status := 'assigned'::public.mission_status;
  else
    target_status := 'requested'::public.mission_status;
  end if;

  requirements := coalesce(mission_payload->'execution_requirements','{}'::jsonb);
  requirements := jsonb_build_object(
    'report_required', true,
    'merch_plan_required', coalesce((requirements->>'merch_plan_required')::boolean, true),
    'merch_result_required', coalesce((requirements->>'merch_result_required')::boolean, true),
    'cash_register_required', coalesce((requirements->>'cash_register_required')::boolean, true),
    'before_after_required', coalesce((requirements->>'before_after_required')::boolean, false),
    'sales_by_product_required', coalesce((requirements->>'sales_by_product_required')::boolean, true)
  );

  travel_amount := coalesce(nullif(mission_payload->>'travel_cost_ht','')::numeric,0);
  estimated_monthly_cost := (case when remuneration_model = 'fixed' then fixed_amount else 0 end) * days_per_month
    + travel_amount * days_per_month;

  insert into public.missions(
    organization_id,brand_id,brand_pharmacy_id,pharmacy_id,mission_type,status,title,objective,briefing,
    requested_by,managed_by,assigned_user_id,scheduled_start_at,scheduled_end_at,priority,location_mode,
    budget_estimated_ht,cost_estimated_ht,provider_cost_ht,travel_cost_ht,report_due_at,source,created_by,
    execution_requirements,animation_days_per_month,animation_start_month,animation_end_month,
    animation_remuneration_model,animation_remuneration_config
  )
  select
    b.organization_id,relation_record.brand_id,relation_record.id,relation_record.pharmacy_id,
    'animation'::public.mission_type,target_status,
    btrim(mission_payload->>'title'),btrim(mission_payload->>'objective'),nullif(btrim(mission_payload->>'briefing'),''),
    actor,actor,target_assigned_user_id,
    null,null,
    coalesce((mission_payload->>'priority')::public.mission_priority,'normal'::public.mission_priority),
    'in_pharmacy'::public.mission_location_mode,
    estimated_monthly_cost,estimated_monthly_cost,
    case when remuneration_model = 'fixed' then fixed_amount else 0 end,
    travel_amount,null,'manual',actor,requirements,
    days_per_month,start_month,end_month,remuneration_model,remuneration_config
  from public.brands b
  where b.id = relation_record.brand_id
  returning id into mission_id;

  for product_record in select value from jsonb_array_elements(coalesce(product_payload,'[]'::jsonb)) loop
    if not exists (
      select 1 from public.products p
      where p.id = (product_record->>'product_id')::uuid
        and p.brand_id = relation_record.brand_id
        and p.is_active
    ) then
      raise exception 'Animation product unavailable' using errcode='23514';
    end if;

    insert into public.mission_products(
      mission_id,brand_id,product_id,objective_type,target_quantity,priority,briefing_notes
    ) values (
      mission_id,relation_record.brand_id,(product_record->>'product_id')::uuid,
      'other'::public.mission_objective_type,
      nullif(product_record->>'target_quantity','')::integer,
      coalesce((product_record->>'priority')::public.mission_priority,'normal'::public.mission_priority),
      nullif(btrim(product_record->>'briefing_notes'),'')
    );
  end loop;

  return mission_id;
end;
$$;

revoke all on function public.request_animation(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.request_animation(uuid,uuid,jsonb,jsonb) to authenticated;

create or replace function public.schedule_animation_request_day(
  target_request_mission_id uuid,
  target_scheduled_start_at timestamptz,
  target_scheduled_end_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.missions%rowtype;
  child_id uuid;
  actor uuid := (select auth.uid());
  month_start date;
  month_end date;
  current_count integer;
  child_provider_cost numeric := 0;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into request_record
  from public.missions
  where id = target_request_mission_id
  for update;

  if request_record.id is null
     or request_record.mission_type <> 'animation'::public.mission_type
     or request_record.animation_parent_request_id is not null
     or request_record.animation_days_per_month is null
     or request_record.assigned_user_id is distinct from actor
     or not exists (
       select 1
       from public.memberships membership
       join public.roles role on role.id = membership.role_id
       where membership.user_id = actor
         and membership.brand_id = request_record.brand_id
         and membership.status = 'active'
         and role.key = 'facilitator'
     )
  then
    raise exception 'Animation request unavailable for self scheduling' using errcode='42501';
  end if;

  if request_record.status <> 'accepted'::public.mission_status then
    raise exception 'Animation request must be accepted before scheduling' using errcode='23514';
  end if;

  if target_scheduled_start_at is null
     or target_scheduled_end_at is null
     or target_scheduled_end_at <= target_scheduled_start_at
  then
    raise exception 'Animation schedule is invalid' using errcode='23514';
  end if;

  month_start := date_trunc('month', target_scheduled_start_at at time zone 'Europe/Paris')::date;
  month_end := (month_start + interval '1 month')::date;

  if month_start < request_record.animation_start_month
     or (request_record.animation_end_month is not null and month_start > request_record.animation_end_month)
  then
    raise exception 'Animation date is outside the request period' using errcode='23514';
  end if;

  select count(*)::integer into current_count
  from public.missions child
  where child.animation_parent_request_id = request_record.id
    and child.scheduled_start_at >= (month_start::timestamp at time zone 'Europe/Paris')
    and child.scheduled_start_at < (month_end::timestamp at time zone 'Europe/Paris')
    and child.status not in ('cancelled'::public.mission_status,'rejected'::public.mission_status,'no_show'::public.mission_status);

  if current_count >= request_record.animation_days_per_month then
    raise exception 'Monthly animation quota is already fully planned' using errcode='23514';
  end if;

  if exists (
    select 1
    from public.missions other
    where other.assigned_user_id = actor
      and other.id <> request_record.id
      and other.scheduled_start_at is not null
      and other.scheduled_end_at is not null
      and other.scheduled_start_at < target_scheduled_end_at
      and other.scheduled_end_at > target_scheduled_start_at
      and other.status not in ('cancelled'::public.mission_status,'rejected'::public.mission_status,'no_show'::public.mission_status)
  ) then
    raise exception 'Animation overlaps another mission' using errcode='23514';
  end if;

  if request_record.animation_remuneration_model = 'fixed' then
    child_provider_cost := coalesce(nullif(request_record.animation_remuneration_config->>'fixed_amount_ht','')::numeric,0);
  end if;

  insert into public.missions(
    organization_id,brand_id,brand_pharmacy_id,pharmacy_id,mission_type,status,title,objective,briefing,
    requested_by,managed_by,assigned_user_id,scheduled_start_at,scheduled_end_at,priority,location_mode,
    budget_estimated_ht,cost_estimated_ht,provider_cost_ht,travel_cost_ht,report_due_at,source,created_by,
    execution_requirements,animation_parent_request_id,animation_remuneration_model,animation_remuneration_config
  ) values (
    request_record.organization_id,request_record.brand_id,request_record.brand_pharmacy_id,request_record.pharmacy_id,
    'animation'::public.mission_type,'scheduled'::public.mission_status,request_record.title,request_record.objective,request_record.briefing,
    request_record.requested_by,request_record.managed_by,actor,target_scheduled_start_at,target_scheduled_end_at,
    request_record.priority,request_record.location_mode,
    child_provider_cost + coalesce(request_record.travel_cost_ht,0),
    child_provider_cost + coalesce(request_record.travel_cost_ht,0),
    child_provider_cost,coalesce(request_record.travel_cost_ht,0),null,'manual',actor,
    request_record.execution_requirements,request_record.id,request_record.animation_remuneration_model,request_record.animation_remuneration_config
  ) returning id into child_id;

  insert into public.mission_products(
    mission_id,brand_id,product_id,objective_type,target_quantity,priority,briefing_notes
  )
  select child_id,brand_id,product_id,objective_type,target_quantity,priority,briefing_notes
  from public.mission_products
  where mission_id = request_record.id;

  update public.mission_status_history history
  set source = 'provider'::public.mission_history_source
  where history.id = (
    select max(id)
    from public.mission_status_history
    where mission_id = child_id
  );

  return child_id;
end;
$$;

revoke all on function public.schedule_animation_request_day(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.schedule_animation_request_day(uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.get_animation_request_monthly_progress(
  target_request_mission_id uuid,
  target_from_month date,
  target_to_month date
)
returns table(
  month_start date,
  expected_days integer,
  planned_days bigint,
  realized_days bigint,
  remaining_to_plan integer,
  planning_status text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  request_record public.missions%rowtype;
  from_month date;
  to_month date;
begin
  select * into request_record
  from public.missions
  where id = target_request_mission_id;

  if request_record.id is null
     or request_record.mission_type <> 'animation'::public.mission_type
     or request_record.animation_days_per_month is null
     or request_record.animation_parent_request_id is not null
  then
    return;
  end if;

  from_month := greatest(
    request_record.animation_start_month,
    date_trunc('month', coalesce(target_from_month, current_date))::date
  );
  to_month := date_trunc('month', coalesce(target_to_month, from_month))::date;
  if request_record.animation_end_month is not null then
    to_month := least(to_month, request_record.animation_end_month);
  end if;
  if to_month < from_month then return; end if;

  return query
  with months as (
    select generated::date as month_start
    from generate_series(from_month::timestamp,to_month::timestamp,interval '1 month') generated
  ), counts as (
    select
      months.month_start,
      count(child.id) filter (
        where child.status not in ('cancelled'::public.mission_status,'rejected'::public.mission_status,'no_show'::public.mission_status)
      ) as planned_days,
      count(child.id) filter (
        where child.status in ('in_progress'::public.mission_status,'report_pending'::public.mission_status,'completed'::public.mission_status)
      ) as realized_days
    from months
    left join public.missions child
      on child.animation_parent_request_id = request_record.id
      and child.scheduled_start_at >= (months.month_start::timestamp at time zone 'Europe/Paris')
      and child.scheduled_start_at < ((months.month_start + interval '1 month')::timestamp at time zone 'Europe/Paris')
    group by months.month_start
  )
  select
    counts.month_start,
    request_record.animation_days_per_month,
    counts.planned_days,
    counts.realized_days,
    greatest(request_record.animation_days_per_month - counts.planned_days::integer,0),
    case
      when request_record.status <> 'accepted'::public.mission_status then 'pending_acceptance'
      when counts.planned_days = 0 then 'to_plan'
      when counts.planned_days < request_record.animation_days_per_month then 'partial'
      else 'complete'
    end
  from counts
  order by counts.month_start;
end;
$$;

revoke all on function public.get_animation_request_monthly_progress(uuid,date,date) from public, anon;
grant execute on function public.get_animation_request_monthly_progress(uuid,date,date) to authenticated;

comment on function public.schedule_animation_request_day(uuid,timestamptz,timestamptz) is
  'Creates one dated child animation from an accepted monthly animation request and enforces the monthly quota.';
comment on function public.get_animation_request_monthly_progress(uuid,date,date) is
  'Returns expected, planned, realized and remaining animation days by month for an animation request.';
