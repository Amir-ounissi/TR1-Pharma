create type public.performance_metric as enum (
  'revenue_ht',
  'implantations',
  'reorders',
  'first_reorder_rate',
  'active_pharmacies',
  'avg_distribution_rate',
  'strategic_distribution_rate',
  'missions',
  'animations',
  'trainings'
);

create type public.performance_scope_type as enum ('brand', 'territory', 'agent');

create table public.performance_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  scope_type public.performance_scope_type not null,
  territory_id uuid references public.territories(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  metric_key public.performance_metric not null,
  period_start date not null,
  period_end date not null,
  target_value numeric(14,2) not null check (target_value >= 0),
  note text,
  archived_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (
    (scope_type = 'brand' and territory_id is null and user_id is null)
    or (scope_type = 'territory' and territory_id is not null and user_id is null)
    or (scope_type = 'agent' and user_id is not null)
  )
);

create unique index performance_objectives_scope_metric_period_active
  on public.performance_objectives(
    brand_id,
    scope_type,
    coalesce(territory_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric_key,
    period_start,
    period_end
  )
  where archived_at is null;

create index performance_objectives_brand_period_idx
  on public.performance_objectives(brand_id, period_start, period_end)
  where archived_at is null;

create table public.performance_objective_versions (
  id bigint generated always as identity primary key,
  objective_id uuid not null references public.performance_objectives(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  changed_by uuid references public.users(id) on delete set null,
  change_type text not null check (change_type in ('created', 'updated', 'archived')),
  snapshot jsonb not null,
  changed_at timestamptz not null default now()
);

create index performance_objective_versions_objective_changed_idx
  on public.performance_objective_versions(objective_id, changed_at desc);

create or replace function private.is_performance_additive(metric public.performance_metric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select metric in ('revenue_ht','implantations','reorders','missions','animations','trainings');
$$;

create or replace function private.can_manage_performance_objectives(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_global_role(array['super_admin'])
    or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']);
$$;

create or replace function private.can_read_performance_objective(
  target_brand_id uuid,
  target_scope_type public.performance_scope_type,
  target_territory_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.can_manage_performance_objectives(target_brand_id)
    or (
      private.can_access_brand(target_brand_id)
      and (
        target_scope_type = 'brand'
        or (target_scope_type = 'agent' and target_user_id = (select auth.uid()))
        or (
          target_scope_type = 'territory'
          and target_territory_id is not null
          and exists (
            select 1
            from public.brand_pharmacies bp
            where bp.brand_id = target_brand_id
              and bp.territory_id = target_territory_id
              and bp.archived_at is null
              and private.user_is_assigned_to_relation((select auth.uid()), bp.id)
          )
        )
      )
    );
$$;

create or replace function private.validate_performance_objective()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  brand_record public.brands%rowtype;
begin
  select * into brand_record from public.brands where id = new.brand_id;
  if brand_record.id is null then
    raise exception 'Unknown brand' using errcode = '23514';
  end if;
  new.organization_id := brand_record.organization_id;
  if new.scope_type = 'territory' and not exists (
    select 1 from public.territories t
    where t.id = new.territory_id and t.brand_id = new.brand_id and t.archived_at is null
  ) then
    raise exception 'Objective territory is outside the brand scope' using errcode = '23514';
  end if;
  if new.scope_type = 'agent' and not exists (
    select 1
    from public.memberships m
    where m.brand_id = new.brand_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then
    raise exception 'Objective user has no active membership for this brand' using errcode = '23514';
  end if;
  if new.created_by is null then
    new.created_by := coalesce(old.created_by, (select auth.uid()));
  end if;
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create or replace function private.log_performance_objective_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.performance_objective_versions(
    objective_id, organization_id, brand_id, changed_by, change_type, snapshot
  )
  values(
    new.id,
    new.organization_id,
    new.brand_id,
    coalesce(new.updated_by, new.created_by, (select auth.uid())),
    case
      when tg_op = 'INSERT' then 'created'
      when new.archived_at is not null and coalesce(old.archived_at, '-infinity'::timestamptz) is null then 'archived'
      else 'updated'
    end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create or replace function private.prevent_performance_objective_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Objective history is append-only' using errcode = '42501';
end;
$$;

create trigger validate_performance_objective
before insert or update on public.performance_objectives
for each row execute function private.validate_performance_objective();

create trigger performance_objective_audit
after insert or update on public.performance_objectives
for each row execute function private.log_performance_objective_change();

create trigger performance_objective_versions_readonly
before update or delete on public.performance_objective_versions
for each row execute function private.prevent_performance_objective_version_mutation();

create trigger set_performance_objectives_updated_at
before update on public.performance_objectives
for each row execute function private.set_updated_at();

create or replace view public.performance_order_facts
with (security_invoker = true) as
select
  o.id as order_id,
  o.brand_id,
  o.brand_pharmacy_id,
  o.pharmacy_id,
  o.order_date,
  o.net_amount_ht,
  o.is_initial_order,
  o.is_reorder,
  bp.territory_id,
  coalesce(assignment.user_id, o.source_agent_user_id, bp.current_agent_user_id) as agent_user_id_at_order
from public.orders o
join public.brand_pharmacies bp on bp.id = o.brand_pharmacy_id
left join lateral (
  select pa.user_id
  from public.pharmacy_assignments pa
  where pa.brand_pharmacy_id = o.brand_pharmacy_id
    and pa.assignment_type = 'commercial_agent'
    and pa.archived_at is null
    and pa.starts_at <= o.order_date::date
    and (pa.ends_at is null or pa.ends_at >= o.order_date::date)
  order by pa.starts_at desc, pa.created_at desc
  limit 1
) assignment on true
where o.archived_at is null
  and private.order_counts_for_revenue(o.order_status, o.order_type, o.net_amount_ht);

create or replace view public.performance_mission_facts
with (security_invoker = true) as
select
  m.id as mission_id,
  m.brand_id,
  m.brand_pharmacy_id,
  m.pharmacy_id,
  m.assigned_user_id,
  m.mission_type,
  m.status,
  coalesce(m.actual_end_at, m.completed_at, m.scheduled_end_at, m.scheduled_start_at) as mission_date,
  bp.territory_id,
  impact.mission_total_cost,
  impact.sell_out_units,
  impact.participants_count,
  impact.contacts_count,
  impact.revenue_30d_after,
  impact.revenue_60d_after,
  impact.observation_maturity,
  impact.impact_data_quality
from public.missions m
join public.brand_pharmacies bp on bp.id = m.brand_pharmacy_id
left join public.mission_impact impact on impact.mission_id = m.id
where m.archived_at is null
  and m.status = 'completed';

create or replace function private.performance_scope_allowed(
  target_brand_id uuid,
  target_agent_id uuid,
  target_territory_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when private.can_manage_performance_objectives(target_brand_id) or private.has_brand_role(target_brand_id, array['brand_user']) then true
      when private.can_access_brand(target_brand_id)
        then target_agent_id = (select auth.uid())
          and (
            target_territory_id is null
            or exists (
              select 1
              from public.brand_pharmacies bp
              where bp.brand_id = target_brand_id
                and bp.territory_id = target_territory_id
                and bp.archived_at is null
                and private.user_is_assigned_to_relation((select auth.uid()), bp.id)
            )
          )
      else false
    end;
$$;

create or replace function private.performance_realized_value(
  metric public.performance_metric,
  target_brand_id uuid,
  target_period_start date,
  target_period_end date,
  target_territory_id uuid default null,
  target_agent_id uuid default null
)
returns numeric
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result numeric := 0;
  period_end_exclusive timestamptz := (target_period_end + 1)::timestamptz;
  first_reorder_target integer := 0;
begin
  if metric = 'revenue_ht' then
    select coalesce(sum(order_fact.net_amount_ht), 0) into result
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < period_end_exclusive
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id);
  elsif metric = 'implantations' then
    select count(*)::numeric into result
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.is_initial_order
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < period_end_exclusive
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id);
  elsif metric = 'reorders' then
    select count(*)::numeric into result
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.is_reorder
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < period_end_exclusive
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id);
  elsif metric = 'first_reorder_rate' then
    select settings.first_reorder_target_days into first_reorder_target
    from public.brand_settings settings
    where settings.brand_id = target_brand_id;
    with first_orders as (
      select distinct on (order_fact.brand_pharmacy_id)
        order_fact.brand_pharmacy_id,
        order_fact.order_date as first_order_at,
        order_fact.agent_user_id_at_order as first_agent_user_id,
        order_fact.territory_id
      from public.performance_order_facts order_fact
      where order_fact.brand_id = target_brand_id
        and order_fact.is_initial_order
      order by order_fact.brand_pharmacy_id, order_fact.order_date asc, order_fact.order_id asc
    ), scoped as (
      select *
      from first_orders
      where first_order_at::date <= target_period_end - greatest(coalesce(first_reorder_target, 1), 1)
        and (target_territory_id is null or territory_id = target_territory_id)
        and (target_agent_id is null or first_agent_user_id = target_agent_id)
    )
    select case when count(*) = 0 then 0 else round(
      count(*) filter (
        where exists (
          select 1
          from public.performance_order_facts reorder_fact
          where reorder_fact.brand_pharmacy_id = scoped.brand_pharmacy_id
            and reorder_fact.is_reorder
            and reorder_fact.order_date >= scoped.first_order_at
            and reorder_fact.order_date < period_end_exclusive
        )
      )::numeric / count(*) * 100, 1
    ) end into result
    from scoped;
  elsif metric = 'active_pharmacies' then
    select count(*)::numeric into result
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and health.health_status not in ('dormant', 'insufficient_history')
      and (target_territory_id is null or health.territory_id = target_territory_id)
      and (target_agent_id is null or health.current_agent_user_id = target_agent_id);
  elsif metric = 'avg_distribution_rate' then
    select coalesce(round(avg(dist.distribution_rate), 1), 0) into result
    from public.brand_pharmacy_distribution dist
    join public.brand_pharmacies bp on bp.id = dist.brand_pharmacy_id
    where bp.brand_id = target_brand_id
      and bp.archived_at is null
      and (target_territory_id is null or bp.territory_id = target_territory_id)
      and (target_agent_id is null or bp.current_agent_user_id = target_agent_id);
  elsif metric = 'strategic_distribution_rate' then
    select coalesce(round(avg(dist.strategic_distribution_rate), 1), 0) into result
    from public.brand_pharmacy_distribution dist
    join public.brand_pharmacies bp on bp.id = dist.brand_pharmacy_id
    where bp.brand_id = target_brand_id
      and bp.archived_at is null
      and (target_territory_id is null or bp.territory_id = target_territory_id)
      and (target_agent_id is null or bp.current_agent_user_id = target_agent_id);
  elsif metric = 'missions' then
    select count(*)::numeric into result
    from public.performance_mission_facts mission_fact
    where mission_fact.brand_id = target_brand_id
      and mission_fact.mission_date >= target_period_start::timestamptz
      and mission_fact.mission_date < period_end_exclusive
      and (target_territory_id is null or mission_fact.territory_id = target_territory_id)
      and (target_agent_id is null or mission_fact.assigned_user_id = target_agent_id);
  elsif metric = 'animations' then
    select count(*)::numeric into result
    from public.performance_mission_facts mission_fact
    where mission_fact.brand_id = target_brand_id
      and mission_fact.mission_type = 'animation'
      and mission_fact.mission_date >= target_period_start::timestamptz
      and mission_fact.mission_date < period_end_exclusive
      and (target_territory_id is null or mission_fact.territory_id = target_territory_id)
      and (target_agent_id is null or mission_fact.assigned_user_id = target_agent_id);
  elsif metric = 'trainings' then
    select count(*)::numeric into result
    from public.performance_mission_facts mission_fact
    where mission_fact.brand_id = target_brand_id
      and mission_fact.mission_type = 'training'
      and mission_fact.mission_date >= target_period_start::timestamptz
      and mission_fact.mission_date < period_end_exclusive
      and (target_territory_id is null or mission_fact.territory_id = target_territory_id)
      and (target_agent_id is null or mission_fact.assigned_user_id = target_agent_id);
  end if;
  return coalesce(result, 0);
end;
$$;

create or replace function public.get_objective_progress(
  target_brand_id uuid,
  target_filter_start date default null,
  target_filter_end date default null,
  target_scope_type public.performance_scope_type default null,
  target_territory_id uuid default null,
  target_agent_id uuid default null
)
returns table (
  objective_id uuid,
  scope_type public.performance_scope_type,
  territory_id uuid,
  user_id uuid,
  metric_key public.performance_metric,
  period_start date,
  period_end date,
  target_value numeric,
  realized_value numeric,
  attainment_percent numeric,
  gap_value numeric,
  projected_value numeric,
  note text,
  updated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  reference_day date := least(current_date, coalesce(target_filter_end, current_date));
begin
  if not private.performance_scope_allowed(target_brand_id, target_agent_id, target_territory_id) then
    raise exception 'Objective scope forbidden' using errcode = '42501';
  end if;
  return query
  with objectives as (
    select objective.*
    from public.performance_objectives objective
    where objective.brand_id = target_brand_id
      and objective.archived_at is null
      and (target_scope_type is null or objective.scope_type = target_scope_type)
      and (target_filter_start is null or objective.period_end >= target_filter_start)
      and (target_filter_end is null or objective.period_start <= target_filter_end)
      and (
        target_territory_id is null
        or objective.scope_type <> 'territory'
        or objective.territory_id = target_territory_id
      )
      and (
        target_agent_id is null
        or objective.scope_type <> 'agent'
        or objective.user_id = target_agent_id
      )
      and private.can_read_performance_objective(
        objective.brand_id,
        objective.scope_type,
        objective.territory_id,
        objective.user_id
      )
  ), realized as (
    select
      objective.id,
      private.performance_realized_value(
        objective.metric_key,
        objective.brand_id,
        objective.period_start,
        objective.period_end,
        objective.territory_id,
        objective.user_id
      ) as realized_value,
      greatest((least(reference_day, objective.period_end) - objective.period_start + 1), 0) as elapsed_days,
      (objective.period_end - objective.period_start + 1) as total_days
    from objectives objective
  )
  select
    objective.id,
    objective.scope_type,
    objective.territory_id,
    objective.user_id,
    objective.metric_key,
    objective.period_start,
    objective.period_end,
    objective.target_value,
    realized.realized_value,
    case when objective.target_value = 0 then null else round(realized.realized_value / objective.target_value * 100, 1) end,
    round(realized.realized_value - objective.target_value, 2),
    case
      when private.is_performance_additive(objective.metric_key)
        and reference_day between objective.period_start and objective.period_end
        and realized.elapsed_days > 0
        then round(realized.realized_value / realized.elapsed_days * realized.total_days, 2)
      else null
    end as projected_value,
    objective.note,
    objective.updated_at
  from objectives objective
  join realized on realized.id = objective.id
  order by objective.period_start desc, objective.scope_type, objective.metric_key;
end;
$$;

create or replace function public.save_performance_objective(
  target_objective_id uuid,
  target_brand_id uuid,
  target_scope_type public.performance_scope_type,
  target_metric_key public.performance_metric,
  target_period_start date,
  target_period_end date,
  target_target_value numeric,
  target_territory_id uuid default null,
  target_user_id uuid default null,
  target_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  objective_id uuid := coalesce(target_objective_id, gen_random_uuid());
  organization_uuid uuid;
begin
  if not private.can_manage_performance_objectives(target_brand_id) then
    raise exception 'Performance objective update forbidden' using errcode = '42501';
  end if;
  select organization_id into organization_uuid from public.brands where id = target_brand_id;
  insert into public.performance_objectives(
    id, organization_id, brand_id, scope_type, territory_id, user_id,
    metric_key, period_start, period_end, target_value, note, created_by, updated_by
  )
  values(
    objective_id, organization_uuid, target_brand_id, target_scope_type, target_territory_id, target_user_id,
    target_metric_key, target_period_start, target_period_end, target_target_value, nullif(btrim(target_note), ''),
    (select auth.uid()), (select auth.uid())
  )
  on conflict (id) do update
    set scope_type = excluded.scope_type,
        territory_id = excluded.territory_id,
        user_id = excluded.user_id,
        metric_key = excluded.metric_key,
        period_start = excluded.period_start,
        period_end = excluded.period_end,
        target_value = excluded.target_value,
        note = excluded.note,
        updated_by = excluded.updated_by,
        archived_at = null;
  return objective_id;
end;
$$;

create or replace function public.archive_performance_objective(target_objective_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_brand_id uuid;
begin
  select brand_id into target_brand_id from public.performance_objectives where id = target_objective_id;
  if target_brand_id is null then
    raise exception 'Objective not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_performance_objectives(target_brand_id) then
    raise exception 'Performance objective archive forbidden' using errcode = '42501';
  end if;
  update public.performance_objectives
  set archived_at = now(), updated_by = (select auth.uid())
  where id = target_objective_id;
end;
$$;

create or replace function public.get_performance_overview(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date,
  target_territory_id uuid default null,
  target_agent_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.performance_scope_allowed(target_brand_id, target_agent_id, target_territory_id) then
    raise exception 'Performance overview forbidden' using errcode = '42501';
  end if;
  with portfolio as (
    select *
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and (target_territory_id is null or health.territory_id = target_territory_id)
      and (target_agent_id is null or health.current_agent_user_id = target_agent_id)
  ), revenue as (
    select * from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id)
  ), missions as (
    select * from public.performance_mission_facts mission_fact
    where mission_fact.brand_id = target_brand_id
      and mission_fact.mission_date >= target_period_start::timestamptz
      and mission_fact.mission_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or mission_fact.territory_id = target_territory_id)
      and (target_agent_id is null or mission_fact.assigned_user_id = target_agent_id)
  ), distribution as (
    select dist.*
    from public.brand_pharmacy_distribution dist
    join public.brand_pharmacies bp on bp.id = dist.brand_pharmacy_id
    where bp.brand_id = target_brand_id
      and bp.archived_at is null
      and (target_territory_id is null or bp.territory_id = target_territory_id)
      and (target_agent_id is null or bp.current_agent_user_id = target_agent_id)
  ), portfolio_metrics as (
    select
      count(*) filter (where portfolio.health_status not in ('dormant','insufficient_history')) as active_pharmacies,
      count(*) filter (where portfolio.health_status = 'at_risk') as at_risk_accounts,
      count(*) filter (where portfolio.health_status = 'dormant') as dormant_accounts,
      count(*) filter (where not portfolio.has_next_action) as without_next_action_count,
      count(*) filter (where portfolio.priority_level = 'strategic' and not portfolio.has_next_action) as strategic_without_action_count
    from portfolio
  ), revenue_metrics as (
    select
      coalesce(sum(revenue.net_amount_ht), 0) as revenue_ht,
      count(*) filter (where revenue.is_initial_order) as implantations,
      count(*) filter (where revenue.is_reorder) as reorders
    from revenue
  ), mission_metrics as (
    select
      count(missions.mission_id) as missions_completed,
      count(missions.mission_id) filter (where missions.mission_type = 'animation') as animations_completed,
      count(missions.mission_id) filter (where missions.mission_type = 'training') as trainings_completed,
      coalesce(sum(missions.sell_out_units), 0) as sell_out_units,
      case
        when count(missions.mission_id) filter (where missions.mission_type = 'animation') = 0 then null
        else round(
          coalesce(sum(missions.sell_out_units) filter (where missions.mission_type = 'animation'), 0)
          / count(missions.mission_id) filter (where missions.mission_type = 'animation'),
          1
        )
      end as average_units_per_animation,
      coalesce(sum(missions.participants_count) filter (where missions.mission_type = 'training'), 0) as participants_count
    from missions
  ), distribution_metrics as (
    select
      coalesce(round(avg(distribution.distribution_rate), 1), 0) as avg_distribution_rate,
      coalesce(round(avg(distribution.strategic_distribution_rate), 1), 0) as strategic_distribution_rate
    from distribution
  )
  select jsonb_build_object(
    'period_start', target_period_start,
    'period_end', target_period_end,
    'revenue_ht', revenue_metrics.revenue_ht,
    'implantations', revenue_metrics.implantations,
    'reorders', revenue_metrics.reorders,
    'active_pharmacies', portfolio_metrics.active_pharmacies,
    'at_risk_accounts', portfolio_metrics.at_risk_accounts,
    'dormant_accounts', portfolio_metrics.dormant_accounts,
    'without_next_action_count', portfolio_metrics.without_next_action_count,
    'strategic_without_action_count', portfolio_metrics.strategic_without_action_count,
    'first_reorder_rate', private.performance_realized_value('first_reorder_rate', target_brand_id, target_period_start, target_period_end, target_territory_id, target_agent_id),
    'avg_distribution_rate', distribution_metrics.avg_distribution_rate,
    'strategic_distribution_rate', distribution_metrics.strategic_distribution_rate,
    'missions_completed', mission_metrics.missions_completed,
    'animations_completed', mission_metrics.animations_completed,
    'trainings_completed', mission_metrics.trainings_completed,
    'sell_out_units', mission_metrics.sell_out_units,
    'average_units_per_animation', mission_metrics.average_units_per_animation,
    'participants_count', mission_metrics.participants_count
  ) into result
  from portfolio_metrics
  cross join revenue_metrics
  cross join mission_metrics
  cross join distribution_metrics;
  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.get_performance_network(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date,
  target_territory_id uuid default null,
  target_agent_id uuid default null
)
returns table (
  brand_pharmacy_id uuid,
  pharmacy_name text,
  territory_name text,
  agent_user_id uuid,
  agent_name text,
  health_status public.commercial_health_status,
  priority_score integer,
  recommendation text,
  has_next_action boolean,
  next_action_at timestamptz,
  revenue_ht numeric,
  implantations integer,
  reorders integer,
  distribution_rate numeric,
  strategic_distribution_rate numeric,
  missions_completed integer,
  animations_completed integer,
  trainings_completed integer,
  sell_out_units numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.performance_scope_allowed(target_brand_id, target_agent_id, target_territory_id) then
    raise exception 'Performance network forbidden' using errcode = '42501';
  end if;
  return query
  with revenue as (
    select
      order_fact.brand_pharmacy_id,
      coalesce(sum(order_fact.net_amount_ht), 0) as revenue_ht,
      count(*) filter (where order_fact.is_initial_order)::integer as implantations,
      count(*) filter (where order_fact.is_reorder)::integer as reorders
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id)
    group by order_fact.brand_pharmacy_id
  ), missions as (
    select
      mission_fact.brand_pharmacy_id,
      count(*)::integer as missions_completed,
      count(*) filter (where mission_fact.mission_type = 'animation')::integer as animations_completed,
      count(*) filter (where mission_fact.mission_type = 'training')::integer as trainings_completed,
      coalesce(sum(mission_fact.sell_out_units), 0)::numeric as sell_out_units
    from public.performance_mission_facts mission_fact
    where mission_fact.brand_id = target_brand_id
      and mission_fact.mission_date >= target_period_start::timestamptz
      and mission_fact.mission_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or mission_fact.territory_id = target_territory_id)
      and (target_agent_id is null or mission_fact.assigned_user_id = target_agent_id)
    group by mission_fact.brand_pharmacy_id
  )
  select
    health.brand_pharmacy_id,
    health.pharmacy_name,
    health.territory_name,
    health.current_agent_user_id,
    health.agent_name,
    health.health_status,
    health.priority_score,
    health.recommendation,
    health.has_next_action,
    health.next_action_at,
    coalesce(revenue.revenue_ht, 0)::numeric,
    coalesce(revenue.implantations, 0),
    coalesce(revenue.reorders, 0),
    dist.distribution_rate,
    dist.strategic_distribution_rate,
    coalesce(missions.missions_completed, 0),
    coalesce(missions.animations_completed, 0),
    coalesce(missions.trainings_completed, 0),
    coalesce(missions.sell_out_units, 0)::numeric
  from public.commercial_account_health health
  join public.brand_pharmacy_distribution dist on dist.brand_pharmacy_id = health.brand_pharmacy_id
  left join revenue on revenue.brand_pharmacy_id = health.brand_pharmacy_id
  left join missions on missions.brand_pharmacy_id = health.brand_pharmacy_id
  where health.brand_id = target_brand_id
    and (target_territory_id is null or health.territory_id = target_territory_id)
    and (target_agent_id is null or health.current_agent_user_id = target_agent_id)
  order by health.priority_score desc, health.pharmacy_name;
end;
$$;

create or replace function public.get_performance_team(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date,
  target_territory_id uuid default null
)
returns table (
  user_id uuid,
  full_name text,
  revenue_ht numeric,
  implantations integer,
  reorders integer,
  first_reorder_rate numeric,
  active_pharmacies integer,
  at_risk_accounts integer,
  dormant_accounts integer,
  without_next_action_count integer,
  avg_distribution_rate numeric,
  strategic_distribution_rate numeric,
  missions_completed integer,
  animations_completed integer,
  trainings_completed integer,
  sell_out_units numeric,
  participants_count numeric,
  complete_data_rate numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (private.can_manage_performance_objectives(target_brand_id) or private.has_brand_role(target_brand_id, array['brand_user'])) then
    raise exception 'Performance team forbidden' using errcode = '42501';
  end if;
  return query
  with scoped_members as (
    select
      membership.user_id,
      profile.full_name
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    join public.user_profiles profile on profile.user_id = membership.user_id
    where membership.brand_id = target_brand_id
      and membership.status = 'active'
      and role.key = 'agent'
  ), revenue as (
    select
      order_fact.agent_user_id_at_order as user_id,
      coalesce(sum(order_fact.net_amount_ht), 0) as revenue_ht,
      count(*) filter (where order_fact.is_initial_order)::integer as implantations,
      count(*) filter (where order_fact.is_reorder)::integer as reorders
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and order_fact.agent_user_id_at_order is not null
    group by order_fact.agent_user_id_at_order
  ), portfolio as (
    select
      health.current_agent_user_id as user_id,
      count(*) filter (where health.health_status not in ('dormant','insufficient_history'))::integer as active_pharmacies,
      count(*) filter (where health.health_status = 'at_risk')::integer as at_risk_accounts,
      count(*) filter (where health.health_status = 'dormant')::integer as dormant_accounts,
      count(*) filter (where not health.has_next_action)::integer as without_next_action_count
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and (target_territory_id is null or health.territory_id = target_territory_id)
      and health.current_agent_user_id is not null
    group by health.current_agent_user_id
  ), distribution as (
    select
      bp.current_agent_user_id as user_id,
      round(avg(dist.distribution_rate), 1) as avg_distribution_rate,
      round(avg(dist.strategic_distribution_rate), 1) as strategic_distribution_rate
    from public.brand_pharmacy_distribution dist
    join public.brand_pharmacies bp on bp.id = dist.brand_pharmacy_id
    where bp.brand_id = target_brand_id
      and bp.archived_at is null
      and (target_territory_id is null or bp.territory_id = target_territory_id)
      and bp.current_agent_user_id is not null
    group by bp.current_agent_user_id
  ), missions as (
    select
      mission_fact.assigned_user_id as user_id,
      count(*)::integer as missions_completed,
      count(*) filter (where mission_fact.mission_type = 'animation')::integer as animations_completed,
      count(*) filter (where mission_fact.mission_type = 'training')::integer as trainings_completed,
      coalesce(sum(mission_fact.sell_out_units), 0)::numeric as sell_out_units,
      coalesce(sum(mission_fact.participants_count), 0)::numeric as participants_count,
      case when count(*) = 0 then 0 else round(
        count(*) filter (where mission_fact.impact_data_quality = 'complete')::numeric / count(*) * 100, 1
      ) end as complete_data_rate
    from public.performance_mission_facts mission_fact
    where mission_fact.brand_id = target_brand_id
      and mission_fact.mission_date >= target_period_start::timestamptz
      and mission_fact.mission_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or mission_fact.territory_id = target_territory_id)
      and mission_fact.assigned_user_id is not null
    group by mission_fact.assigned_user_id
  )
  select
    member.user_id,
    member.full_name,
    coalesce(revenue.revenue_ht, 0)::numeric,
    coalesce(revenue.implantations, 0),
    coalesce(revenue.reorders, 0),
    private.performance_realized_value('first_reorder_rate', target_brand_id, target_period_start, target_period_end, target_territory_id, member.user_id),
    coalesce(portfolio.active_pharmacies, 0),
    coalesce(portfolio.at_risk_accounts, 0),
    coalesce(portfolio.dormant_accounts, 0),
    coalesce(portfolio.without_next_action_count, 0),
    coalesce(distribution.avg_distribution_rate, 0)::numeric,
    coalesce(distribution.strategic_distribution_rate, 0)::numeric,
    coalesce(missions.missions_completed, 0),
    coalesce(missions.animations_completed, 0),
    coalesce(missions.trainings_completed, 0),
    coalesce(missions.sell_out_units, 0)::numeric,
    coalesce(missions.participants_count, 0)::numeric,
    coalesce(missions.complete_data_rate, 0)::numeric
  from scoped_members member
  left join revenue on revenue.user_id = member.user_id
  left join portfolio on portfolio.user_id = member.user_id
  left join distribution on distribution.user_id = member.user_id
  left join missions on missions.user_id = member.user_id
  order by coalesce(revenue.revenue_ht, 0) desc, member.full_name;
end;
$$;

alter table public.performance_objectives enable row level security;
alter table public.performance_objective_versions enable row level security;

create policy performance_objectives_select
on public.performance_objectives
for select to authenticated
using (private.can_read_performance_objective(brand_id, scope_type, territory_id, user_id));

create policy performance_objectives_manage
on public.performance_objectives
for all to authenticated
using (private.can_manage_performance_objectives(brand_id))
with check (private.can_manage_performance_objectives(brand_id));

create policy performance_objective_versions_select
on public.performance_objective_versions
for select to authenticated
using (private.can_read_performance_objective(
  brand_id,
  (snapshot ->> 'scope_type')::public.performance_scope_type,
  nullif(snapshot ->> 'territory_id', '')::uuid,
  nullif(snapshot ->> 'user_id', '')::uuid
));

revoke all on public.performance_objectives, public.performance_objective_versions from anon;
grant select, insert, update on public.performance_objectives to authenticated, service_role;
grant select on public.performance_objective_versions, public.performance_order_facts, public.performance_mission_facts to authenticated, service_role;
grant usage on type public.performance_metric, public.performance_scope_type to authenticated, service_role;
grant execute on function
  public.get_objective_progress(uuid,date,date,public.performance_scope_type,uuid,uuid),
  public.save_performance_objective(uuid,uuid,public.performance_scope_type,public.performance_metric,date,date,numeric,uuid,uuid,text),
  public.archive_performance_objective(uuid),
  public.get_performance_overview(uuid,date,date,uuid,uuid),
  public.get_performance_network(uuid,date,date,uuid,uuid),
  public.get_performance_team(uuid,date,date,uuid)
to authenticated, service_role;
