alter type public.product_event_name add value if not exists 'manager_commercial_dashboard_viewed';
alter type public.product_event_name add value if not exists 'commercial_priority_opened';
alter type public.product_event_name add value if not exists 'reorder_opportunity_opened';
alter type public.product_event_name add value if not exists 'reorder_followup_created';
alter type public.product_event_name add value if not exists 'first_reorder_viewed';
alter type public.product_event_name add value if not exists 'at_risk_account_opened';
alter type public.product_event_name add value if not exists 'dormant_account_opened';
alter type public.product_event_name add value if not exists 'commercial_health_viewed';

create type public.commercial_health_status as enum (
  'newly_implanted',
  'awaiting_first_reorder',
  'reorder_expected',
  'reorder_due_soon',
  'reorder_overdue',
  'healthy',
  'at_risk',
  'dormant',
  'insufficient_history'
);

create type public.revenue_trend_status as enum (
  'strong_growth',
  'growth',
  'stable',
  'decline',
  'strong_decline',
  'insufficient_data'
);

alter table public.brand_settings
  add column default_reorder_interval_days integer not null default 60
    check (default_reorder_interval_days between 1 and 365),
  add column first_reorder_target_days integer not null default 60
    check (first_reorder_target_days between 1 and 365),
  add column reorder_due_soon_days integer not null default 7
    check (reorder_due_soon_days between 1 and 90),
  add column at_risk_multiplier numeric(4,2) not null default 1.35
    check (at_risk_multiplier > 1 and at_risk_multiplier < 5),
  add column dormant_multiplier numeric(4,2) not null default 2.00
    check (dormant_multiplier > 1 and dormant_multiplier < 10),
  add column reorder_eligibility_days integer not null default 30
    check (reorder_eligibility_days between 1 and 365),
  add constraint brand_settings_reorder_multipliers_check
    check (at_risk_multiplier < dormant_multiplier),
  add constraint brand_settings_reorder_windows_check
    check (reorder_due_soon_days < first_reorder_target_days);

create or replace function private.resolve_commercial_health_status(
  orders_count integer,
  days_since_first_order integer,
  days_since_last_order integer,
  expected_interval_days integer,
  due_soon_days integer,
  first_reorder_days integer,
  risk_multiplier numeric,
  dormant_multiplier numeric
)
returns public.commercial_health_status
language sql immutable set search_path = ''
as $$
  select case
    when orders_count = 0 or days_since_last_order is null then 'insufficient_history'
    when orders_count = 1 and days_since_first_order <= due_soon_days then 'newly_implanted'
    when orders_count = 1 and days_since_first_order < first_reorder_days - due_soon_days then 'awaiting_first_reorder'
    when orders_count = 1 and days_since_first_order <= first_reorder_days then 'reorder_due_soon'
    when orders_count = 1 and days_since_first_order > first_reorder_days * dormant_multiplier then 'dormant'
    when orders_count = 1 and days_since_first_order > first_reorder_days * risk_multiplier then 'at_risk'
    when orders_count = 1 then 'reorder_overdue'
    when days_since_last_order > expected_interval_days * dormant_multiplier then 'dormant'
    when days_since_last_order > expected_interval_days * risk_multiplier then 'at_risk'
    when days_since_last_order > expected_interval_days then 'reorder_overdue'
    when days_since_last_order >= expected_interval_days - due_soon_days then 'reorder_due_soon'
    when orders_count >= 4 then 'healthy'
    else 'reorder_expected'
  end::public.commercial_health_status;
$$;

create or replace function private.resolve_revenue_trend(current_revenue numeric, previous_revenue numeric)
returns public.revenue_trend_status
language sql immutable set search_path = ''
as $$
  select case
    when coalesce(previous_revenue, 0) <= 0 then 'insufficient_data'
    when ((current_revenue - previous_revenue) / previous_revenue) * 100 > 20 then 'strong_growth'
    when ((current_revenue - previous_revenue) / previous_revenue) * 100 > 5 then 'growth'
    when ((current_revenue - previous_revenue) / previous_revenue) * 100 >= -5 then 'stable'
    when ((current_revenue - previous_revenue) / previous_revenue) * 100 >= -20 then 'decline'
    else 'strong_decline'
  end::public.revenue_trend_status;
