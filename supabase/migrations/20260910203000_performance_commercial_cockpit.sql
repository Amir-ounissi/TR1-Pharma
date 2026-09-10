-- Commercial performance cockpit: revenue, orders, basket, assortment breadth and drill-downs.
-- All metrics are computed from existing operational data; no synthetic KPI is introduced.

create or replace function public.get_commercial_performance_cockpit(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date,
  target_territory_id uuid default null,
  target_agent_id uuid default null,
  target_group_type public.pharmacy_group_type default null,
  target_group_id uuid default null,
  target_potential_level public.potential_level default null,
  target_priority_level public.priority_level default null,
  target_product_id uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  result jsonb;
begin
  if target_period_end < target_period_start then
    raise exception 'Invalid performance period' using errcode = '22007';
  end if;

  if not private.performance_scope_allowed(target_brand_id, target_agent_id, target_territory_id) then
    raise exception 'Commercial performance cockpit forbidden' using errcode = '42501';
  end if;

  with recursive territory_scope as (
    select t.id
    from public.territories t
    where target_territory_id is not null
      and t.id = target_territory_id
      and t.brand_id = target_brand_id
      and t.archived_at is null
    union all
    select child.id
    from public.territories child
    join territory_scope parent on child.parent_territory_id = parent.id
    where child.brand_id = target_brand_id
      and child.archived_at is null
  ), scoped_relations as (
    select
      bp.id as brand_pharmacy_id,
      bp.pharmacy_id,
      bp.territory_id,
      bp.current_agent_user_id,
      bp.potential_level,
      bp.priority_level,
      p.trade_name,
      p.legal_name,
      p.city,
      p.postal_code,
      p.pharmacy_group_id,
      pg.name as group_name,
      coalesce(pg.group_type, 'independent'::public.pharmacy_group_type) as group_type
    from public.brand_pharmacies bp
    join public.pharmacies p on p.id = bp.pharmacy_id
    left join public.pharmacy_groups pg on pg.id = p.pharmacy_group_id and pg.archived_at is null
    where bp.brand_id = target_brand_id
      and bp.archived_at is null
      and p.archived_at is null
      and p.is_active
      and (
        target_territory_id is null
        or bp.territory_id in (select territory_scope.id from territory_scope)
      )
      and (target_agent_id is null or bp.current_agent_user_id = target_agent_id)
      and (target_group_type is null or coalesce(pg.group_type, 'independent'::public.pharmacy_group_type) = target_group_type)
      and (target_group_id is null or p.pharmacy_group_id = target_group_id)
      and (target_potential_level is null or bp.potential_level = target_potential_level)
      and (target_priority_level is null or bp.priority_level = target_priority_level)
  ), realized_orders as (
    select
      f.order_id,
      f.brand_pharmacy_id,
      f.pharmacy_id,
      f.order_date,
      f.net_amount_ht,
      f.is_initial_order,
      f.is_reorder,
      f.territory_id,
      f.agent_user_id_at_order,
      sr.group_type,
      sr.group_name,
      sr.potential_level,
      sr.priority_level,
      sr.trade_name,
      sr.legal_name,
      sr.city,
      sr.postal_code
    from public.performance_order_facts f
    join scoped_relations sr on sr.brand_pharmacy_id = f.brand_pharmacy_id
    where f.brand_id = target_brand_id
      and f.order_date >= target_period_start::timestamptz
      and f.order_date < (target_period_end + 1)::timestamptz
      and (target_agent_id is null or f.agent_user_id_at_order = target_agent_id)
      and (
        target_product_id is null
        or exists (
          select 1 from public.order_items oi
          where oi.order_id = f.order_id and oi.product_id = target_product_id
        )
      )
  ), order_rollup as (
    select
      ro.order_id,
      ro.brand_pharmacy_id,
      ro.pharmacy_id,
      ro.order_date,
      ro.net_amount_ht as basket_revenue_ht,
      case
        when target_product_id is null then ro.net_amount_ht
        else coalesce(sum(oi.line_total_ht) filter (where oi.product_id = target_product_id), 0)
      end as scoped_revenue_ht,
      coalesce(sum(oi.quantity), 0) as paid_units,
      coalesce(sum(oi.free_quantity), 0) as free_units,
      count(distinct oi.product_id) as sku_count,
      ro.is_initial_order,
      ro.is_reorder,
      ro.territory_id,
      ro.agent_user_id_at_order,
      ro.group_type,
      ro.group_name,
      ro.potential_level,
      ro.priority_level,
      ro.trade_name,
      ro.legal_name,
      ro.city,
      ro.postal_code
    from realized_orders ro
    left join public.order_items oi on oi.order_id = ro.order_id
    group by
      ro.order_id, ro.brand_pharmacy_id, ro.pharmacy_id, ro.order_date, ro.net_amount_ht,
      ro.is_initial_order, ro.is_reorder, ro.territory_id, ro.agent_user_id_at_order,
      ro.group_type, ro.group_name, ro.potential_level, ro.priority_level,
      ro.trade_name, ro.legal_name, ro.city, ro.postal_code
  ), booked_orders as (
    select f.*
    from public.performance_booked_order_facts f
    join scoped_relations sr on sr.brand_pharmacy_id = f.brand_pharmacy_id
    where f.brand_id = target_brand_id
      and f.order_date >= target_period_start::timestamptz
      and f.order_date < (target_period_end + 1)::timestamptz
      and (target_agent_id is null or f.agent_user_id_at_order = target_agent_id)
      and (
        target_product_id is null
        or exists (
          select 1 from public.order_items oi
          where oi.order_id = f.order_id and oi.product_id = target_product_id
        )
      )
  ), booked_metrics as (
    select
      coalesce(sum(
        case when target_product_id is null then bo.net_amount_ht
        else coalesce((select sum(oi.line_total_ht) from public.order_items oi where oi.order_id = bo.order_id and oi.product_id = target_product_id), 0)
        end
      ), 0) as booked_revenue_ht,
      count(*) as booked_orders_count
    from booked_orders bo
  ), visits as (
    select i.id, i.brand_pharmacy_id, i.user_id, i.occurred_at
    from public.interactions i
    join scoped_relations sr on sr.brand_pharmacy_id = i.brand_pharmacy_id
    where i.brand_id = target_brand_id
      and i.kind = 'visit'
      and i.occurred_at >= target_period_start::timestamptz
      and i.occurred_at < (target_period_end + 1)::timestamptz
      and (target_agent_id is null or i.user_id = target_agent_id)
  ), summary_metrics as (
    select
      coalesce(sum(o.scoped_revenue_ht), 0) as revenue_ht,
      count(*) as orders_count,
      count(distinct o.brand_pharmacy_id) as ordering_pharmacies,
      round(avg(o.basket_revenue_ht), 2) as average_order_value_ht,
      round(avg(o.sku_count), 2) as average_skus_per_order,
      round(avg(o.paid_units), 2) as average_paid_units_per_order,
      coalesce(sum(o.paid_units), 0) as paid_units,
      coalesce(sum(o.free_units), 0) as free_units,
      count(*) filter (where o.is_initial_order) as initial_orders,
      count(*) filter (where o.is_reorder) as reorders,
      case when count(distinct o.brand_pharmacy_id) = 0 then null
        else round(count(*)::numeric / count(distinct o.brand_pharmacy_id), 2)
      end as orders_per_ordering_pharmacy
    from order_rollup o
  ), visit_metrics as (
    select
      count(*) as visits_count,
      count(distinct v.brand_pharmacy_id) as visited_pharmacies,
      count(distinct v.brand_pharmacy_id) filter (
        where exists (select 1 from order_rollup o where o.brand_pharmacy_id = v.brand_pharmacy_id)
      ) as visited_and_ordering_pharmacies
    from visits v
  ), product_breakdown as (
    select
      oi.product_id,
      p.name as product_name,
      p.sku,
      count(distinct ro.order_id) as orders_count,
      count(distinct ro.brand_pharmacy_id) as ordering_pharmacies,
      coalesce(sum(oi.quantity), 0) as paid_units,
      coalesce(sum(oi.free_quantity), 0) as free_units,
      coalesce(sum(oi.line_total_ht), 0) as revenue_ht,
      case when (select count(*) from order_rollup) = 0 then null
        else round(count(distinct ro.order_id) * 100.0 / (select count(*) from order_rollup), 1)
      end as order_penetration_rate
    from realized_orders ro
    join public.order_items oi on oi.order_id = ro.order_id
    join public.products p on p.id = oi.product_id
    where target_product_id is null or oi.product_id = target_product_id
    group by oi.product_id, p.name, p.sku
    order by revenue_ht desc, paid_units desc
  ), territory_breakdown as (
    select
      o.territory_id,
      coalesce(t.name, 'Sans territoire') as territory_name,
      t.territory_type,
      coalesce(sum(o.scoped_revenue_ht), 0) as revenue_ht,
      count(*) as orders_count,
      count(distinct o.brand_pharmacy_id) as ordering_pharmacies,
      round(avg(o.basket_revenue_ht), 2) as average_order_value_ht,
      round(avg(o.sku_count), 2) as average_skus_per_order
    from order_rollup o
    left join public.territories t on t.id = o.territory_id
    group by o.territory_id, t.name, t.territory_type
    order by revenue_ht desc
  ), agent_breakdown as (
    select
      o.agent_user_id_at_order as user_id,
      coalesce(up.full_name, 'Non affecté') as full_name,
      coalesce(sum(o.scoped_revenue_ht), 0) as revenue_ht,
      count(*) as orders_count,
      count(distinct o.brand_pharmacy_id) as ordering_pharmacies,
      round(avg(o.basket_revenue_ht), 2) as average_order_value_ht,
      round(avg(o.sku_count), 2) as average_skus_per_order,
      round(avg(o.paid_units), 2) as average_paid_units_per_order
    from order_rollup o
    left join public.user_profiles up on up.user_id = o.agent_user_id_at_order
    group by o.agent_user_id_at_order, up.full_name
    order by revenue_ht desc
  ), segment_breakdown as (
    select
      o.group_type,
      o.potential_level,
      o.priority_level,
      coalesce(sum(o.scoped_revenue_ht), 0) as revenue_ht,
      count(*) as orders_count,
      count(distinct o.brand_pharmacy_id) as ordering_pharmacies,
      round(avg(o.basket_revenue_ht), 2) as average_order_value_ht,
      round(avg(o.sku_count), 2) as average_skus_per_order
    from order_rollup o
    group by o.group_type, o.potential_level, o.priority_level
    order by revenue_ht desc
  ), pharmacy_breakdown as (
    select
      o.brand_pharmacy_id,
      o.pharmacy_id,
      coalesce(max(o.trade_name), max(o.legal_name), 'Pharmacie') as pharmacy_name,
      max(o.city) as city,
      max(o.postal_code) as postal_code,
      max(o.group_name) as group_name,
      max(o.group_type::text) as group_type,
      max(o.potential_level::text) as potential_level,
      max(o.priority_level::text) as priority_level,
      coalesce(sum(o.scoped_revenue_ht), 0) as revenue_ht,
      count(*) as orders_count,
      round(avg(o.basket_revenue_ht), 2) as average_order_value_ht,
      round(avg(o.sku_count), 2) as average_skus_per_order,
      coalesce(sum(o.paid_units), 0) as paid_units
    from order_rollup o
    group by o.brand_pharmacy_id, o.pharmacy_id
    order by revenue_ht desc
    limit 100
  )
  select jsonb_build_object(
    'period_start', target_period_start,
    'period_end', target_period_end,
    'summary', jsonb_build_object(
      'revenue_ht', sm.revenue_ht,
      'booked_revenue_ht', bm.booked_revenue_ht,
      'orders_count', sm.orders_count,
      'booked_orders_count', bm.booked_orders_count,
      'ordering_pharmacies', sm.ordering_pharmacies,
      'average_order_value_ht', sm.average_order_value_ht,
      'average_skus_per_order', sm.average_skus_per_order,
      'average_paid_units_per_order', sm.average_paid_units_per_order,
      'paid_units', sm.paid_units,
      'free_units', sm.free_units,
      'initial_orders', sm.initial_orders,
      'reorders', sm.reorders,
      'orders_per_ordering_pharmacy', sm.orders_per_ordering_pharmacy,
      'visits_count', vm.visits_count,
      'visited_pharmacies', vm.visited_pharmacies,
      'visited_and_ordering_pharmacies', vm.visited_and_ordering_pharmacies,
      'visited_account_conversion_rate', case when vm.visited_pharmacies = 0 then null
        else round(vm.visited_and_ordering_pharmacies * 100.0 / vm.visited_pharmacies, 1)
      end
    ),
    'territories', coalesce((select jsonb_agg(to_jsonb(x)) from territory_breakdown x), '[]'::jsonb),
    'agents', coalesce((select jsonb_agg(to_jsonb(x)) from agent_breakdown x), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(x)) from product_breakdown x), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(to_jsonb(x)) from segment_breakdown x), '[]'::jsonb),
    'pharmacies', coalesce((select jsonb_agg(to_jsonb(x)) from pharmacy_breakdown x), '[]'::jsonb)
  ) into result
  from summary_metrics sm
  cross join booked_metrics bm
  cross join visit_metrics vm;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_commercial_performance_cockpit(uuid,date,date,uuid,uuid,public.pharmacy_group_type,uuid,public.potential_level,public.priority_level,uuid) from public, anon;
grant execute on function public.get_commercial_performance_cockpit(uuid,date,date,uuid,uuid,public.pharmacy_group_type,uuid,public.potential_level,public.priority_level,uuid) to authenticated, service_role;
