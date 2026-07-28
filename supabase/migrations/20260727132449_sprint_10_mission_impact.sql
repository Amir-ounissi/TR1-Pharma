alter type public.product_event_name add value if not exists 'mission_impact_viewed';
alter type public.product_event_name add value if not exists 'mission_performance_dashboard_viewed';
alter type public.product_event_name add value if not exists 'mission_followup_recommended';
alter type public.product_event_name add value if not exists 'mission_followup_created';
alter type public.product_event_name add value if not exists 'mission_data_quality_issue_opened';
alter type public.product_event_name add value if not exists 'mission_type_comparison_viewed';
alter type public.product_event_name add value if not exists 'mission_observed_result_opened';

create type public.mission_effectiveness_status as enum (
  'strong_positive','positive','neutral','weak','no_observable_result','insufficient_data'
);
create type public.mission_observation_maturity as enum ('early','30d_complete','60d_complete','mature');
create type public.mission_impact_data_quality as enum ('complete','partial','insufficient');

alter table public.brand_settings
  add column post_mission_followup_days integer not null default 7
    check (post_mission_followup_days between 1 and 90);

create index missions_completed_impact_idx
  on public.missions(brand_id, brand_pharmacy_id, actual_end_at desc)
  where status = 'completed' and archived_at is null;

create or replace function private.mission_observation_maturity(days_observed integer)
returns public.mission_observation_maturity
language sql immutable set search_path = ''
as $$
  select case
    when days_observed < 30 then 'early'
    when days_observed < 60 then '30d_complete'
    when days_observed < 90 then '60d_complete'
    else 'mature'
  end::public.mission_observation_maturity;
$$;

create or replace function private.mission_effectiveness(
  days_observed integer,
  revenue_before numeric,
  revenue_after_30 numeric,
  orders_after_30 integer,
  orders_after_60 integer,
  reorder_after_30 boolean,
  reorder_after_60 boolean
)
returns public.mission_effectiveness_status
language sql immutable set search_path = ''
as $$
  select case
    when days_observed < 30 then 'insufficient_data'
    when reorder_after_30
      or (revenue_before > 0 and ((revenue_after_30 - revenue_before) / revenue_before) > 0.20)
      then 'strong_positive'
    when reorder_after_60 or orders_after_60 > 0
      or (revenue_before > 0 and ((revenue_after_30 - revenue_before) / revenue_before) > 0.05)
      then 'positive'
    when revenue_before > 0
      and abs((revenue_after_30 - revenue_before) / revenue_before) <= 0.05
      then 'neutral'
    when days_observed >= 60 and orders_after_60 = 0 and revenue_after_30 = 0
      then 'no_observable_result'
    else 'weak'
  end::public.mission_effectiveness_status;
$$;