$$;

create or replace function private.commercial_priority_score(
  health_status public.commercial_health_status,
  has_next_action boolean,
  priority_level public.priority_level,
  potential_level public.potential_level,
  revenue_trend public.revenue_trend_status,
  recent_mission_without_follow_up boolean
)
returns integer
language sql immutable set search_path = ''
as $$
  select least(100,
    case health_status
      when 'dormant' then 40
      when 'at_risk' then 35
      when 'reorder_overdue' then 30
      when 'awaiting_first_reorder' then 25
      when 'reorder_due_soon' then 25
      else 0
    end
    + case when not has_next_action then 20 else 0 end
    + case when priority_level = 'strategic' then 15 else 0 end
    + case when potential_level in ('high','very_high') then 15 else 0 end
    + case when revenue_trend in ('decline','strong_decline') then 10 else 0 end
    + case when recent_mission_without_follow_up then 10 else 0 end
  );
$$;

create or replace function private.commercial_priority_reasons(
  health_status public.commercial_health_status,
  has_next_action boolean,
  priority_level public.priority_level,
  potential_level public.potential_level,
  revenue_trend public.revenue_trend_status,
  recent_mission_without_follow_up boolean,
  expected_delay_days integer
)
returns jsonb
language sql immutable set search_path = ''
as $$
  select to_jsonb(array_remove(array[
    case health_status
      when 'dormant' then 'Compte dormant à réactiver'
      when 'at_risk' then 'Fréquence de commande fortement dégradée'
      when 'reorder_overdue' then 'Réassort en retard' || case when expected_delay_days > 0 then ' de ' || expected_delay_days || ' jours' else '' end
      when 'awaiting_first_reorder' then 'Premier réassort à sécuriser'
      when 'reorder_due_soon' then 'Réassort bientôt attendu'
      else null
    end,
    case when not has_next_action then 'Aucun suivi programmé' end,
    case when priority_level = 'strategic' then 'Compte stratégique' end,
    case when potential_level in ('high','very_high') then 'Fort potentiel commercial' end,
    case when revenue_trend in ('decline','strong_decline') then 'Chiffre d’affaires en baisse' end,
    case when recent_mission_without_follow_up then 'Mission récente sans suivi commercial' end
  ]::text[], null));
$$;

create or replace function private.commercial_recommendation(
  health_status public.commercial_health_status,
  has_next_action boolean
)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when health_status = 'dormant' then 'Évaluer une réactivation'
    when health_status in ('at_risk','reorder_overdue') then 'Contacter la pharmacie'
    when health_status in ('awaiting_first_reorder','newly_implanted') then 'Sécuriser le premier réassort'
    when health_status in ('reorder_due_soon','reorder_expected') then 'Préparer une relance'
    when not has_next_action then 'Programmer une prochaine action'
    else 'Maintenir le suivi'
  end;
$$;

