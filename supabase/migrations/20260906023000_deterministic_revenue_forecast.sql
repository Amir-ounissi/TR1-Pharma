create or replace function public.get_revenue_forecast(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date,
  target_as_of date
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
  if target_period_end < target_period_start then
    raise exception 'Forecast period is invalid' using errcode = '22007';
  end if;

  if target_as_of < target_period_start or target_as_of > target_period_end then
    raise exception 'Forecast reference date is outside the period' using errcode = '22007';
  end if;

  if not private.performance_scope_allowed(target_brand_id, null, null) then
    raise exception 'Revenue forecast forbidden' using errcode = '42501';
  end if;

  with realized as (
    select coalesce(sum(fact.net_amount_ht), 0)::numeric as revenue_ht
    from public.performance_order_facts fact
    where fact.brand_id = target_brand_id
      and fact.order_date >= target_period_start::timestamptz
      and fact.order_date < (target_as_of + 1)::timestamptz
  ), booked_pipeline as (
    select coalesce(sum(booked.net_amount_ht), 0)::numeric as revenue_ht
    from public.performance_booked_order_facts booked
    left join public.performance_order_facts realized_fact
      on realized_fact.order_id = booked.order_id
    where booked.brand_id = target_brand_id
      and booked.order_date >= target_period_start::timestamptz
      and booked.order_date < (target_period_end + 1)::timestamptz
      and realized_fact.order_id is null
  ), expected_reorders as (
    select
      health.brand_pharmacy_id,
      health.pharmacy_name,
      health.territory_name,
      health.agent_name,
      health.expected_reorder_at::date as expected_reorder_date,
      round(greatest(coalesce(health.average_order_value, 0), 0), 2) as expected_value_ht,
      health.interval_source,
      case health.interval_source
        when 'median' then 'high'
        when 'average' then 'medium'
        else 'low'
      end as confidence,
      health.health_status::text as health_status,
      health.expected_interval_days
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and health.orders_count > 0
      and health.commercial_status <> 'lost'
      and health.expected_reorder_at is not null
      and health.expected_reorder_at::date > target_as_of
      and health.expected_reorder_at::date <= target_period_end
      and health.health_status not in ('dormant', 'insufficient_history')
      and coalesce(health.average_order_value, 0) > 0
  ), expected_metrics as (
    select
      count(*)::integer as expected_reorders_count,
      coalesce(sum(expected_value_ht), 0)::numeric as revenue_ht,
      count(*) filter (where confidence = 'low')::integer as low_confidence_count
    from expected_reorders
  ), overdue_metrics as (
    select count(*)::integer as overdue_reorders_count
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and health.orders_count > 0
      and health.commercial_status <> 'lost'
      and health.expected_reorder_at is not null
      and health.expected_reorder_at::date <= target_as_of
      and health.health_status in ('reorder_overdue', 'at_risk', 'dormant')
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
  ), metrics as (
    select
      realized.revenue_ht as realized_revenue_ht,
      booked_pipeline.revenue_ht as booked_pipeline_ht,
      expected_metrics.revenue_ht as expected_reorder_revenue_ht,
      expected_metrics.expected_reorders_count,
      expected_metrics.low_confidence_count,
      overdue_metrics.overdue_reorders_count,
      objective.target_value as objective_revenue_ht,
      round(
        realized.revenue_ht
        / greatest((target_as_of - target_period_start + 1), 1)::numeric
        * greatest((target_period_end - target_period_start + 1), 1)::numeric,
        2
      ) as run_rate_projection_ht
    from realized
    cross join booked_pipeline
    cross join expected_metrics
    cross join overdue_metrics
    left join objective on true
  ), final_metrics as (
    select
      metrics.*,
      round(
        metrics.realized_revenue_ht
        + metrics.booked_pipeline_ht
        + metrics.expected_reorder_revenue_ht,
        2
      ) as projected_revenue_ht
    from metrics
  ), expected_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'brand_pharmacy_id', expected_reorders.brand_pharmacy_id,
          'pharmacy_name', expected_reorders.pharmacy_name,
          'territory_name', expected_reorders.territory_name,
          'agent_name', expected_reorders.agent_name,
          'expected_reorder_date', expected_reorders.expected_reorder_date,
          'expected_value_ht', expected_reorders.expected_value_ht,
          'interval_source', expected_reorders.interval_source,
          'confidence', expected_reorders.confidence,
          'health_status', expected_reorders.health_status,
          'expected_interval_days', expected_reorders.expected_interval_days
        )
        order by expected_reorders.expected_reorder_date, expected_reorders.expected_value_ht desc
      ),
      '[]'::jsonb
    ) as rows
    from expected_reorders
  )
  select jsonb_build_object(
    'brand_id', target_brand_id,
    'period_start', target_period_start,
    'period_end', target_period_end,
    'as_of', target_as_of,
    'realized_revenue_ht', final_metrics.realized_revenue_ht,
    'booked_pipeline_ht', final_metrics.booked_pipeline_ht,
    'expected_reorder_revenue_ht', final_metrics.expected_reorder_revenue_ht,
    'projected_revenue_ht', final_metrics.projected_revenue_ht,
    'run_rate_projection_ht', final_metrics.run_rate_projection_ht,
    'objective_revenue_ht', final_metrics.objective_revenue_ht,
    'objective_gap_ht', case
      when final_metrics.objective_revenue_ht is null then null
      else round(final_metrics.objective_revenue_ht - final_metrics.projected_revenue_ht, 2)
    end,
    'objective_attainment_projection_percent', case
      when coalesce(final_metrics.objective_revenue_ht, 0) <= 0 then null
      else round(final_metrics.projected_revenue_ht * 100.0 / final_metrics.objective_revenue_ht, 1)
    end,
    'expected_reorders_count', final_metrics.expected_reorders_count,
    'low_confidence_expected_reorders_count', final_metrics.low_confidence_count,
    'overdue_reorders_count', final_metrics.overdue_reorders_count,
    'expected_reorders', expected_json.rows,
    'methodology', jsonb_build_object(
      'realized', 'Commandes facturées, partiellement livrées ou livrées à la date de référence.',
      'booked', 'Commandes confirmées non encore comptabilisées en CA réalisé.',
      'expected_reorders', 'Un prochain réassort par pharmacie, daté par la fréquence commerciale observée et valorisé au panier moyen.',
      'confidence', 'Élevée si la fréquence repose sur une médiane, moyenne sur une moyenne, faible sur le délai par défaut de la marque.',
      'exclusions', 'Les comptes dormants et les réassorts déjà en retard ne sont pas ajoutés au CA projeté.'
    )
  ) into result
  from final_metrics
  cross join expected_json;

  return result;
end;
$$;

revoke all on function public.get_revenue_forecast(uuid, date, date, date) from public;
grant execute on function public.get_revenue_forecast(uuid, date, date, date) to authenticated;
