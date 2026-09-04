create or replace view public.performance_order_facts
with (security_invoker = true)
as
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
  coalesce(o.source_agent_user_id, assignment.user_id, bp.current_agent_user_id) as agent_user_id_at_order
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

create or replace view public.performance_commercial_order_facts
with (security_invoker = true)
as
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
  coalesce(o.source_agent_user_id, assignment.user_id, bp.current_agent_user_id) as agent_user_id_at_order
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
  and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht);

create or replace view public.performance_booked_order_facts
with (security_invoker = true)
as
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
  coalesce(o.source_agent_user_id, assignment.user_id, bp.current_agent_user_id) as agent_user_id_at_order
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
  and private.order_counts_for_booked_revenue(o.order_status, o.order_type, o.net_amount_ht);

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
    from public.performance_commercial_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.is_initial_order
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < period_end_exclusive
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id);

  elsif metric = 'reorders' then
    select count(*)::numeric into result
    from public.performance_commercial_order_facts order_fact
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
      from public.performance_commercial_order_facts order_fact
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
          from public.performance_commercial_order_facts reorder_fact
          where reorder_fact.brand_pharmacy_id = scoped.brand_pharmacy_id
            and reorder_fact.is_reorder
            and reorder_fact.order_date >= scoped.first_order_at
            and reorder_fact.order_date < period_end_exclusive
        )
      )::numeric / count(*) * 100,
      1
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
    join public.commercial_account_health health on health.brand_pharmacy_id = dist.brand_pharmacy_id
    where health.brand_id = target_brand_id
      and health.orders_count > 0
      and (target_territory_id is null or health.territory_id = target_territory_id)
      and (target_agent_id is null or health.current_agent_user_id = target_agent_id);

  elsif metric = 'strategic_distribution_rate' then
    select round(avg(dist.strategic_distribution_rate), 1) into result
    from public.brand_pharmacy_distribution dist
    join public.commercial_account_health health on health.brand_pharmacy_id = dist.brand_pharmacy_id
    where health.brand_id = target_brand_id
      and health.orders_count > 0
      and dist.strategic_distribution_rate is not null
      and (target_territory_id is null or health.territory_id = target_territory_id)
      and (target_agent_id is null or health.current_agent_user_id = target_agent_id);

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
    select *
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id)
  ), booked as (
    select *
    from public.performance_booked_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id)
  ), commercial as (
    select *
    from public.performance_commercial_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id)
  ), missions as (
    select *
    from public.performance_mission_facts mission_fact
    where mission_fact.brand_id = target_brand_id
      and mission_fact.mission_date >= target_period_start::timestamptz
      and mission_fact.mission_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or mission_fact.territory_id = target_territory_id)
      and (target_agent_id is null or mission_fact.assigned_user_id = target_agent_id)
  ), distribution as (
    select dist.*
    from public.brand_pharmacy_distribution dist
    join portfolio on portfolio.brand_pharmacy_id = dist.brand_pharmacy_id
    where portfolio.orders_count > 0
  ), portfolio_metrics as (
    select
      count(*) filter (where portfolio.health_status not in ('dormant','insufficient_history')) as active_pharmacies,
      count(*) filter (where portfolio.health_status = 'at_risk') as at_risk_accounts,
      count(*) filter (where portfolio.health_status = 'dormant') as dormant_accounts,
      count(*) filter (where not portfolio.has_next_action) as without_next_action_count,
      count(*) filter (where portfolio.priority_level = 'strategic' and not portfolio.has_next_action) as strategic_without_action_count,
      count(*) filter (where portfolio.orders_count > 0) as customer_pharmacies,
      count(*) filter (where portfolio.commercial_status <> 'lost') as portfolio_pharmacies
    from portfolio
  ), revenue_metrics as (
    select coalesce(sum(revenue.net_amount_ht), 0) as revenue_ht
    from revenue
  ), booked_metrics as (
    select coalesce(sum(booked.net_amount_ht), 0) as booked_revenue_ht
    from booked
  ), commercial_metrics as (
    select
      count(*) filter (where commercial.is_initial_order) as implantations,
      count(*) filter (where commercial.is_reorder) as reorders
    from commercial
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
      round(avg(distribution.strategic_distribution_rate) filter (where distribution.strategic_distribution_rate is not null), 1) as strategic_distribution_rate
    from distribution
  )
  select jsonb_build_object(
    'period_start', target_period_start,
    'period_end', target_period_end,
    'revenue_ht', revenue_metrics.revenue_ht,
    'booked_revenue_ht', booked_metrics.booked_revenue_ht,
    'implantations', commercial_metrics.implantations,
    'reorders', commercial_metrics.reorders,
    'active_pharmacies', portfolio_metrics.active_pharmacies,
    'customer_pharmacies', portfolio_metrics.customer_pharmacies,
    'portfolio_pharmacies', portfolio_metrics.portfolio_pharmacies,
    'network_distribution_rate', case
      when portfolio_metrics.portfolio_pharmacies = 0 then null
      else round(portfolio_metrics.customer_pharmacies * 100.0 / portfolio_metrics.portfolio_pharmacies, 1)
    end,
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
  cross join booked_metrics
  cross join commercial_metrics
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
returns table(
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
      coalesce(sum(order_fact.net_amount_ht), 0) as revenue_ht
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and (target_agent_id is null or order_fact.agent_user_id_at_order = target_agent_id)
    group by order_fact.brand_pharmacy_id
  ), commercial as (
    select
      order_fact.brand_pharmacy_id,
      count(*) filter (where order_fact.is_initial_order)::integer as implantations,
      count(*) filter (where order_fact.is_reorder)::integer as reorders
    from public.performance_commercial_order_facts order_fact
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
    coalesce(commercial.implantations, 0),
    coalesce(commercial.reorders, 0),
    dist.distribution_rate,
    dist.strategic_distribution_rate,
    coalesce(missions.missions_completed, 0),
    coalesce(missions.animations_completed, 0),
    coalesce(missions.trainings_completed, 0),
    coalesce(missions.sell_out_units, 0)::numeric
  from public.commercial_account_health health
  join public.brand_pharmacy_distribution dist on dist.brand_pharmacy_id = health.brand_pharmacy_id
  left join revenue on revenue.brand_pharmacy_id = health.brand_pharmacy_id
  left join commercial on commercial.brand_pharmacy_id = health.brand_pharmacy_id
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
returns table(
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
set search_path = ''
as $$
begin
  if not (private.can_manage_performance_objectives(target_brand_id) or private.has_brand_role(target_brand_id, array['brand_user'])) then
    raise exception 'Performance team forbidden' using errcode = '42501';
  end if;

  return query
  with scoped_members as (
    select membership.user_id, profile.full_name
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    join public.user_profiles profile on profile.user_id = membership.user_id
    where membership.brand_id = target_brand_id
      and membership.status = 'active'
      and role.key = 'agent'
  ), revenue as (
    select
      order_fact.agent_user_id_at_order as user_id,
      coalesce(sum(order_fact.net_amount_ht), 0) as revenue_ht
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or order_fact.territory_id = target_territory_id)
      and order_fact.agent_user_id_at_order is not null
    group by order_fact.agent_user_id_at_order
  ), commercial as (
    select
      order_fact.agent_user_id_at_order as user_id,
      count(*) filter (where order_fact.is_initial_order)::integer as implantations,
      count(*) filter (where order_fact.is_reorder)::integer as reorders
    from public.performance_commercial_order_facts order_fact
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
      health.current_agent_user_id as user_id,
      round(avg(dist.distribution_rate) filter (where health.orders_count > 0), 1) as avg_distribution_rate,
      round(avg(dist.strategic_distribution_rate) filter (where health.orders_count > 0 and dist.strategic_distribution_rate is not null), 1) as strategic_distribution_rate
    from public.brand_pharmacy_distribution dist
    join public.commercial_account_health health on health.brand_pharmacy_id = dist.brand_pharmacy_id
    where health.brand_id = target_brand_id
      and (target_territory_id is null or health.territory_id = target_territory_id)
      and health.current_agent_user_id is not null
    group by health.current_agent_user_id
  ), missions as (
    select
      mission_fact.assigned_user_id as user_id,
      count(*)::integer as missions_completed,
      count(*) filter (where mission_fact.mission_type = 'animation')::integer as animations_completed,
      count(*) filter (where mission_fact.mission_type = 'training')::integer as trainings_completed,
      coalesce(sum(mission_fact.sell_out_units), 0)::numeric as sell_out_units,
      coalesce(sum(mission_fact.participants_count), 0)::numeric as participants_count,
      case when count(*) = 0 then 0 else round(
        count(*) filter (where mission_fact.impact_data_quality = 'complete')::numeric / count(*) * 100,
        1
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
    coalesce(commercial.implantations, 0),
    coalesce(commercial.reorders, 0),
    private.performance_realized_value('first_reorder_rate', target_brand_id, target_period_start, target_period_end, target_territory_id, member.user_id),
    coalesce(portfolio.active_pharmacies, 0),
    coalesce(portfolio.at_risk_accounts, 0),
    coalesce(portfolio.dormant_accounts, 0),
    coalesce(portfolio.without_next_action_count, 0),
    coalesce(distribution.avg_distribution_rate, 0)::numeric,
    distribution.strategic_distribution_rate,
    coalesce(missions.missions_completed, 0),
    coalesce(missions.animations_completed, 0),
    coalesce(missions.trainings_completed, 0),
    coalesce(missions.sell_out_units, 0)::numeric,
    coalesce(missions.participants_count, 0)::numeric,
    coalesce(missions.complete_data_rate, 0)::numeric
  from scoped_members member
  left join revenue on revenue.user_id = member.user_id
  left join commercial on commercial.user_id = member.user_id
  left join portfolio on portfolio.user_id = member.user_id
  left join distribution on distribution.user_id = member.user_id
  left join missions on missions.user_id = member.user_id
  order by coalesce(revenue.revenue_ht, 0) desc, member.full_name;
end;
$$;

create or replace function public.get_product_distribution(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date,
  target_territory_id uuid default null,
  target_agent_id uuid default null
)
returns table(
  product_id uuid,
  product_name text,
  sku text,
  customer_pharmacies integer,
  distributing_pharmacies integer,
  distribution_rate numeric,
  paid_units numeric,
  free_units numeric,
  booked_revenue_ht numeric,
  invoiced_revenue_ht numeric
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.performance_scope_allowed(target_brand_id, target_agent_id, target_territory_id) then
    raise exception 'Product distribution forbidden' using errcode = '42501';
  end if;

  return query
  with customers as (
    select health.brand_pharmacy_id
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and health.orders_count > 0
      and (target_territory_id is null or health.territory_id = target_territory_id)
      and (target_agent_id is null or health.current_agent_user_id = target_agent_id)
  ), presence as (
    select distinct bpp.product_id, bpp.brand_pharmacy_id
    from public.brand_pharmacy_products bpp
    join customers on customers.brand_pharmacy_id = bpp.brand_pharmacy_id
    where bpp.removed_at is null
      and (
        bpp.order_presence
        or bpp.status in ('implanted','active','temporarily_unavailable')
        or bpp.manually_confirmed_present
      )
  ), booked_sales as (
    select
      oi.product_id,
      sum(oi.quantity)::numeric as paid_units,
      sum(oi.free_quantity)::numeric as free_units,
      sum(oi.line_total_ht)::numeric as booked_revenue_ht
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.brand_pharmacies bp on bp.id = o.brand_pharmacy_id
    where o.brand_id = target_brand_id
      and o.archived_at is null
      and private.order_counts_for_booked_revenue(o.order_status, o.order_type, o.net_amount_ht)
      and o.order_date >= target_period_start::timestamptz
      and o.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or bp.territory_id = target_territory_id)
      and (target_agent_id is null or coalesce(o.source_agent_user_id, bp.current_agent_user_id) = target_agent_id)
    group by oi.product_id
  ), invoiced_sales as (
    select
      oi.product_id,
      sum(oi.line_total_ht)::numeric as invoiced_revenue_ht
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.brand_pharmacies bp on bp.id = o.brand_pharmacy_id
    where o.brand_id = target_brand_id
      and o.archived_at is null
      and private.order_counts_for_revenue(o.order_status, o.order_type, o.net_amount_ht)
      and o.order_date >= target_period_start::timestamptz
      and o.order_date < (target_period_end + 1)::timestamptz
      and (target_territory_id is null or bp.territory_id = target_territory_id)
      and (target_agent_id is null or coalesce(o.source_agent_user_id, bp.current_agent_user_id) = target_agent_id)
    group by oi.product_id
  ), customer_count as (
    select count(*)::integer as value from customers
  )
  select
    p.id,
    p.name,
    p.sku,
    customer_count.value,
    count(distinct presence.brand_pharmacy_id)::integer,
    case
      when customer_count.value = 0 then null::numeric
      else round(count(distinct presence.brand_pharmacy_id)::numeric * 100.0 / customer_count.value, 1)
    end,
    coalesce(booked_sales.paid_units, 0),
    coalesce(booked_sales.free_units, 0),
    coalesce(booked_sales.booked_revenue_ht, 0),
    coalesce(invoiced_sales.invoiced_revenue_ht, 0)
  from public.products p
  cross join customer_count
  left join presence on presence.product_id = p.id
  left join booked_sales on booked_sales.product_id = p.id
  left join invoiced_sales on invoiced_sales.product_id = p.id
  where p.brand_id = target_brand_id
    and p.is_active
    and p.discontinued_at is null
    and p.is_pharmacy_eligible
    and p.counts_for_distribution
  group by
    p.id,
    p.name,
    p.sku,
    customer_count.value,
    booked_sales.paid_units,
    booked_sales.free_units,
    booked_sales.booked_revenue_ht,
    invoiced_sales.invoiced_revenue_ht
  order by distribution_rate desc nulls last, p.name;
end;
$$;

grant select on public.performance_commercial_order_facts to authenticated, service_role;
grant select on public.performance_booked_order_facts to authenticated, service_role;
grant execute on function public.get_product_distribution(uuid,date,date,uuid,uuid) to authenticated, service_role;;