create or replace view public.commercial_account_health
with (security_invoker = true) as
with valid_orders as (
  select
    o.id,
    o.brand_id,
    o.brand_pharmacy_id,
    o.order_date,
    o.net_amount_ht,
    o.created_at,
    row_number() over (
      partition by o.brand_pharmacy_id
      order by o.order_date, o.created_at, o.id
    ) as order_sequence,
    row_number() over (
      partition by o.brand_pharmacy_id
      order by o.order_date desc, o.created_at desc, o.id desc
    ) as reverse_sequence,
    lag(o.order_date) over (
      partition by o.brand_pharmacy_id
      order by o.order_date, o.created_at, o.id
    ) as previous_order_at
  from public.orders o
  where o.archived_at is null
    and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
), order_aggregates as (
  select
    brand_pharmacy_id,
    min(order_date) as first_order_at,
    max(order_date) as last_order_at,
    max(order_date) filter (where reverse_sequence = 2) as previous_order_at,
    min(order_date) filter (where order_sequence = 2) as first_reorder_at,
    count(*)::integer as orders_count,
    count(*) filter (where order_sequence > 1)::integer as reorder_count,
    round(avg(net_amount_ht), 2) as average_order_value,
    (array_agg(net_amount_ht order by order_date desc, created_at desc, id desc))[1] as last_order_value
  from valid_orders
  group by brand_pharmacy_id
), revenue_aggregates as (
  select
    brand_pharmacy_id,
    coalesce(sum(net_amount_ht), 0) as total_revenue,
    coalesce(sum(net_amount_ht) filter (where order_date >= now() - interval '30 days'), 0) as revenue_last_30d,
    coalesce(sum(net_amount_ht) filter (where order_date >= now() - interval '90 days'), 0) as revenue_last_90d,
    coalesce(sum(net_amount_ht) filter (
      where order_date < now() - interval '90 days'
        and order_date >= now() - interval '180 days'
    ), 0) as revenue_previous_90d
  from public.orders
  where archived_at is null
    and private.order_counts_for_revenue(order_status, order_type, net_amount_ht)
  group by brand_pharmacy_id
), interval_aggregates as (
  select
    brand_pharmacy_id,
    count(*) filter (where order_date::date > previous_order_at::date)::integer as interval_count,
    round(avg(order_date::date - previous_order_at::date) filter (
      where order_date::date > previous_order_at::date
    ), 1) as average_interval_days,
    round(percentile_cont(0.5) within group (
      order by order_date::date - previous_order_at::date
    ) filter (where order_date::date > previous_order_at::date))::integer as median_interval_days
  from valid_orders
  where previous_order_at is not null
  group by brand_pharmacy_id
), interaction_aggregates as (
  select brand_pharmacy_id, max(occurred_at) as last_interaction_at
  from public.interactions
  where archived_at is null
  group by brand_pharmacy_id
), mission_aggregates as (
  select brand_pharmacy_id, max(coalesce(actual_end_at, completed_at, scheduled_end_at)) as last_mission_at
  from public.missions
  where status = 'completed' and archived_at is null
  group by brand_pharmacy_id
), task_state as (
  select brand_pharmacy_id,
    bool_or(status in ('open','in_progress') and archived_at is null) as has_next_action,
    min(due_at) filter (where status in ('open','in_progress') and archived_at is null) as next_action_at
  from public.tasks
  group by brand_pharmacy_id
), base as (
  select
    bp.id as brand_pharmacy_id,
    bp.brand_id,
    bp.pharmacy_id,
    coalesce(p.trade_name, p.legal_name) as pharmacy_name,
    p.address_line_1,
    p.postal_code,
    p.city,
    bp.territory_id,
    territory.name as territory_name,
    bp.current_agent_user_id,
    agent.full_name as agent_name,
    bp.commercial_status,
    bp.priority_level,
    bp.potential_level,
    coalesce(oa.first_order_at, bp.first_valid_order_at) as first_order_at,
    oa.last_order_at,
    oa.previous_order_at,
    oa.first_reorder_at,
    coalesce(oa.orders_count, 0) as orders_count,
    coalesce(oa.reorder_count, 0) as reorder_count,
    case
      when oa.first_reorder_at is null or oa.first_order_at is null then null
      else oa.first_reorder_at::date - oa.first_order_at::date
    end as days_to_first_reorder,
    case when oa.last_order_at is null then null else current_date - oa.last_order_at::date end as days_since_last_order,
    case when oa.first_order_at is null then null else current_date - oa.first_order_at::date end as days_since_first_order,
    ia.average_interval_days as average_reorder_interval_days,
    ia.median_interval_days as median_reorder_interval_days,
    case
      when coalesce(ia.interval_count, 0) >= 3 then greatest(1, ia.median_interval_days)
      when coalesce(ia.interval_count, 0) > 0 then greatest(1, round(ia.average_interval_days)::integer)
      else settings.default_reorder_interval_days
    end as expected_interval_days,
    case
      when coalesce(ia.interval_count, 0) >= 3 then 'median'
      when coalesce(ia.interval_count, 0) > 0 then 'average'
      else 'brand_fallback'
    end as interval_source,
    coalesce(oa.average_order_value, 0) as average_order_value,
    coalesce(oa.last_order_value, 0) as last_order_value,
    coalesce(ra.total_revenue, 0) as total_revenue,
    coalesce(ra.revenue_last_30d, 0) as revenue_last_30d,
    coalesce(ra.revenue_last_90d, 0) as revenue_last_90d,
    coalesce(ra.revenue_previous_90d, 0) as revenue_previous_90d,
    private.resolve_revenue_trend(
      coalesce(ra.revenue_last_90d, 0),
      coalesce(ra.revenue_previous_90d, 0)
    ) as revenue_trend,
    case
      when coalesce(ra.revenue_previous_90d, 0) <= 0 then null
      else round(((ra.revenue_last_90d - ra.revenue_previous_90d) / ra.revenue_previous_90d) * 100, 1)
    end as revenue_trend_percent,
    coalesce(ts.has_next_action, false) as has_next_action,
    ts.next_action_at,
    iact.last_interaction_at,
    ma.last_mission_at,
    ma.last_mission_at >= now() - interval '30 days'
      and (iact.last_interaction_at is null or iact.last_interaction_at < ma.last_mission_at)
      as recent_mission_without_follow_up,
    settings.first_reorder_target_days,
    settings.reorder_due_soon_days,
    settings.at_risk_multiplier,
    settings.dormant_multiplier,
    settings.reorder_eligibility_days
  from public.brand_pharmacies bp
  join public.pharmacies p on p.id = bp.pharmacy_id
  join public.brand_settings settings on settings.brand_id = bp.brand_id
  left join public.territories territory on territory.id = bp.territory_id
  left join public.user_profiles agent on agent.user_id = bp.current_agent_user_id
  left join order_aggregates oa on oa.brand_pharmacy_id = bp.id
  left join revenue_aggregates ra on ra.brand_pharmacy_id = bp.id
  left join interval_aggregates ia on ia.brand_pharmacy_id = bp.id
  left join interaction_aggregates iact on iact.brand_pharmacy_id = bp.id
  left join mission_aggregates ma on ma.brand_pharmacy_id = bp.id
  left join task_state ts on ts.brand_pharmacy_id = bp.id
  where bp.archived_at is null
), classified as (
  select base.*,
    case
      when orders_count = 0 then null
      when orders_count = 1 then first_order_at + make_interval(days => first_reorder_target_days)
      else last_order_at + make_interval(days => expected_interval_days)
    end as expected_reorder_at,
    private.resolve_commercial_health_status(
      orders_count,
      days_since_first_order,
      days_since_last_order,
      expected_interval_days,
      reorder_due_soon_days,
      first_reorder_target_days,
      at_risk_multiplier,
      dormant_multiplier
    ) as health_status
  from base
)
select
  classified.*,
  case
    when expected_reorder_at is null then null
    else current_date - expected_reorder_at::date
  end as expected_reorder_delay_days,
  first_order_at + make_interval(days => first_reorder_target_days) as first_reorder_target_at,
  (first_reorder_at is not null) as first_reorder_completed,
  private.commercial_priority_score(
    health_status,
    has_next_action,
    priority_level,
    potential_level,
    revenue_trend,
    recent_mission_without_follow_up
  ) as priority_score,
  private.commercial_priority_reasons(
    health_status,
    has_next_action,
    priority_level,
    potential_level,
    revenue_trend,
    recent_mission_without_follow_up,
    case when expected_reorder_at is null then null else current_date - expected_reorder_at::date end
  ) as priority_reasons,
  private.commercial_recommendation(health_status, has_next_action) as recommendation