drop view if exists public.mission_performance;
create view public.mission_impact with (security_invoker = true) as
with completed_missions as (
  select
    mission.*,
    coalesce(mission.actual_end_at, mission.completed_at, mission.actual_start_at, mission.scheduled_end_at) as mission_date,
    greatest(
      floor(extract(epoch from now() - coalesce(mission.actual_end_at, mission.completed_at, mission.actual_start_at, mission.scheduled_end_at)) / 86400)::integer,
      0
    ) as days_observed
  from public.missions mission
  where mission.status = 'completed'
    and mission.archived_at is null
    and coalesce(mission.actual_end_at, mission.completed_at, mission.actual_start_at, mission.scheduled_end_at) is not null
),
valid_orders as (
  select orders.*
  from public.orders
  where orders.archived_at is null
    and private.order_counts_for_revenue(orders.order_status, orders.order_type, orders.net_amount_ht)
),
order_metrics as (
  select
    mission.id as mission_id,
    count(*) filter (where orders.order_date <= mission.mission_date) as orders_before_count,
    max(orders.order_date) filter (where orders.order_date <= mission.mission_date) as order_before_at,
    (array_agg(orders.net_amount_ht order by orders.order_date desc)
      filter (where orders.order_date <= mission.mission_date))[1] as order_before_value,
    min(orders.order_date) filter (where orders.order_date > mission.mission_date) as first_order_after_at,
    (array_agg(orders.net_amount_ht order by orders.order_date)
      filter (where orders.order_date > mission.mission_date))[1] as first_order_after_value,
    coalesce(sum(orders.net_amount_ht) filter (
      where orders.order_date > mission.mission_date - interval '30 days'
        and orders.order_date <= mission.mission_date
    ), 0) as revenue_30d_before,
    coalesce(sum(orders.net_amount_ht) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '30 days'
    ), 0) as revenue_30d_after,
    coalesce(sum(orders.net_amount_ht) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '60 days'
    ), 0) as revenue_60d_after,
    coalesce(sum(orders.net_amount_ht) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '90 days'
    ), 0) as revenue_90d_after,
    count(*) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '30 days'
    )::integer as orders_30d_after,
    count(*) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '60 days'
    )::integer as orders_60d_after,
    count(*) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '90 days'
    )::integer as orders_90d_after,
    coalesce(bool_or(orders.is_reorder) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '30 days'
    ), false) as reorder_observed_30d,
    coalesce(bool_or(orders.is_reorder) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '60 days'
    ), false) as reorder_observed_60d,
    coalesce(bool_or(orders.is_reorder) filter (
      where orders.order_date > mission.mission_date
        and orders.order_date <= mission.mission_date + interval '90 days'
    ), false) as reorder_observed_90d
  from completed_missions mission
  left join valid_orders orders
    on orders.brand_id = mission.brand_id
    and orders.pharmacy_id = mission.pharmacy_id
    and orders.order_date > mission.mission_date - interval '30 days'
    and orders.order_date <= mission.mission_date + interval '90 days'
  group by mission.id, mission.mission_date
)
select
  mission.id as mission_id,
  mission.brand_id,
  mission.brand_pharmacy_id,
  mission.pharmacy_id,
  relation.territory_id,
  mission.assigned_user_id,
  mission.mission_type,
  mission.title as mission_title,
  mission.mission_date,
  mission.status as mission_status,
  mission.cost_actual_ht as mission_total_cost,
  report.units_sold as sell_out_units,
  case when report.units_sold > 0 and report.duration_minutes > 0
    then round(report.units_sold::numeric / (report.duration_minutes::numeric / 60), 2) end as sell_out_units_per_hour,
  report.customer_contacts as contacts_count,
  report.participant_count as participants_count,
  report.satisfaction_score as satisfaction,
  case when mission.cost_actual_ht > 0 and report.units_sold > 0
    then round(mission.cost_actual_ht / report.units_sold, 2) end as cost_per_unit,
  case when mission.cost_actual_ht > 0 and report.customer_contacts > 0
    then round(mission.cost_actual_ht / report.customer_contacts, 2) end as cost_per_contact,
  case when mission.cost_actual_ht > 0 and report.participant_count > 0
    then round(mission.cost_actual_ht / report.participant_count, 2) end as cost_per_participant,
  metrics.order_before_at,
  metrics.order_before_value,
  metrics.first_order_after_at,
  metrics.first_order_after_value,
  extract(day from metrics.first_order_after_at - mission.mission_date)::integer as days_to_first_order_after,
  metrics.revenue_30d_before,
  metrics.revenue_30d_after,
  metrics.revenue_60d_after,
  metrics.revenue_90d_after,
  metrics.orders_30d_after,
  metrics.orders_60d_after,
  metrics.orders_90d_after,
  (metrics.orders_before_count = 0 and metrics.first_order_after_at is not null) as first_order_observed_after_mission,
  metrics.reorder_observed_30d,
  metrics.reorder_observed_60d,
  metrics.reorder_observed_90d,
  (select snapshot.distribution_rate
    from public.brand_pharmacy_distribution_snapshots snapshot
    where snapshot.brand_pharmacy_id = mission.brand_pharmacy_id
      and snapshot.snapshot_date <= mission.mission_date::date
    order by snapshot.snapshot_date desc limit 1) as dn_before,
  (select snapshot.distribution_rate
    from public.brand_pharmacy_distribution_snapshots snapshot
    where snapshot.brand_pharmacy_id = mission.brand_pharmacy_id
      and snapshot.snapshot_date <= least(now(), mission.mission_date + interval '90 days')::date
    order by snapshot.snapshot_date desc limit 1) as dn_after,
  case when metrics.revenue_30d_before > 0 and mission.days_observed >= 30
    then round((metrics.revenue_30d_after - metrics.revenue_30d_before) / metrics.revenue_30d_before, 4) end
    as observed_revenue_change,
  private.mission_observation_maturity(mission.days_observed) as observation_maturity,
  private.mission_effectiveness(
    mission.days_observed, metrics.revenue_30d_before, metrics.revenue_30d_after,
    metrics.orders_30d_after, metrics.orders_60d_after,
    metrics.reorder_observed_30d, metrics.reorder_observed_60d
  ) as mission_effectiveness_status,
  exists (
    select 1 from completed_missions other
    where other.id <> mission.id
      and other.brand_pharmacy_id = mission.brand_pharmacy_id
      and other.mission_date > mission.mission_date - interval '30 days'
      and other.mission_date <= mission.mission_date + interval '90 days'
  ) as overlapping_missions,
  not exists (
    select 1 from public.interactions interaction
    where interaction.brand_id = mission.brand_id
      and interaction.brand_pharmacy_id = mission.brand_pharmacy_id
      and interaction.occurred_at > mission.mission_date
  ) and not exists (
    select 1 from public.tasks task
    where task.brand_id = mission.brand_id
      and task.brand_pharmacy_id = mission.brand_pharmacy_id
      and task.created_at > mission.mission_date
      and task.archived_at is null
      and task.status in ('open','in_progress')
  ) and mission.days_observed > settings.post_mission_followup_days as followup_recommended,
  case
    when mission.mission_date is null then 'insufficient'
    when mission.cost_actual_ht <= 0 and report.units_sold is null and report.customer_contacts is null and report.participant_count is null then 'insufficient'
    when mission.cost_actual_ht <= 0 or report.id is null
      or (mission.mission_type = 'animation' and report.units_sold is null)
      or exists (
        select 1 from completed_missions other
        where other.id <> mission.id and other.brand_pharmacy_id = mission.brand_pharmacy_id
          and other.mission_date > mission.mission_date - interval '30 days'
          and other.mission_date <= mission.mission_date + interval '90 days'
      ) then 'partial'
    else 'complete'
  end::public.mission_impact_data_quality as impact_data_quality,
  array_remove(array[
    case when mission.days_observed < 30 then 'Fenêtre J+30 encore incomplète' end,
    case when report.units_sold is not null then report.units_sold || ' unités déclarées pendant la mission' end,
    case when metrics.first_order_after_at is not null then 'Première commande observée ' || extract(day from metrics.first_order_after_at - mission.mission_date)::integer || ' jours après' end,
    case when metrics.reorder_observed_30d then 'Réassort observé sous 30 jours'
      when metrics.reorder_observed_60d then 'Réassort observé sous 60 jours' end,
    case when metrics.revenue_30d_before > 0 and mission.days_observed >= 30
      then 'Évolution du CA J+30 : ' || round(((metrics.revenue_30d_after - metrics.revenue_30d_before) / metrics.revenue_30d_before) * 100, 1) || ' %' end,
    case when metrics.orders_60d_after = 0 and mission.days_observed >= 60 then 'Aucune commande observée sous 60 jours' end,
    case when exists (
      select 1 from completed_missions other
      where other.id <> mission.id and other.brand_pharmacy_id = mission.brand_pharmacy_id
        and other.mission_date > mission.mission_date - interval '30 days'
        and other.mission_date <= mission.mission_date + interval '90 days'
    ) then 'Plusieurs interventions ont eu lieu pendant la période observée' end
  ]::text[], null) as mission_effectiveness_reasons,
  array_remove(array[
    case when mission.cost_actual_ht <= 0 then 'Coût mission absent' end,
    case when report.id is null then 'Rapport mission absent' end,
    case when mission.mission_type = 'animation' and report.units_sold is null then 'Sell-out absent' end,
    case when report.duration_minutes is null then 'Durée mission absente' end,
    case when exists (
      select 1 from completed_missions other
      where other.id <> mission.id and other.brand_pharmacy_id = mission.brand_pharmacy_id
        and other.mission_date > mission.mission_date - interval '30 days'
        and other.mission_date <= mission.mission_date + interval '90 days'
    ) then 'Missions chevauchantes' end
  ]::text[], null) as data_quality_reasons,
  case when mission.cost_actual_ht > 0 then round(
    (case
      when mission.days_observed < 30 then null
      when mission.days_observed >= 90 then metrics.revenue_90d_after
      when mission.days_observed >= 60 then metrics.revenue_60d_after
      else metrics.revenue_30d_after
    end) / mission.cost_actual_ht, 2
  ) end as observed_revenue_cost_ratio
