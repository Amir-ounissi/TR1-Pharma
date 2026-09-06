alter table public.roles drop constraint if exists roles_key_check;
alter table public.roles add constraint roles_key_check
  check (key in ('super_admin', 'tr1_manager', 'brand_admin', 'brand_direction', 'brand_user', 'agent', 'facilitator'));

insert into public.roles (key, label, description, rank, permissions)
values (
  'brand_direction',
  'Direction de marque',
  'Pilotage exécutif de la marque en lecture, sans droits opérationnels.',
  50,
  '{"brand.read":true,"operations.manage":false,"users.manage":false}'::jsonb
)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  rank = excluded.rank,
  permissions = excluded.permissions;

create or replace function private.can_read_direction_workspace(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      private.has_global_role(array['super_admin'])
      or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_direction'])
    )
    and public.has_brand_capability(target_brand_id, 'direction_workspace');
$$;

revoke all on function private.can_read_direction_workspace(uuid) from public, anon, authenticated;
grant execute on function private.can_read_direction_workspace(uuid) to service_role;

create or replace function public.get_direction_workspace(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date,
  target_as_of date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if target_period_start is null
     or target_period_end is null
     or target_as_of is null
     or target_period_end < target_period_start
     or target_as_of < target_period_start
     or target_as_of > target_period_end then
    raise exception 'Direction period is invalid' using errcode = '22007';
  end if;

  if not private.can_read_direction_workspace(target_brand_id) then
    raise exception 'Direction workspace forbidden' using errcode = '42501';
  end if;

  with current_orders as (
    select fact.*
    from public.performance_order_facts fact
    where fact.brand_id = target_brand_id
      and fact.order_date >= target_period_start::timestamptz
      and fact.order_date < (target_as_of + 1)::timestamptz
  ), previous_orders as (
    select fact.*
    from public.performance_order_facts fact
    where fact.brand_id = target_brand_id
      and fact.order_date >= (target_period_start - interval '1 year')::timestamptz
      and fact.order_date < ((target_as_of - interval '1 year')::date + 1)::timestamptz
  ), booked_pipeline as (
    select coalesce(sum(booked.net_amount_ht), 0)::numeric as revenue_ht
    from public.performance_booked_order_facts booked
    left join public.performance_order_facts realized_fact on realized_fact.order_id = booked.order_id
    where booked.brand_id = target_brand_id
      and booked.order_date > target_as_of::timestamptz
      and booked.order_date < (target_period_end + 1)::timestamptz
      and realized_fact.order_id is null
  ), expected_reorders as (
    select
      health.brand_pharmacy_id,
      round(greatest(coalesce(health.average_order_value, 0), 0), 2) as expected_value_ht
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and health.orders_count > 0
      and health.commercial_status <> 'lost'
      and health.expected_reorder_at is not null
      and health.expected_reorder_at::date > target_as_of
      and health.expected_reorder_at::date <= target_period_end
      and health.health_status not in ('dormant', 'insufficient_history')
      and coalesce(health.average_order_value, 0) > 0
  ), overdue_reorders as (
    select count(*)::integer as count
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and health.orders_count > 0
      and health.commercial_status <> 'lost'
      and health.expected_reorder_at is not null
      and health.expected_reorder_at::date <= target_as_of
      and health.health_status in ('reorder_overdue', 'at_risk', 'dormant')
  ), portfolio as (
    select
      count(*) filter (where health.health_status not in ('dormant','insufficient_history'))::integer as active_pharmacies,
      count(*) filter (where health.health_status = 'at_risk')::integer as at_risk_accounts,
      count(*) filter (where health.health_status = 'dormant')::integer as dormant_accounts
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
  ), distribution as (
    select
      coalesce(round(avg(dist.distribution_rate), 1), 0)::numeric as avg_distribution_rate,
      coalesce(round(avg(dist.strategic_distribution_rate), 1), 0)::numeric as strategic_distribution_rate
    from public.brand_pharmacy_distribution dist
    join public.brand_pharmacies bp on bp.id = dist.brand_pharmacy_id
    where bp.brand_id = target_brand_id and bp.archived_at is null
  ), current_metrics as (
    select
      coalesce(sum(net_amount_ht), 0)::numeric as revenue_ht,
      count(*) filter (where is_initial_order)::integer as implantations,
      count(*) filter (where is_reorder)::integer as reorders
    from current_orders
  ), previous_metrics as (
    select coalesce(sum(net_amount_ht), 0)::numeric as revenue_ht
    from previous_orders
  ), expected_metrics as (
    select count(*)::integer as count, coalesce(sum(expected_value_ht), 0)::numeric as revenue_ht
    from expected_reorders
  ), objective as (
    select objective.target_value
    from public.performance_objectives objective
    where objective.brand_id = target_brand_id
      and objective.scope_type = 'brand'
      and objective.metric_key = 'revenue_ht'
      and objective.period_start = target_period_start
      and objective.period_end = target_period_end
      and objective.archived_at is null
    order by objective.updated_at desc
    limit 1
  ), territory_rows as (
    select
      fact.territory_id,
      coalesce(territory.name, 'Sans territoire') as territory_name,
      coalesce(sum(fact.net_amount_ht), 0)::numeric as revenue_ht,
      count(*) filter (where fact.is_initial_order)::integer as implantations,
      count(*) filter (where fact.is_reorder)::integer as reorders
    from current_orders fact
    left join public.territories territory on territory.id = fact.territory_id and territory.brand_id = target_brand_id
    group by fact.territory_id, territory.name
  ), territory_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'territory_id', territory_rows.territory_id,
          'territory_name', territory_rows.territory_name,
          'revenue_ht', territory_rows.revenue_ht,
          'implantations', territory_rows.implantations,
          'reorders', territory_rows.reorders
        ) order by territory_rows.revenue_ht desc, territory_rows.territory_name
      ),
      '[]'::jsonb
    ) as rows
    from territory_rows
  ), combined as (
    select
      current_metrics.*,
      previous_metrics.revenue_ht as previous_revenue_ht,
      booked_pipeline.revenue_ht as booked_pipeline_ht,
      expected_metrics.revenue_ht as expected_reorder_revenue_ht,
      expected_metrics.count as expected_reorders_count,
      overdue_reorders.count as overdue_reorders_count,
      portfolio.active_pharmacies,
      portfolio.at_risk_accounts,
      portfolio.dormant_accounts,
      distribution.avg_distribution_rate,
      distribution.strategic_distribution_rate,
      objective.target_value as objective_revenue_ht,
      round(
        current_metrics.revenue_ht + booked_pipeline.revenue_ht + expected_metrics.revenue_ht,
        2
      ) as projected_revenue_ht,
      round(
        current_metrics.revenue_ht
        / greatest((target_as_of - target_period_start + 1), 1)::numeric
        * greatest((target_period_end - target_period_start + 1), 1)::numeric,
        2
      ) as run_rate_projection_ht
    from current_metrics
    cross join previous_metrics
    cross join booked_pipeline
    cross join expected_metrics
    cross join overdue_reorders
    cross join portfolio
    cross join distribution
    left join objective on true
  )
  select jsonb_build_object(
    'brand_id', target_brand_id,
    'period_start', target_period_start,
    'period_end', target_period_end,
    'as_of', target_as_of,
    'revenue_ht', combined.revenue_ht,
    'previous_revenue_ht', combined.previous_revenue_ht,
    'revenue_delta_percent', case
      when combined.previous_revenue_ht = 0 then null
      else round((combined.revenue_ht - combined.previous_revenue_ht) * 100.0 / combined.previous_revenue_ht, 1)
    end,
    'booked_pipeline_ht', combined.booked_pipeline_ht,
    'expected_reorder_revenue_ht', combined.expected_reorder_revenue_ht,
    'projected_revenue_ht', combined.projected_revenue_ht,
    'run_rate_projection_ht', combined.run_rate_projection_ht,
    'objective_revenue_ht', combined.objective_revenue_ht,
    'objective_gap_ht', case
      when combined.objective_revenue_ht is null then null
      else round(combined.objective_revenue_ht - combined.projected_revenue_ht, 2)
    end,
    'objective_attainment_projection_percent', case
      when coalesce(combined.objective_revenue_ht, 0) <= 0 then null
      else round(combined.projected_revenue_ht * 100.0 / combined.objective_revenue_ht, 1)
    end,
    'implantations', combined.implantations,
    'reorders', combined.reorders,
    'active_pharmacies', combined.active_pharmacies,
    'at_risk_accounts', combined.at_risk_accounts,
    'dormant_accounts', combined.dormant_accounts,
    'avg_distribution_rate', combined.avg_distribution_rate,
    'strategic_distribution_rate', combined.strategic_distribution_rate,
    'expected_reorders_count', combined.expected_reorders_count,
    'overdue_reorders_count', combined.overdue_reorders_count,
    'territories', territory_json.rows,
    'methodology', jsonb_build_object(
      'projection', 'CA réalisé + commandes confirmées non réalisées + prochain réassort attendu des comptes actifs.',
      'comparison', 'Même période à date sur N-1.',
      'distribution', 'Moyenne de distribution du portefeuille actif de la marque.'
    )
  ) into result
  from combined
  cross join territory_json;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_direction_workspace(uuid,date,date,date) from public, anon;
grant execute on function public.get_direction_workspace(uuid,date,date,date) to authenticated, service_role;