from classified;

create index if not exists missions_health_relation_idx
  on public.missions(brand_pharmacy_id, completed_at desc)
  where status = 'completed' and archived_at is null;

create or replace function public.get_commercial_priorities(
  target_brand_id uuid,
  target_filter text default null,
  result_limit integer default 100
)
returns setof public.commercial_account_health
language sql stable security invoker set search_path = ''
as $$
  select health.*
  from public.commercial_account_health health
  where health.brand_id = target_brand_id
    and private.can_access_brand(target_brand_id)
    and (
      target_filter is null
      or target_filter = ''
      or (target_filter = 'first_reorder' and health.orders_count = 1)
      or (target_filter = 'reorder_overdue' and health.health_status = 'reorder_overdue')
      or (target_filter = 'at_risk' and health.health_status = 'at_risk')
      or (target_filter = 'dormant' and health.health_status = 'dormant')
      or (target_filter = 'strategic' and health.priority_level = 'strategic')
      or (target_filter = 'without_action' and not health.has_next_action)
      or (target_filter = 'high_potential' and health.potential_level in ('high','very_high'))
    )
  order by health.priority_score desc, health.expected_reorder_delay_days desc nulls last, health.pharmacy_name
  limit least(greatest(coalesce(result_limit, 100), 1), 500);