from completed_missions mission
join order_metrics metrics on metrics.mission_id = mission.id
join public.brand_settings settings on settings.brand_id = mission.brand_id
join public.brand_pharmacies relation on relation.id = mission.brand_pharmacy_id
left join public.mission_reports report
  on report.mission_id = mission.id
  and report.report_status in ('submitted','validated')
  and report.archived_at is null;

create view public.mission_performance with (security_invoker = true) as
select
  mission.id as mission_id,
  mission.brand_id,
  mission.brand_pharmacy_id,
  mission.assigned_user_id,
  mission.mission_type,
  coalesce(mission.actual_start_at, mission.scheduled_start_at) as mission_date,
  mission.cost_actual_ht,
  coalesce(report.units_sold, 0) as units_sold_immediate,
  coalesce(report.net_sales_ttc, report.gross_sales_ttc) as reported_sell_out_ttc,
  coalesce(report.units_sold, 0)::numeric / nullif(report.duration_minutes / 60.0, 0) as units_per_hour,
  mission.cost_actual_ht / nullif(report.units_sold, 0) as cost_per_unit,
  mission.cost_actual_ht / nullif(report.customer_contacts, 0) as cost_per_contact,
  sum(orders.net_amount_ht) filter (
    where orders.order_date <= coalesce(mission.actual_end_at, mission.scheduled_end_at) + interval '7 days'
      and orders.order_date > coalesce(mission.actual_end_at, mission.scheduled_end_at)
  ) as order_revenue_7d_ht,
  sum(orders.net_amount_ht) filter (
    where orders.order_date <= coalesce(mission.actual_end_at, mission.scheduled_end_at) + interval '30 days'
      and orders.order_date > coalesce(mission.actual_end_at, mission.scheduled_end_at)
  ) as order_revenue_30d_ht,
  sum(orders.net_amount_ht) filter (
    where orders.order_date <= coalesce(mission.actual_end_at, mission.scheduled_end_at) + interval '60 days'
      and orders.order_date > coalesce(mission.actual_end_at, mission.scheduled_end_at)
  ) as order_revenue_60d_ht,
  sum(orders.net_amount_ht) filter (
    where orders.order_date <= coalesce(mission.actual_end_at, mission.scheduled_end_at) + interval '90 days'
      and orders.order_date > coalesce(mission.actual_end_at, mission.scheduled_end_at)
  ) as order_revenue_90d_ht,
  (select snapshot.distribution_rate from public.brand_pharmacy_distribution_snapshots snapshot
    where snapshot.brand_pharmacy_id = mission.brand_pharmacy_id
      and snapshot.snapshot_date <= coalesce(mission.actual_start_at, mission.scheduled_start_at)::date
    order by snapshot.snapshot_date desc limit 1) as dn_before,
  (select snapshot.distribution_rate from public.brand_pharmacy_distribution_snapshots snapshot
    where snapshot.brand_pharmacy_id = mission.brand_pharmacy_id
      and snapshot.snapshot_date <= (coalesce(mission.actual_end_at, mission.scheduled_end_at) + interval '30 days')::date
    order by snapshot.snapshot_date desc limit 1) as dn_after_30d,
  (select history.previous_activity_status from public.brand_pharmacy_activity_history history
    where history.brand_pharmacy_id = mission.brand_pharmacy_id
      and history.calculated_at <= coalesce(mission.actual_start_at, mission.scheduled_start_at)
    order by history.calculated_at desc limit 1) as activity_status_before,
  (select history.new_activity_status from public.brand_pharmacy_activity_history history
    where history.brand_pharmacy_id = mission.brand_pharmacy_id
      and history.calculated_at <= coalesce(mission.actual_end_at, mission.scheduled_end_at) + interval '30 days'
    order by history.calculated_at desc limit 1) as activity_status_after_30d,
  min(orders.order_date) filter (
    where orders.order_date > coalesce(mission.actual_end_at, mission.scheduled_end_at)
  ) as first_order_after_mission_at,
  extract(day from min(orders.order_date) filter (
    where orders.order_date > coalesce(mission.actual_end_at, mission.scheduled_end_at)
  ) - coalesce(mission.actual_end_at, mission.scheduled_end_at))::integer as days_to_first_order,
  case when settings.gross_margin_rate is not null and mission.cost_actual_ht > 0 then round(((
    coalesce(sum(orders.net_amount_ht) filter (
      where orders.order_date <= coalesce(mission.actual_end_at, mission.scheduled_end_at) + interval '30 days'
        and orders.order_date > coalesce(mission.actual_end_at, mission.scheduled_end_at)
    ), 0) * settings.gross_margin_rate / 100 - mission.cost_actual_ht
  ) / mission.cost_actual_ht) * 100, 2) end as roi_30d,
  case when settings.gross_margin_rate is not null and mission.cost_actual_ht > 0 then round(((
    coalesce(sum(orders.net_amount_ht) filter (
      where orders.order_date <= coalesce(mission.actual_end_at, mission.scheduled_end_at) + interval '90 days'
        and orders.order_date > coalesce(mission.actual_end_at, mission.scheduled_end_at)
    ), 0) * settings.gross_margin_rate / 100 - mission.cost_actual_ht
  ) / mission.cost_actual_ht) * 100, 2) end as roi_90d
