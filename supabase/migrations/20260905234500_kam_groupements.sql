create or replace function private.can_read_kam_groups(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    private.has_global_role(array['super_admin'])
    or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user'])
  )
  and public.has_brand_capability(target_brand_id, 'kam_groups');
$$;

revoke all on function private.can_read_kam_groups(uuid) from public, anon, authenticated;

create or replace function public.get_kam_group_overview(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date
)
returns table (
  group_id uuid,
  group_name text,
  group_type text,
  headquarters_city text,
  park_pharmacies integer,
  portfolio_pharmacies integer,
  customer_pharmacies integer,
  non_customer_pharmacies integer,
  penetration_rate numeric,
  high_potential_remaining integer,
  revenue_ht numeric,
  orders_count integer,
  implantations integer,
  reorders integer,
  avg_distribution_rate numeric,
  strategic_distribution_rate numeric,
  territories_covered integer,
  at_risk_customers integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_period_start is null or target_period_end is null or target_period_end < target_period_start then
    raise exception 'Invalid KAM period' using errcode = '22023';
  end if;

  if not private.can_read_kam_groups(target_brand_id) then
    raise exception 'KAM group access forbidden' using errcode = '42501';
  end if;

  return query
  with members as (
    select
      g.id as group_id,
      g.name as group_name,
      g.group_type::text as group_type,
      g.headquarters_city,
      p.id as pharmacy_id,
      bp.id as brand_pharmacy_id,
      bp.territory_id,
      bp.potential_level,
      exists (
        select 1
        from public.performance_order_facts historical_order
        where historical_order.brand_id = target_brand_id
          and historical_order.brand_pharmacy_id = bp.id
          and historical_order.order_date < (target_period_end + 1)::timestamptz
      ) as is_customer
    from public.pharmacy_groups g
    join public.pharmacies p
      on p.pharmacy_group_id = g.id
     and p.archived_at is null
     and p.is_active
    left join public.brand_pharmacies bp
      on bp.pharmacy_id = p.id
     and bp.brand_id = target_brand_id
     and bp.archived_at is null
    where g.archived_at is null
  ), period_orders as (
    select
      order_fact.brand_pharmacy_id,
      coalesce(sum(order_fact.net_amount_ht), 0)::numeric as revenue_ht,
      count(*)::integer as orders_count,
      count(*) filter (where order_fact.is_initial_order)::integer as implantations,
      count(*) filter (where order_fact.is_reorder)::integer as reorders
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
    group by order_fact.brand_pharmacy_id
  )
  select
    members.group_id,
    members.group_name,
    members.group_type,
    members.headquarters_city,
    count(*)::integer as park_pharmacies,
    count(members.brand_pharmacy_id)::integer as portfolio_pharmacies,
    count(*) filter (where members.is_customer)::integer as customer_pharmacies,
    count(*) filter (where not members.is_customer)::integer as non_customer_pharmacies,
    case
      when count(*) = 0 then 0::numeric
      else round(count(*) filter (where members.is_customer)::numeric / count(*)::numeric * 100, 1)
    end as penetration_rate,
    count(*) filter (
      where not members.is_customer
        and members.potential_level in ('high'::public.potential_level, 'very_high'::public.potential_level)
    )::integer as high_potential_remaining,
    coalesce(sum(period_orders.revenue_ht), 0)::numeric as revenue_ht,
    coalesce(sum(period_orders.orders_count), 0)::integer as orders_count,
    coalesce(sum(period_orders.implantations), 0)::integer as implantations,
    coalesce(sum(period_orders.reorders), 0)::integer as reorders,
    coalesce(round(avg(distribution.distribution_rate) filter (where members.is_customer), 1), 0)::numeric as avg_distribution_rate,
    coalesce(round(avg(distribution.strategic_distribution_rate) filter (where members.is_customer), 1), 0)::numeric as strategic_distribution_rate,
    count(distinct members.territory_id) filter (where members.territory_id is not null)::integer as territories_covered,
    count(*) filter (
      where members.is_customer and health.health_status in ('at_risk'::public.commercial_health_status, 'dormant'::public.commercial_health_status)
    )::integer as at_risk_customers
  from members
  left join period_orders on period_orders.brand_pharmacy_id = members.brand_pharmacy_id
  left join public.brand_pharmacy_distribution distribution on distribution.brand_pharmacy_id = members.brand_pharmacy_id
  left join public.commercial_account_health health on health.brand_pharmacy_id = members.brand_pharmacy_id
  group by members.group_id, members.group_name, members.group_type, members.headquarters_city
  order by revenue_ht desc, non_customer_pharmacies desc, members.group_name;
end;
$$;

create or replace function public.get_kam_group_pharmacies(
  target_brand_id uuid,
  target_group_id uuid,
  target_period_start date,
  target_period_end date
)
returns table (
  pharmacy_id uuid,
  brand_pharmacy_id uuid,
  pharmacy_name text,
  postal_code text,
  city text,
  in_portfolio boolean,
  is_customer boolean,
  commercial_status text,
  activity_status text,
  priority_level text,
  potential_level text,
  potential_score numeric,
  territory_name text,
  agent_name text,
  health_status text,
  priority_score integer,
  recommendation text,
  revenue_ht numeric,
  orders_count integer,
  reorders integer,
  distribution_rate numeric,
  strategic_distribution_rate numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_period_start is null or target_period_end is null or target_period_end < target_period_start then
    raise exception 'Invalid KAM period' using errcode = '22023';
  end if;

  if not private.can_read_kam_groups(target_brand_id) then
    raise exception 'KAM group access forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.pharmacy_groups g where g.id = target_group_id and g.archived_at is null
  ) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;

  return query
  with period_orders as (
    select
      order_fact.brand_pharmacy_id,
      coalesce(sum(order_fact.net_amount_ht), 0)::numeric as revenue_ht,
      count(*)::integer as orders_count,
      count(*) filter (where order_fact.is_reorder)::integer as reorders
    from public.performance_order_facts order_fact
    where order_fact.brand_id = target_brand_id
      and order_fact.order_date >= target_period_start::timestamptz
      and order_fact.order_date < (target_period_end + 1)::timestamptz
    group by order_fact.brand_pharmacy_id
  )
  select
    p.id as pharmacy_id,
    bp.id as brand_pharmacy_id,
    coalesce(p.trade_name, p.legal_name) as pharmacy_name,
    p.postal_code,
    p.city,
    (bp.id is not null) as in_portfolio,
    exists (
      select 1
      from public.performance_order_facts historical_order
      where historical_order.brand_id = target_brand_id
        and historical_order.brand_pharmacy_id = bp.id
        and historical_order.order_date < (target_period_end + 1)::timestamptz
    ) as is_customer,
    bp.commercial_status::text,
    bp.activity_status::text,
    bp.priority_level::text,
    bp.potential_level::text,
    bp.potential_score,
    territory.name as territory_name,
    profile.full_name as agent_name,
    health.health_status::text,
    health.priority_score,
    health.recommendation,
    coalesce(period_orders.revenue_ht, 0)::numeric,
    coalesce(period_orders.orders_count, 0)::integer,
    coalesce(period_orders.reorders, 0)::integer,
    distribution.distribution_rate,
    distribution.strategic_distribution_rate
  from public.pharmacies p
  left join public.brand_pharmacies bp
    on bp.pharmacy_id = p.id
   and bp.brand_id = target_brand_id
   and bp.archived_at is null
  left join public.territories territory on territory.id = bp.territory_id
  left join public.user_profiles profile on profile.user_id = bp.current_agent_user_id
  left join public.commercial_account_health health on health.brand_pharmacy_id = bp.id
  left join public.brand_pharmacy_distribution distribution on distribution.brand_pharmacy_id = bp.id
  left join period_orders on period_orders.brand_pharmacy_id = bp.id
  where p.pharmacy_group_id = target_group_id
    and p.archived_at is null
    and p.is_active
  order by
    exists (
      select 1
      from public.performance_order_facts historical_order
      where historical_order.brand_id = target_brand_id
        and historical_order.brand_pharmacy_id = bp.id
        and historical_order.order_date < (target_period_end + 1)::timestamptz
    ) asc,
    coalesce(bp.potential_score, 0) desc,
    coalesce(p.trade_name, p.legal_name);
end;
$$;

revoke all on function public.get_kam_group_overview(uuid,date,date) from public, anon;
revoke all on function public.get_kam_group_pharmacies(uuid,uuid,date,date) from public, anon;
grant execute on function public.get_kam_group_overview(uuid,date,date) to authenticated, service_role;
grant execute on function public.get_kam_group_pharmacies(uuid,uuid,date,date) to authenticated, service_role;