$$;

create or replace function public.get_commercial_health(target_brand_pharmacy_id uuid)
returns setof public.commercial_account_health
language sql stable security invoker set search_path = ''
as $$
  select health.*
  from public.commercial_account_health health
  where health.brand_pharmacy_id = target_brand_pharmacy_id
    and private.can_access_brand_pharmacy(target_brand_pharmacy_id);
$$;

create or replace function public.get_agent_reorder_opportunities(
  target_brand_id uuid,
  result_limit integer default 5
)
returns setof public.commercial_account_health
language sql stable security invoker set search_path = ''
as $$
  select health.*
  from public.commercial_account_health health
  where health.brand_id = target_brand_id
    and private.can_access_brand(target_brand_id)
    and health.health_status in (
      'awaiting_first_reorder','reorder_due_soon','reorder_overdue','at_risk','dormant'
    )
  order by health.priority_score desc, health.expected_reorder_delay_days desc nulls last
  limit least(greatest(coalesce(result_limit, 5), 1), 5);
$$;

create or replace function public.get_commercial_dashboard(
  target_brand_id uuid,
  target_period_days integer default 90,
  target_agent_id uuid default null,
  target_territory_id uuid default null,
  target_commercial_status public.commercial_status default null
)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  result jsonb;
  period_days integer := least(greatest(coalesce(target_period_days, 90), 7), 365);
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user']) then
    raise exception 'Commercial dashboard forbidden' using errcode = '42501';
  end if;
  with scoped_health as (
    select *
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and (target_agent_id is null or health.current_agent_user_id = target_agent_id)
      and (target_territory_id is null or health.territory_id = target_territory_id)
      and (target_commercial_status is null or health.commercial_status = target_commercial_status)
  ), period_orders as (
    select orders.*
    from public.orders orders
    join scoped_health health on health.brand_pharmacy_id = orders.brand_pharmacy_id
    where orders.archived_at is null
      and private.order_counts_for_revenue(orders.order_status, orders.order_type, orders.net_amount_ht)
  ), period_metrics as (
    select
      coalesce(sum(net_amount_ht) filter (
        where order_date >= now() - make_interval(days => period_days)
      ), 0) as current_revenue,
      coalesce(sum(net_amount_ht) filter (
        where order_date < now() - make_interval(days => period_days)
          and order_date >= now() - make_interval(days => period_days * 2)
      ), 0) as previous_revenue,
      count(*) filter (
        where order_date >= now() - make_interval(days => period_days)
      )::integer as orders_count,
      round(avg(net_amount_ht) filter (
        where order_date >= now() - make_interval(days => period_days)
      ), 2) as average_order_value
    from period_orders
  )
  select jsonb_build_object(
    'period_days', period_days,
    'current_revenue', metrics.current_revenue,
    'previous_revenue', metrics.previous_revenue,
    'revenue_change_percent', case when metrics.previous_revenue = 0 then null else round(((metrics.current_revenue - metrics.previous_revenue) / metrics.previous_revenue) * 100, 1) end,
    'orders_count', metrics.orders_count,
    'average_order_value', coalesce(metrics.average_order_value, 0),
    'active_pharmacies', count(*) filter (where health.health_status not in ('dormant','insufficient_history')),
    'reorder_rate', round(
      count(*) filter (where health.reorder_count > 0 and health.days_since_first_order >= health.reorder_eligibility_days) * 100.0
      / nullif(count(*) filter (where health.orders_count > 0 and health.days_since_first_order >= health.reorder_eligibility_days), 0),
      1
    ),
    'first_reorder_rate', round(
      count(*) filter (where health.first_reorder_completed and health.days_since_first_order >= health.reorder_eligibility_days) * 100.0
      / nullif(count(*) filter (where health.orders_count > 0 and health.days_since_first_order >= health.reorder_eligibility_days), 0),
      1
    ),
    'average_days_to_first_reorder', round(avg(health.days_to_first_reorder) filter (where health.days_to_first_reorder is not null), 1),
    'reorder_overdue_count', count(*) filter (where health.health_status = 'reorder_overdue'),
    'first_reorder_count', count(*) filter (where health.orders_count = 1),
    'at_risk_count', count(*) filter (where health.health_status = 'at_risk'),
    'dormant_count', count(*) filter (where health.health_status = 'dormant'),
    'without_action_count', count(*) filter (where not health.has_next_action),
    'strategic_without_action_count', count(*) filter (where health.priority_level = 'strategic' and not health.has_next_action)
  ) into result
  from scoped_health health
  cross join period_metrics metrics
  group by metrics.current_revenue, metrics.previous_revenue, metrics.orders_count, metrics.average_order_value;
  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.update_commercial_health_settings(
  target_brand_id uuid,
  target_default_interval_days integer,
  target_first_reorder_days integer,
  target_due_soon_days integer,
  target_at_risk_multiplier numeric,
  target_dormant_multiplier numeric,
  target_eligibility_days integer
)
returns public.brand_settings
language plpgsql security invoker set search_path = ''
as $$
declare
  updated_settings public.brand_settings;
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Commercial settings forbidden' using errcode = '42501';
  end if;
  update public.brand_settings set
    default_reorder_interval_days = target_default_interval_days,
    first_reorder_target_days = target_first_reorder_days,
    reorder_due_soon_days = target_due_soon_days,
    at_risk_multiplier = target_at_risk_multiplier,
    dormant_multiplier = target_dormant_multiplier,
    reorder_eligibility_days = target_eligibility_days
  where brand_id = target_brand_id
  returning * into updated_settings;
  if updated_settings.brand_id is null then
    raise exception 'Commercial settings unavailable' using errcode = '42501';
  end if;
  return updated_settings;