from public.missions mission
left join public.mission_reports report
  on report.mission_id = mission.id and report.report_status in ('submitted','validated')
left join public.orders orders
  on orders.brand_pharmacy_id = mission.brand_pharmacy_id
  and private.order_counts_for_revenue(orders.order_status, orders.order_type, orders.net_amount_ht)
  and orders.archived_at is null
join public.brand_settings settings on settings.brand_id = mission.brand_id
where mission.archived_at is null
group by mission.id, report.id, settings.gross_margin_rate;

create or replace function public.get_mission_impact(target_mission_id uuid)
returns setof public.mission_impact
language sql stable security invoker set search_path = ''
as $$
  select impact.* from public.mission_impact impact
  where impact.mission_id = target_mission_id
    and private.can_access_mission(target_mission_id);
$$;

create or replace function public.get_recent_pharmacy_mission_impact(
  target_brand_pharmacy_id uuid,
  result_limit integer default 5
)
returns setof public.mission_impact
language sql stable security invoker set search_path = ''
as $$
  select impact.* from public.mission_impact impact
  where impact.brand_pharmacy_id = target_brand_pharmacy_id
    and private.can_access_brand_pharmacy(target_brand_pharmacy_id)
  order by impact.mission_date desc
  limit least(greatest(coalesce(result_limit, 5), 1), 20);
