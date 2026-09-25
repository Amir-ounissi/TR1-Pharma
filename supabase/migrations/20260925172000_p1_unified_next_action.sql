-- P1 workflow terrain: unify "next action" across tasks, field visits and missions.
-- brand_pharmacies.next_action_* remains the read-optimized cache used by existing screens.

create or replace function private.sync_brand_pharmacy_next_action(target_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_action record;
begin
  if target_relation_id is null then
    return;
  end if;

  select candidate.action_type, candidate.action_at, candidate.owner_id
  into next_action
  from (
    select
      t.task_type::text as action_type,
      t.due_at as action_at,
      t.assigned_to as owner_id,
      1 as source_rank,
      t.created_at as created_at
    from public.tasks t
    where t.brand_pharmacy_id = target_relation_id
      and t.status in ('open','in_progress')
      and t.archived_at is null

    union all

    select
      case v.visit_kind
        when 'client_visit' then 'commercial_visit'
        when 'prospecting' then 'prospecting_visit'
        when 'relationship' then 'relationship_visit'
        when 'training' then 'training'
        else 'visit'
      end as action_type,
      v.scheduled_start_at as action_at,
      v.owner_user_id as owner_id,
      2 as source_rank,
      v.created_at as created_at
    from public.field_visit_brands fvb
    join public.field_visits v on v.id = fvb.visit_id
    where fvb.brand_pharmacy_id = target_relation_id
      and v.status in ('planned','confirmed','in_progress')
      and v.archived_at is null

    union all

    select
      case
        when m.status = 'report_pending' then 'report_pending'
        else m.mission_type::text
      end as action_type,
      case
        when m.status = 'report_pending' then coalesce(m.report_due_at, m.scheduled_end_at, m.scheduled_start_at)
        else m.scheduled_start_at
      end as action_at,
      m.assigned_user_id as owner_id,
      3 as source_rank,
      m.created_at as created_at
    from public.missions m
    where m.brand_pharmacy_id = target_relation_id
      and m.status in ('assigned','accepted','scheduled','in_progress','report_pending')
      and m.archived_at is null
  ) candidate
  order by candidate.action_at asc nulls last, candidate.source_rank, candidate.created_at
  limit 1;

  update public.brand_pharmacies bp
  set
    next_action_type = next_action.action_type,
    next_action_at = next_action.action_at,
    next_action_owner_id = next_action.owner_id
  where bp.id = target_relation_id;
end;
$$;

create or replace function private.sync_field_visit_next_actions_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation record;
  target_visit_id uuid := coalesce(new.id, old.id);
begin
  for relation in
    select distinct fvb.brand_pharmacy_id
    from public.field_visit_brands fvb
    where fvb.visit_id = target_visit_id
  loop
    perform private.sync_brand_pharmacy_next_action(relation.brand_pharmacy_id);
  end loop;
  return coalesce(new, old);
end;
$$;

create or replace function private.sync_field_visit_brand_next_action_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' and old.brand_pharmacy_id is not null then
    perform private.sync_brand_pharmacy_next_action(old.brand_pharmacy_id);
  end if;

  if tg_op <> 'DELETE'
     and new.brand_pharmacy_id is not null
     and (tg_op = 'INSERT' or new.brand_pharmacy_id is distinct from old.brand_pharmacy_id) then
    perform private.sync_brand_pharmacy_next_action(new.brand_pharmacy_id);
  end if;

  if tg_op = 'UPDATE'
     and new.brand_pharmacy_id = old.brand_pharmacy_id then
    perform private.sync_brand_pharmacy_next_action(new.brand_pharmacy_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.sync_mission_next_action_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' and old.brand_pharmacy_id is not null then
    perform private.sync_brand_pharmacy_next_action(old.brand_pharmacy_id);
  end if;

  if tg_op <> 'DELETE'
     and new.brand_pharmacy_id is not null
     and (tg_op = 'INSERT' or new.brand_pharmacy_id is distinct from old.brand_pharmacy_id) then
    perform private.sync_brand_pharmacy_next_action(new.brand_pharmacy_id);
  end if;

  if tg_op = 'UPDATE'
     and new.brand_pharmacy_id = old.brand_pharmacy_id
     and new.brand_pharmacy_id is not null then
    perform private.sync_brand_pharmacy_next_action(new.brand_pharmacy_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_field_visit_next_actions on public.field_visits;
create trigger sync_field_visit_next_actions
after insert or update or delete on public.field_visits
for each row execute function private.sync_field_visit_next_actions_trigger();

drop trigger if exists sync_field_visit_brand_next_action on public.field_visit_brands;
create trigger sync_field_visit_brand_next_action
after insert or update or delete on public.field_visit_brands
for each row execute function private.sync_field_visit_brand_next_action_trigger();

drop trigger if exists sync_mission_next_action on public.missions;
create trigger sync_mission_next_action
after insert or update or delete on public.missions
for each row execute function private.sync_mission_next_action_trigger();

revoke all on function private.sync_brand_pharmacy_next_action(uuid) from public, anon, authenticated;
revoke all on function private.sync_field_visit_next_actions_trigger() from public, anon, authenticated;
revoke all on function private.sync_field_visit_brand_next_action_trigger() from public, anon, authenticated;
revoke all on function private.sync_mission_next_action_trigger() from public, anon, authenticated;

create index if not exists missions_next_action_relation_idx
  on public.missions(brand_pharmacy_id, scheduled_start_at)
  where archived_at is null
    and status in ('assigned','accepted','scheduled','in_progress','report_pending');

do $$
declare
  relation record;
begin
  for relation in
    select id
    from public.brand_pharmacies
    where archived_at is null
  loop
    perform private.sync_brand_pharmacy_next_action(relation.id);
  end loop;
end;
$$;

-- HubSpot meetings historically stored the meeting title but left the visit objective empty.
-- Fill only missing imported objectives; never overwrite an explicit field objective.
update public.field_visits
set objective = case visit_kind
  when 'client_visit' then 'Suivi commercial'
  when 'prospecting' then 'Prospection'
  when 'relationship' then 'Suivi relationnel'
  when 'training' then 'Formation équipe'
  else 'Suivi commercial'
end
where source = 'import'
  and nullif(btrim(objective), '') is null;

update public.field_visit_brands fvb
set objective = fv.objective
from public.field_visits fv
where fv.id = fvb.visit_id
  and fv.source = 'import'
  and nullif(btrim(fvb.objective), '') is null
  and nullif(btrim(fv.objective), '') is not null;

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
  select
    bp.id as brand_pharmacy_id,
    (bp.next_action_type is not null or bp.next_action_at is not null) as has_next_action,
    bp.next_action_at
  from public.brand_pharmacies bp
  where bp.archived_at is null
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

create or replace view public.commercial_pipeline
with (security_invoker = true) as
select
  bp.id,
  bp.brand_id,
  bp.pharmacy_id,
  bp.commercial_status,
  bp.priority_level,
  bp.potential_level,
  bp.current_agent_user_id,
  bp.territory_id,
  p.trade_name,
  p.legal_name,
  p.city,
  p.postal_code,
  up.full_name as agent_name,
  bp.last_interaction_at,
  bp.next_action_type,
  bp.next_action_at,
  bp.next_action_owner_id,
  (bp.next_action_at < now()) as is_overdue,
  (bp.next_action_type is null and bp.next_action_at is null) as has_no_next_action
from public.brand_pharmacies bp
join public.pharmacies p on p.id = bp.pharmacy_id
left join public.user_profiles up on up.user_id = bp.current_agent_user_id
where bp.archived_at is null;