end;
$$;

grant usage on type public.commercial_health_status, public.revenue_trend_status to authenticated, service_role;
grant select on public.commercial_account_health to authenticated, service_role;

revoke all on function private.resolve_commercial_health_status(integer,integer,integer,integer,integer,integer,numeric,numeric),
  private.resolve_revenue_trend(numeric,numeric),
  private.commercial_priority_score(public.commercial_health_status,boolean,public.priority_level,public.potential_level,public.revenue_trend_status,boolean),
  private.commercial_priority_reasons(public.commercial_health_status,boolean,public.priority_level,public.potential_level,public.revenue_trend_status,boolean,integer),
  private.commercial_recommendation(public.commercial_health_status,boolean)
from public, anon, authenticated;

grant execute on function private.resolve_commercial_health_status(integer,integer,integer,integer,integer,integer,numeric,numeric),
  private.resolve_revenue_trend(numeric,numeric),
  private.commercial_priority_score(public.commercial_health_status,boolean,public.priority_level,public.potential_level,public.revenue_trend_status,boolean),
  private.commercial_priority_reasons(public.commercial_health_status,boolean,public.priority_level,public.potential_level,public.revenue_trend_status,boolean,integer),
  private.commercial_recommendation(public.commercial_health_status,boolean)
to authenticated, service_role;

revoke all on function public.get_commercial_priorities(uuid,text,integer),
  public.get_commercial_health(uuid),
  public.get_agent_reorder_opportunities(uuid,integer),
  public.get_commercial_dashboard(uuid,integer,uuid,uuid,public.commercial_status),
  public.update_commercial_health_settings(uuid,integer,integer,integer,numeric,numeric,integer)
from public, anon;

grant execute on function public.get_commercial_priorities(uuid,text,integer),
  public.get_commercial_health(uuid),
  public.get_agent_reorder_opportunities(uuid,integer),
  public.get_commercial_dashboard(uuid,integer,uuid,uuid,public.commercial_status),
  public.update_commercial_health_settings(uuid,integer,integer,integer,numeric,numeric,integer)
to authenticated, service_role;