$$;

create or replace function public.get_mission_impact_dashboard(
  target_brand_id uuid,
  target_period_days integer default 90,
  target_mission_type public.mission_type default null,
  target_assigned_user_id uuid default null,
  target_brand_pharmacy_id uuid default null
)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user']) then
    raise exception 'Mission impact dashboard forbidden' using errcode = '42501';
  end if;
  with scoped as (
    select * from public.mission_impact impact
    where impact.brand_id = target_brand_id
      and impact.mission_date >= now() - make_interval(days => least(greatest(coalesce(target_period_days, 90), 30), 365))
      and (target_mission_type is null or impact.mission_type = target_mission_type)
      and (target_assigned_user_id is null or impact.assigned_user_id = target_assigned_user_id)
      and (target_brand_pharmacy_id is null or impact.brand_pharmacy_id = target_brand_pharmacy_id)
  )
  select jsonb_build_object(
    'missions_completed', count(*),
    'total_cost', coalesce(sum(mission_total_cost), 0),
    'sell_out_units', coalesce(sum(sell_out_units), 0),
    'average_mission_cost', coalesce(avg(mission_total_cost), 0),
    'cost_per_unit', case when sum(sell_out_units) > 0 then sum(mission_total_cost) / sum(sell_out_units) end,
    'order_rate_30d', case when count(*) filter (where observation_maturity <> 'early') > 0
      then round(count(*) filter (where orders_30d_after > 0)::numeric / count(*) filter (where observation_maturity <> 'early') * 100, 1) end,
    'order_rate_60d', case when count(*) filter (where observation_maturity in ('60d_complete','mature')) > 0
      then round(count(*) filter (where orders_60d_after > 0)::numeric / count(*) filter (where observation_maturity in ('60d_complete','mature')) * 100, 1) end,
    'reorder_rate_60d', case when count(*) filter (where observation_maturity in ('60d_complete','mature')) > 0
      then round(count(*) filter (where reorder_observed_60d)::numeric / count(*) filter (where observation_maturity in ('60d_complete','mature')) * 100, 1) end,
    'revenue_30d', coalesce(sum(revenue_30d_after), 0),
    'revenue_60d', coalesce(sum(revenue_60d_after), 0),
    'observed_revenue_cost_ratio', case when sum(mission_total_cost) > 0 then round(sum(revenue_60d_after) / sum(mission_total_cost), 2) end,
    'without_observable_result', count(*) filter (where mission_effectiveness_status = 'no_observable_result'),
    'to_review', count(*) filter (where followup_recommended or impact_data_quality <> 'complete')
  ) into result from scoped;
  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.get_mission_impacts(
  target_brand_id uuid,
  target_period_days integer default 90,
  target_mission_type public.mission_type default null,
  target_assigned_user_id uuid default null,
  target_brand_pharmacy_id uuid default null,
  target_territory_id uuid default null
)
returns setof public.mission_impact
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user']) then
    raise exception 'Mission impacts forbidden' using errcode = '42501';
  end if;
  return query
  select impact.* from public.mission_impact impact
  where impact.brand_id = target_brand_id
    and impact.mission_date >= now() - make_interval(days => least(greatest(coalesce(target_period_days, 90), 30), 365))
    and (target_mission_type is null or impact.mission_type = target_mission_type)
    and (target_assigned_user_id is null or impact.assigned_user_id = target_assigned_user_id)
    and (target_brand_pharmacy_id is null or impact.brand_pharmacy_id = target_brand_pharmacy_id)
    and (target_territory_id is null or impact.territory_id = target_territory_id)
  order by impact.mission_date desc
  limit 500;
