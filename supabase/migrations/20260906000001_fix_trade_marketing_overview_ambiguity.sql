create or replace function public.get_trade_campaign_overview(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date
)
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_code text,
  campaign_type text,
  campaign_status text,
  starts_on date,
  ends_on date,
  budget_planned_ht numeric,
  target_pharmacies integer,
  executed_pharmacies integer,
  coverage_rate numeric,
  linked_missions integer,
  completed_missions integer,
  animations_completed integer,
  trainings_completed integer,
  actual_cost_ht numeric,
  sell_out_units numeric,
  eligible_observations integer,
  baseline_revenue_30d numeric,
  post_revenue_30d numeric,
  observed_incremental_revenue_ht numeric,
  gross_margin_rate numeric,
  estimated_incremental_margin_ht numeric,
  observed_roi_percent numeric,
  roi_reliability text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_period_start is null or target_period_end is null or target_period_end < target_period_start then
    raise exception 'Invalid Trade Marketing period' using errcode = '22023';
  end if;
  if not private.can_read_trade_marketing(target_brand_id) then
    raise exception 'Trade Marketing access forbidden' using errcode = '42501';
  end if;

  return query
  with campaigns as (
    select campaign.*
    from public.trade_campaigns campaign
    where campaign.brand_id = target_brand_id
      and campaign.archived_at is null
      and campaign.ends_on >= target_period_start
      and campaign.starts_on <= target_period_end
  ), target_metrics as (
    select
      target.campaign_id,
      count(*)::integer as target_pharmacies
    from public.trade_campaign_targets target
    join campaigns campaign on campaign.id = target.campaign_id
    group by target.campaign_id
  ), linked as (
    select
      link.campaign_id,
      mission.id as mission_id,
      mission.brand_pharmacy_id,
      mission.mission_type,
      mission.status,
      mission.cost_actual_ht,
      impact.sell_out_units,
      impact.revenue_30d_before,
      impact.revenue_30d_after,
      impact.observation_maturity,
      impact.impact_data_quality,
      impact.overlapping_missions
    from public.trade_campaign_missions link
    join campaigns campaign on campaign.id = link.campaign_id
    join public.missions mission on mission.id = link.mission_id and mission.archived_at is null
    left join public.mission_impact impact on impact.mission_id = mission.id
  ), mission_metrics as (
    select
      linked.campaign_id,
      count(*)::integer as linked_missions,
      count(*) filter (where linked.status = 'completed'::public.mission_status)::integer as completed_missions,
      count(*) filter (
        where linked.status = 'completed'::public.mission_status
          and linked.mission_type = 'animation'::public.mission_type
      )::integer as animations_completed,
      count(*) filter (
        where linked.status = 'completed'::public.mission_status
          and linked.mission_type = 'training'::public.mission_type
      )::integer as trainings_completed,
      coalesce(sum(linked.cost_actual_ht) filter (
        where linked.status = 'completed'::public.mission_status
      ), 0)::numeric as actual_cost_ht,
      coalesce(sum(linked.sell_out_units) filter (
        where linked.status = 'completed'::public.mission_status
      ), 0)::numeric as sell_out_units,
      count(*) filter (
        where linked.status = 'completed'::public.mission_status
          and linked.observation_maturity <> 'early'::public.mission_observation_maturity
          and linked.impact_data_quality <> 'insufficient'::public.mission_impact_data_quality
          and not coalesce(linked.overlapping_missions, false)
      )::integer as eligible_observations,
      coalesce(sum(linked.revenue_30d_before) filter (
        where linked.status = 'completed'::public.mission_status
          and linked.observation_maturity <> 'early'::public.mission_observation_maturity
          and linked.impact_data_quality <> 'insufficient'::public.mission_impact_data_quality
          and not coalesce(linked.overlapping_missions, false)
      ), 0)::numeric as baseline_revenue_30d,
      coalesce(sum(linked.revenue_30d_after) filter (
        where linked.status = 'completed'::public.mission_status
          and linked.observation_maturity <> 'early'::public.mission_observation_maturity
          and linked.impact_data_quality <> 'insufficient'::public.mission_impact_data_quality
          and not coalesce(linked.overlapping_missions, false)
      ), 0)::numeric as post_revenue_30d,
      count(distinct linked.brand_pharmacy_id) filter (
        where linked.status = 'completed'::public.mission_status
      )::integer as executed_pharmacies
    from linked
    group by linked.campaign_id
  ), settings as (
    select brand_settings.gross_margin_rate as configured_gross_margin_rate
    from public.brand_settings as brand_settings
    where brand_settings.brand_id = target_brand_id
  )
  select
    campaign.id,
    campaign.name,
    campaign.code,
    campaign.campaign_type::text,
    campaign.status::text,
    campaign.starts_on,
    campaign.ends_on,
    campaign.budget_planned_ht,
    coalesce(target_metrics.target_pharmacies, 0),
    coalesce(mission_metrics.executed_pharmacies, 0),
    case
      when coalesce(target_metrics.target_pharmacies, 0) = 0 then 0::numeric
      else round(
        coalesce(mission_metrics.executed_pharmacies, 0)::numeric
        / target_metrics.target_pharmacies::numeric * 100,
        1
      )
    end,
    coalesce(mission_metrics.linked_missions, 0),
    coalesce(mission_metrics.completed_missions, 0),
    coalesce(mission_metrics.animations_completed, 0),
    coalesce(mission_metrics.trainings_completed, 0),
    coalesce(mission_metrics.actual_cost_ht, 0),
    coalesce(mission_metrics.sell_out_units, 0),
    coalesce(mission_metrics.eligible_observations, 0),
    coalesce(mission_metrics.baseline_revenue_30d, 0),
    coalesce(mission_metrics.post_revenue_30d, 0),
    (
      coalesce(mission_metrics.post_revenue_30d, 0)
      - coalesce(mission_metrics.baseline_revenue_30d, 0)
    )::numeric,
    settings.configured_gross_margin_rate,
    case
      when settings.configured_gross_margin_rate is null
        or coalesce(mission_metrics.eligible_observations, 0) = 0
        then null
      else round(
        (
          coalesce(mission_metrics.post_revenue_30d, 0)
          - coalesce(mission_metrics.baseline_revenue_30d, 0)
        ) * settings.configured_gross_margin_rate / 100,
        2
      )
    end,
    case
      when settings.configured_gross_margin_rate is null
        or coalesce(mission_metrics.eligible_observations, 0) = 0
        or coalesce(mission_metrics.actual_cost_ht, 0) <= 0
        then null
      else round((
        ((
          coalesce(mission_metrics.post_revenue_30d, 0)
          - coalesce(mission_metrics.baseline_revenue_30d, 0)
        ) * settings.configured_gross_margin_rate / 100)
        - mission_metrics.actual_cost_ht
      ) / mission_metrics.actual_cost_ht * 100, 1)
    end,
    case
      when coalesce(mission_metrics.completed_missions, 0) = 0 then 'insufficient'
      when settings.configured_gross_margin_rate is null
        or coalesce(mission_metrics.eligible_observations, 0) = 0
        then 'insufficient'
      when mission_metrics.eligible_observations < mission_metrics.completed_missions then 'partial'
      else 'observed'
    end::text
  from campaigns campaign
  left join target_metrics on target_metrics.campaign_id = campaign.id
  left join mission_metrics on mission_metrics.campaign_id = campaign.id
  left join settings on true
  order by campaign.starts_on desc, campaign.name;
end;
$$;
