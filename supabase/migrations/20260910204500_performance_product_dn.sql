-- Filter-aware product distribution (DN) for the commercial performance cockpit.
-- DN is a current portfolio metric: distributing customer pharmacies / customer pharmacies in scope.

create or replace function public.get_commercial_performance_distribution(
  target_brand_id uuid,
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
  if not private.performance_scope_allowed(target_brand_id, target_agent_id, target_territory_id) then
    raise exception 'Commercial performance distribution forbidden' using errcode = '42501';
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
      bp.territory_id,
      bp.current_agent_user_id
    from public.brand_pharmacies bp
    join public.pharmacies p on p.id = bp.pharmacy_id
    left join public.pharmacy_groups pg on pg.id = p.pharmacy_group_id and pg.archived_at is null
    where bp.brand_id = target_brand_id
      and bp.archived_at is null
      and p.archived_at is null
      and p.is_active
      and (target_territory_id is null or bp.territory_id in (select territory_scope.id from territory_scope))
      and (target_agent_id is null or bp.current_agent_user_id = target_agent_id)
      and (target_group_type is null or coalesce(pg.group_type, 'independent'::public.pharmacy_group_type) = target_group_type)
      and (target_group_id is null or p.pharmacy_group_id = target_group_id)
      and (target_potential_level is null or bp.potential_level = target_potential_level)
      and (target_priority_level is null or bp.priority_level = target_priority_level)
  ), customers as (
    select sr.brand_pharmacy_id
    from scoped_relations sr
    join public.commercial_account_health health on health.brand_pharmacy_id = sr.brand_pharmacy_id
    where health.orders_count > 0
  ), product_scope as (
    select p.id, p.name, p.sku
    from public.products p
    where p.brand_id = target_brand_id
      and p.is_active
      and p.discontinued_at is null
      and p.is_pharmacy_eligible
      and p.counts_for_distribution
      and (target_product_id is null or p.id = target_product_id)
  ), presence as (
    select distinct bpp.product_id, bpp.brand_pharmacy_id
    from public.brand_pharmacy_products bpp
    join customers c on c.brand_pharmacy_id = bpp.brand_pharmacy_id
    join product_scope ps on ps.id = bpp.product_id
    where bpp.removed_at is null
      and (
        bpp.order_presence
        or bpp.status in ('implanted', 'active', 'temporarily_unavailable')
        or bpp.manually_confirmed_present
      )
  ), customer_count as (
    select count(*)::integer as value from customers
  ), product_distribution as (
    select
      ps.id as product_id,
      ps.name as product_name,
      ps.sku,
      cc.value as customer_pharmacies,
      count(distinct presence.brand_pharmacy_id)::integer as distributing_pharmacies,
      case
        when cc.value = 0 then null::numeric
        else round(count(distinct presence.brand_pharmacy_id)::numeric * 100.0 / cc.value, 1)
      end as distribution_rate
    from product_scope ps
    cross join customer_count cc
    left join presence on presence.product_id = ps.id
    group by ps.id, ps.name, ps.sku, cc.value
    order by distribution_rate desc nulls last, ps.name
  ), summary as (
    select
      (select value from customer_count) as customer_pharmacies,
      count(*)::integer as products_count,
      round(avg(distribution_rate), 1) as avg_product_distribution_rate
    from product_distribution
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'customer_pharmacies', summary.customer_pharmacies,
      'products_count', summary.products_count,
      'avg_product_distribution_rate', summary.avg_product_distribution_rate
    ),
    'products', coalesce((select jsonb_agg(to_jsonb(x)) from product_distribution x), '[]'::jsonb)
  ) into result
  from summary;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_commercial_performance_distribution(uuid,uuid,uuid,public.pharmacy_group_type,uuid,public.potential_level,public.priority_level,uuid) from public, anon;
grant execute on function public.get_commercial_performance_distribution(uuid,uuid,uuid,public.pharmacy_group_type,uuid,public.potential_level,public.priority_level,uuid) to authenticated, service_role;
