create or replace function public.get_pharma_360(
  target_brand_id uuid,
  target_brand_pharmacy_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  relation_record record;
  health_record record;
  distribution_record record;
  result_payload jsonb;
  trade_enabled boolean := false;
  sell_out_enabled boolean := false;
  nba_enabled boolean := false;
begin
  if not public.has_brand_capability(target_brand_id, 'pharma_360')
    or not (
      private.has_global_role(array['super_admin'])
      or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user'])
    ) then
    raise exception 'Pharma 360 forbidden' using errcode = '42501';
  end if;

  select
    bp.id as brand_pharmacy_id,
    bp.brand_id,
    bp.pharmacy_id,
    coalesce(p.trade_name, p.legal_name) as pharmacy_name,
    p.trade_name,
    p.legal_name,
    p.cip_code,
    p.finess_code,
    p.siret,
    p.phone,
    p.email,
    p.address_line_1,
    p.postal_code,
    p.city,
    p.country_code,
    pg.name as group_name,
    territory.name as territory_name,
    bp.commercial_status,
    bp.priority_level,
    bp.potential_level,
    bp.current_agent_user_id,
    agent.full_name as agent_name,
    bp.next_action_type,
    bp.next_action_at,
    bp.last_order_at
  into relation_record
  from public.brand_pharmacies bp
  join public.pharmacies p on p.id = bp.pharmacy_id
  left join public.pharmacy_groups pg on pg.id = p.pharmacy_group_id
  left join public.territories territory on territory.id = bp.territory_id
  left join public.user_profiles agent on agent.user_id = bp.current_agent_user_id
  where bp.id = target_brand_pharmacy_id
    and bp.brand_id = target_brand_id
    and bp.archived_at is null;

  if relation_record.brand_pharmacy_id is null then
    raise exception 'Pharma 360 account not found' using errcode = 'P0002';
  end if;

  select * into health_record
  from public.commercial_account_health health
  where health.brand_id = target_brand_id
    and health.brand_pharmacy_id = target_brand_pharmacy_id;

  select * into distribution_record
  from public.brand_pharmacy_distribution distribution
  where distribution.brand_id = target_brand_id
    and distribution.brand_pharmacy_id = target_brand_pharmacy_id;

  trade_enabled := public.has_brand_capability(target_brand_id, 'trade_marketing');
  sell_out_enabled := public.has_brand_capability(target_brand_id, 'sell_out');
  nba_enabled := public.has_brand_capability(target_brand_id, 'next_best_action');

  result_payload := jsonb_build_object(
    'account', jsonb_strip_nulls(jsonb_build_object(
      'brand_pharmacy_id', relation_record.brand_pharmacy_id,
      'pharmacy_id', relation_record.pharmacy_id,
      'pharmacy_name', relation_record.pharmacy_name,
      'trade_name', relation_record.trade_name,
      'legal_name', relation_record.legal_name,
      'cip_code', relation_record.cip_code,
      'finess_code', relation_record.finess_code,
      'siret', relation_record.siret,
      'phone', relation_record.phone,
      'email', relation_record.email,
      'address_line_1', relation_record.address_line_1,
      'postal_code', relation_record.postal_code,
      'city', relation_record.city,
      'country_code', relation_record.country_code,
      'group_name', relation_record.group_name,
      'territory_name', relation_record.territory_name,
      'commercial_status', relation_record.commercial_status,
      'priority_level', relation_record.priority_level,
      'potential_level', relation_record.potential_level,
      'agent_name', relation_record.agent_name,
      'next_action_type', relation_record.next_action_type,
      'next_action_at', relation_record.next_action_at
    )),
    'business', jsonb_strip_nulls(jsonb_build_object(
      'health_status', health_record.health_status,
      'priority_score', health_record.priority_score,
      'priority_reasons', coalesce(health_record.priority_reasons, '[]'::jsonb),
      'recommendation', health_record.recommendation,
      'orders_count', coalesce(health_record.orders_count, 0),
      'reorder_count', coalesce(health_record.reorder_count, 0),
      'first_order_at', health_record.first_order_at,
      'last_order_at', health_record.last_order_at,
      'first_reorder_at', health_record.first_reorder_at,
      'days_to_first_reorder', health_record.days_to_first_reorder,
      'average_order_value', coalesce(health_record.average_order_value, 0),
      'total_revenue_ht', coalesce(health_record.total_revenue, 0),
      'revenue_last_30d_ht', coalesce(health_record.revenue_last_30d, 0),
      'revenue_last_90d_ht', coalesce(health_record.revenue_last_90d, 0),
      'revenue_trend', health_record.revenue_trend,
      'revenue_trend_percent', health_record.revenue_trend_percent,
      'expected_reorder_at', health_record.expected_reorder_at,
      'expected_reorder_delay_days', health_record.expected_reorder_delay_days,
      'expected_interval_days', health_record.expected_interval_days,
      'interval_source', health_record.interval_source,
      'has_next_action', coalesce(health_record.has_next_action, false),
      'next_action_at', health_record.next_action_at
    )),
    'assortment', jsonb_build_object(
      'eligible_product_count', coalesce(distribution_record.eligible_product_count, 0),
      'implanted_product_count', coalesce(distribution_record.implanted_product_count, 0),
      'strategic_eligible_count', coalesce(distribution_record.strategic_eligible_count, 0),
      'strategic_implanted_count', coalesce(distribution_record.strategic_implanted_count, 0),
      'distribution_rate', coalesce(distribution_record.distribution_rate, 0),
      'strategic_distribution_rate', coalesce(distribution_record.strategic_distribution_rate, 0),
      'products', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'product_id', product.id,
          'name', product.name,
          'sku', product.sku,
          'ean', product.ean,
          'status', relation_product.status,
          'first_implanted_at', relation_product.first_implanted_at,
          'first_ordered_at', relation_product.first_ordered_at,
          'last_ordered_at', relation_product.last_ordered_at,
          'total_ordered_quantity', relation_product.total_ordered_quantity,
          'valid_order_count', relation_product.valid_order_count,
          'order_presence', relation_product.order_presence
        )) order by product.name)
        from public.brand_pharmacy_products relation_product
        join public.products product on product.id = relation_product.product_id
        where relation_product.brand_pharmacy_id = target_brand_pharmacy_id
          and relation_product.removed_at is null
          and relation_product.status <> 'removed'
      ), '[]'::jsonb)
    ),
    'field', jsonb_build_object(
      'interactions', coalesce((
        select jsonb_agg(to_jsonb(interaction_row) order by interaction_row.occurred_at desc)
        from (
          select interaction.id, interaction.interaction_type, interaction.outcome,
            interaction.occurred_at, interaction.subject
          from public.interactions interaction
          where interaction.brand_id = target_brand_id
            and interaction.brand_pharmacy_id = target_brand_pharmacy_id
            and interaction.archived_at is null
          order by interaction.occurred_at desc
          limit 8
        ) interaction_row
      ), '[]'::jsonb),
      'missions', coalesce((
        select jsonb_agg(to_jsonb(mission_row) order by mission_row.scheduled_start_at desc nulls last)
        from (
          select mission.id, mission.title, mission.mission_type, mission.status,
            mission.scheduled_start_at, mission.actual_end_at, mission.completed_at
          from public.missions mission
          where mission.brand_id = target_brand_id
            and mission.brand_pharmacy_id = target_brand_pharmacy_id
            and mission.archived_at is null
          order by mission.scheduled_start_at desc nulls last
          limit 8
        ) mission_row
      ), '[]'::jsonb),
      'open_tasks', coalesce((
        select jsonb_agg(to_jsonb(task_row) order by task_row.due_at asc nulls last)
        from (
          select task.id, task.task_type, task.title, task.priority, task.status, task.due_at
          from public.tasks task
          where task.brand_id = target_brand_id
            and task.brand_pharmacy_id = target_brand_pharmacy_id
            and task.archived_at is null
            and task.status in ('open','in_progress')
          order by task.due_at asc nulls last
          limit 8
        ) task_row
      ), '[]'::jsonb)
    ),
    'trade', case when trade_enabled then jsonb_build_object(
      'enabled', true,
      'campaigns', coalesce((
        select jsonb_agg(to_jsonb(campaign_row) order by campaign_row.starts_on desc)
        from (
          select campaign.id, campaign.name, campaign.campaign_type, campaign.status,
            campaign.objective, campaign.starts_on, campaign.ends_on, target.target_reason
          from public.trade_campaign_targets target
          join public.trade_campaigns campaign on campaign.id = target.campaign_id
          where target.brand_id = target_brand_id
            and target.brand_pharmacy_id = target_brand_pharmacy_id
            and campaign.archived_at is null
          order by campaign.starts_on desc
          limit 8
        ) campaign_row
      ), '[]'::jsonb)
    ) else jsonb_build_object('enabled', false, 'campaigns', '[]'::jsonb) end,
    'sell_out', case when sell_out_enabled then jsonb_build_object(
      'enabled', true,
      'validated_capture_count', (
        select count(*)
        from public.sell_out_captures capture
        where capture.brand_id = target_brand_id
          and capture.brand_pharmacy_id = target_brand_pharmacy_id
          and capture.status = 'validated'
          and capture.archived_at is null
      ),
      'units_last_90d', coalesce((
        select sum(coalesce(line.units_sold, line.theoretical_units, 0))
        from public.sell_out_captures capture
        join public.sell_out_lines line on line.capture_id = capture.id
        where capture.brand_id = target_brand_id
          and capture.brand_pharmacy_id = target_brand_pharmacy_id
          and capture.status = 'validated'
          and capture.archived_at is null
          and capture.period_end >= current_date - 89
      ), 0),
      'revenue_last_90d_ht', coalesce((
        select sum(coalesce(line.revenue_ht, 0))
        from public.sell_out_captures capture
        join public.sell_out_lines line on line.capture_id = capture.id
        where capture.brand_id = target_brand_id
          and capture.brand_pharmacy_id = target_brand_pharmacy_id
          and capture.status = 'validated'
          and capture.archived_at is null
          and capture.period_end >= current_date - 89
      ), 0),
      'latest_captures', coalesce((
        select jsonb_agg(to_jsonb(capture_row) order by capture_row.period_end desc)
        from (
          select capture.id, capture.method, capture.quality, capture.status,
            capture.period_start, capture.period_end, capture.source_label, capture.confidence
          from public.sell_out_captures capture
          where capture.brand_id = target_brand_id
            and capture.brand_pharmacy_id = target_brand_pharmacy_id
            and capture.archived_at is null
          order by capture.period_end desc, capture.created_at desc
          limit 6
        ) capture_row
      ), '[]'::jsonb)
    ) else jsonb_build_object(
      'enabled', false,
      'validated_capture_count', 0,
      'units_last_90d', 0,
      'revenue_last_90d_ht', 0,
      'latest_captures', '[]'::jsonb
    ) end,
    'opportunities', case when nba_enabled then coalesce((
      select jsonb_agg(to_jsonb(action_row) order by action_row.action_score desc, action_row.suggested_due_at)
      from public.get_next_best_actions(target_brand_id, 5, target_brand_pharmacy_id) action_row
    ), '[]'::jsonb) else '[]'::jsonb end,
    'capabilities', jsonb_build_object(
      'trade_marketing', trade_enabled,
      'sell_out', sell_out_enabled,
      'next_best_action', nba_enabled
    )
  );

  return result_payload;
end;
$$;

revoke all on function public.get_pharma_360(uuid, uuid) from public, anon;
grant execute on function public.get_pharma_360(uuid, uuid) to authenticated;