end;
$$;

create or replace function public.get_mission_impact_dashboard_filtered(
  target_brand_id uuid,
  target_period_days integer default 90,
  target_mission_type public.mission_type default null,
  target_assigned_user_id uuid default null,
  target_brand_pharmacy_id uuid default null,
  target_territory_id uuid default null
)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user']) then
    raise exception 'Mission impact dashboard forbidden' using errcode = '42501';
  end if;
  with scoped as (
    select * from public.get_mission_impacts(
      target_brand_id, target_period_days, target_mission_type,
      target_assigned_user_id, target_brand_pharmacy_id, target_territory_id
    )
  )
  select jsonb_build_object(
    'missions_completed', count(*),
    'total_cost', coalesce(sum(mission_total_cost), 0),
    'sell_out_units', coalesce(sum(sell_out_units), 0),
    'average_mission_cost', coalesce(avg(mission_total_cost), 0),
    'cost_per_unit', case when sum(sell_out_units) > 0 then sum(mission_total_cost) / sum(sell_out_units) end,
    'order_rate_30d', case when count(*) filter (where observation_maturity <> 'early') > 0
      then round(count(*) filter (where orders_30d_after > 0)::numeric / count(*) filter (where observation_maturity <> 'early') * 100, 1) end,
    'order_rate_60d', case when count(*) filter (where observation_maturity in ('60d_complete','mature')) > 0
      then round(count(*) filter (where orders_60d_after > 0)::numeric / count(*) filter (where observation_maturity in ('60d_complete','mature')) * 100, 1) end,
    'reorder_rate_60d', case when count(*) filter (where observation_maturity in ('60d_complete','mature')) > 0
      then round(count(*) filter (where reorder_observed_60d)::numeric / count(*) filter (where observation_maturity in ('60d_complete','mature')) * 100, 1) end,
    'revenue_30d', coalesce(sum(revenue_30d_after), 0),
    'revenue_60d', coalesce(sum(revenue_60d_after), 0),
    'observed_revenue_cost_ratio', case when sum(mission_total_cost) > 0 then round(sum(revenue_60d_after) / sum(mission_total_cost), 2) end,
    'without_observable_result', count(*) filter (where mission_effectiveness_status = 'no_observable_result'),
    'to_review', count(*) filter (where followup_recommended or impact_data_quality <> 'complete')
  ) into result from scoped;
  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.get_mission_type_impact(
  target_brand_id uuid,
  target_period_days integer default 180
)
returns table (
  mission_type public.mission_type,
  sample_size bigint,
  average_cost numeric,
  average_sell_out numeric,
  cost_per_unit numeric,
  orders_observed bigint,
  average_days_to_order numeric,
  reorder_rate_60d numeric,
  revenue_60d numeric,
  observed_revenue_cost_ratio numeric,
  low_sample boolean
)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user']) then
    raise exception 'Mission type impact forbidden' using errcode = '42501';
  end if;
  return query
  select impact.mission_type, count(*), round(avg(impact.mission_total_cost), 2),
    round(avg(impact.sell_out_units), 2),
    case when sum(impact.sell_out_units) > 0 then round(sum(impact.mission_total_cost) / sum(impact.sell_out_units), 2) end,
    count(*) filter (where impact.first_order_after_at is not null),
    round(avg(impact.days_to_first_order_after), 1),
    case when count(*) filter (where impact.observation_maturity in ('60d_complete','mature')) > 0
      then round(count(*) filter (where impact.reorder_observed_60d)::numeric /
        count(*) filter (where impact.observation_maturity in ('60d_complete','mature')) * 100, 1) end,
    coalesce(sum(impact.revenue_60d_after), 0),
    case when sum(impact.mission_total_cost) > 0 then round(sum(impact.revenue_60d_after) / sum(impact.mission_total_cost), 2) end,
    count(*) < 5
  from public.mission_impact impact
  where impact.brand_id = target_brand_id
    and impact.mission_date >= now() - make_interval(days => least(greatest(coalesce(target_period_days, 180), 30), 365))
  group by impact.mission_type
  order by count(*) desc, impact.mission_type;
