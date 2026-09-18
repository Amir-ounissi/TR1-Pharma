-- #211 — Brand-level coverage of fresh field data.
-- Uses the same commercial panel definition as get_sell_out_overview.

create or replace function public.get_field_data_coverage(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date
)
returns table(
  panel_pharmacies bigint,
  sell_out_pharmacies bigint,
  price_pharmacies bigint,
  combined_pharmacies bigint,
  sell_out_coverage_rate numeric,
  price_coverage_rate numeric,
  combined_coverage_rate numeric,
  latest_sell_out_at timestamptz,
  latest_price_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    private.has_global_role(array['super_admin'])
    or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user'])
  ) then
    raise exception 'Field data coverage access forbidden' using errcode = '42501';
  end if;

  if target_period_start is null
     or target_period_end is null
     or target_period_end < target_period_start then
    raise exception 'Invalid field data coverage period' using errcode = '22023';
  end if;

  return query
  with panel as (
    select relation.id
    from public.brand_pharmacies relation
    where relation.brand_id = target_brand_id
      and relation.archived_at is null
      and relation.commercial_status in ('implanted','active','to_develop','dormant')
  ),
  sell_out_recent as (
    select distinct capture.brand_pharmacy_id
    from public.sell_out_captures capture
    join panel on panel.id = capture.brand_pharmacy_id
    where capture.brand_id = target_brand_id
      and capture.status = 'validated'
      and capture.archived_at is null
      and capture.period_end >= target_period_start
      and capture.period_start <= target_period_end
  ),
  price_recent as (
    select distinct observation.brand_pharmacy_id
    from public.pharmacy_price_observations observation
    join panel on panel.id = observation.brand_pharmacy_id
    where observation.brand_id = target_brand_id
      and observation.archived_at is null
      and observation.observed_at::date between target_period_start and target_period_end
  ),
  totals as (
    select
      (select count(*)::bigint from panel) as panel_count,
      (select count(*)::bigint from sell_out_recent) as sell_out_count,
      (select count(*)::bigint from price_recent) as price_count,
      (
        select count(*)::bigint
        from sell_out_recent sell_out
        join price_recent price using (brand_pharmacy_id)
      ) as combined_count,
      (
        select max(capture.observed_at)
        from public.sell_out_captures capture
        join panel on panel.id = capture.brand_pharmacy_id
        where capture.brand_id = target_brand_id
          and capture.status = 'validated'
          and capture.archived_at is null
          and capture.period_end >= target_period_start
          and capture.period_start <= target_period_end
      ) as latest_sell_out,
      (
        select max(observation.observed_at)
        from public.pharmacy_price_observations observation
        join panel on panel.id = observation.brand_pharmacy_id
        where observation.brand_id = target_brand_id
          and observation.archived_at is null
          and observation.observed_at::date between target_period_start and target_period_end
      ) as latest_price
  )
  select
    totals.panel_count,
    totals.sell_out_count,
    totals.price_count,
    totals.combined_count,
    case
      when totals.panel_count = 0 then 0::numeric
      else round(totals.sell_out_count::numeric * 100.0 / totals.panel_count::numeric, 2)
    end,
    case
      when totals.panel_count = 0 then 0::numeric
      else round(totals.price_count::numeric * 100.0 / totals.panel_count::numeric, 2)
    end,
    case
      when totals.panel_count = 0 then 0::numeric
      else round(totals.combined_count::numeric * 100.0 / totals.panel_count::numeric, 2)
    end,
    totals.latest_sell_out,
    totals.latest_price
  from totals;
end;
$$;

revoke all on function public.get_field_data_coverage(uuid,date,date) from public, anon;
grant execute on function public.get_field_data_coverage(uuid,date,date) to authenticated, service_role;

comment on function public.get_field_data_coverage(uuid,date,date) is
  'Fresh field-data coverage across the active commercial pharmacy panel: validated sell-out, observed prices, and pharmacies with both.';