end;
$$;

create or replace function public.get_mission_assignee_impact(
  target_brand_id uuid,
  target_period_days integer default 180
)
returns table (
  assigned_user_id uuid,
  full_name text,
  missions_completed bigint,
  missions_total bigint,
  completion_rate numeric,
  average_sell_out numeric,
  average_contacts numeric,
  average_cost numeric,
  orders_observed bigint,
  average_days_to_order numeric,
  reorder_rate_60d numeric,
  complete_data_rate numeric
)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user']) then
    raise exception 'Mission assignee impact forbidden' using errcode = '42501';
  end if;
  return query
  select
    impact.assigned_user_id,
    coalesce(profile.full_name, 'Intervenant externe ou non affecté'),
    count(*),
    (
      select count(*) from public.missions mission
      where mission.brand_id = target_brand_id
        and mission.assigned_user_id is not distinct from impact.assigned_user_id
        and mission.archived_at is null
        and coalesce(mission.actual_end_at, mission.scheduled_end_at, mission.created_at)
          >= now() - make_interval(days => least(greatest(coalesce(target_period_days, 180), 30), 365))
    ),
    round(count(*)::numeric / nullif((
      select count(*) from public.missions mission
      where mission.brand_id = target_brand_id
        and mission.assigned_user_id is not distinct from impact.assigned_user_id
        and mission.archived_at is null
        and coalesce(mission.actual_end_at, mission.scheduled_end_at, mission.created_at)
          >= now() - make_interval(days => least(greatest(coalesce(target_period_days, 180), 30), 365))
    ), 0) * 100, 1),
    round(avg(impact.sell_out_units), 2),
    round(avg(impact.contacts_count), 2),
    round(avg(impact.mission_total_cost), 2),
    count(*) filter (where impact.first_order_after_at is not null),
    round(avg(impact.days_to_first_order_after), 1),
    case when count(*) filter (where impact.observation_maturity in ('60d_complete','mature')) > 0
      then round(count(*) filter (where impact.reorder_observed_60d)::numeric /
        count(*) filter (where impact.observation_maturity in ('60d_complete','mature')) * 100, 1) end,
    round(count(*) filter (where impact.impact_data_quality = 'complete')::numeric / count(*) * 100, 1)
  from public.mission_impact impact
  left join public.user_profiles profile on profile.user_id = impact.assigned_user_id
  where impact.brand_id = target_brand_id
    and impact.mission_date >= now() - make_interval(days => least(greatest(coalesce(target_period_days, 180), 30), 365))
  group by impact.assigned_user_id, profile.full_name
  order by count(*) desc, coalesce(profile.full_name, 'Intervenant externe ou non affecté');
end;
$$;

create or replace function public.get_missions_to_review(target_brand_id uuid)
returns setof public.mission_impact
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user']) then
    raise exception 'Mission review list forbidden' using errcode = '42501';
  end if;
  return query select impact.* from public.mission_impact impact
  where impact.brand_id = target_brand_id
    and (impact.followup_recommended or impact.impact_data_quality <> 'complete'
      or impact.mission_effectiveness_status = 'no_observable_result')
  order by impact.followup_recommended desc, impact.mission_date desc
  limit 100;
end;
$$;

grant usage on type public.mission_effectiveness_status, public.mission_observation_maturity,
  public.mission_impact_data_quality to authenticated, service_role;
grant select on public.mission_impact, public.mission_performance to authenticated, service_role;
grant execute on function private.order_counts_for_revenue(public.order_status,public.order_type,numeric)
to authenticated, service_role;

revoke all on function private.mission_observation_maturity(integer),
  private.mission_effectiveness(integer,numeric,numeric,integer,integer,boolean,boolean)
from public, anon;
grant execute on function private.mission_observation_maturity(integer),
  private.mission_effectiveness(integer,numeric,numeric,integer,integer,boolean,boolean)
to authenticated, service_role;

revoke all on function public.get_mission_impact(uuid),
  public.get_recent_pharmacy_mission_impact(uuid,integer),
  public.get_mission_impact_dashboard(uuid,integer,public.mission_type,uuid,uuid),
  public.get_mission_impacts(uuid,integer,public.mission_type,uuid,uuid,uuid),
  public.get_mission_impact_dashboard_filtered(uuid,integer,public.mission_type,uuid,uuid,uuid),
  public.get_mission_type_impact(uuid,integer),
  public.get_mission_assignee_impact(uuid,integer),
  public.get_missions_to_review(uuid)
from public, anon;
grant execute on function public.get_mission_impact(uuid),
  public.get_recent_pharmacy_mission_impact(uuid,integer),
  public.get_mission_impact_dashboard(uuid,integer,public.mission_type,uuid,uuid),
  public.get_mission_impacts(uuid,integer,public.mission_type,uuid,uuid,uuid),
  public.get_mission_impact_dashboard_filtered(uuid,integer,public.mission_type,uuid,uuid,uuid),
  public.get_mission_type_impact(uuid,integer),
  public.get_mission_assignee_impact(uuid,integer),
  public.get_missions_to_review(uuid)
to authenticated, service_role;

comment on view public.mission_impact is
  'Mesures descriptives observées avant et après mission. Elles ne constituent pas une attribution causale.';
