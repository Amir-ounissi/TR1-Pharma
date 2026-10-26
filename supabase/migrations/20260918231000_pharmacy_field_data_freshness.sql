-- #222 — Deterministic freshness of pharmacy field data.
-- Rules are intentionally transparent:
-- 0-30 days = fresh, 31-60 = refresh, >60 = stale, no data = never.

create or replace function private.field_data_freshness_status(age_days integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when age_days is null then 'never'
    when age_days <= 30 then 'fresh'
    when age_days <= 60 then 'refresh'
    else 'stale'
  end
$$;

create or replace function public.get_pharmacy_field_data_freshness(
  target_brand_pharmacy_id uuid
)
returns table(
  sell_out_status text,
  sell_out_days integer,
  sell_out_as_of date,
  sell_out_quality text,
  price_status text,
  price_days integer,
  price_as_of timestamptz,
  audit_status text,
  audit_days integer,
  audit_as_of timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  relation record;
  sell_out_end date;
  sell_out_quality_value text;
  price_observed_at timestamptz;
  audit_observed_at timestamptz;
  sell_out_age integer;
  price_age integer;
  audit_age integer;
begin
  select id, brand_id
  into relation
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id
    and archived_at is null;

  if relation.id is null or not private.can_access_brand_pharmacy(relation.id) then
    raise exception 'Field data freshness access forbidden' using errcode = '42501';
  end if;

  select capture.period_end, capture.quality::text
  into sell_out_end, sell_out_quality_value
  from public.sell_out_captures capture
  where capture.brand_id = relation.brand_id
    and capture.brand_pharmacy_id = relation.id
    and capture.status = 'validated'
    and capture.archived_at is null
  order by capture.period_end desc, capture.observed_at desc
  limit 1;

  select max(observation.observed_at)
  into price_observed_at
  from public.pharmacy_price_observations observation
  where observation.brand_id = relation.brand_id
    and observation.brand_pharmacy_id = relation.id
    and observation.archived_at is null;

  select max(audit.audited_at)
  into audit_observed_at
  from public.field_visit_audits audit
  where audit.brand_id = relation.brand_id
    and audit.brand_pharmacy_id = relation.id;

  sell_out_age := case
    when sell_out_end is null then null
    else greatest(0, current_date - sell_out_end)
  end;
  price_age := case
    when price_observed_at is null then null
    else greatest(0, current_date - price_observed_at::date)
  end;
  audit_age := case
    when audit_observed_at is null then null
    else greatest(0, current_date - audit_observed_at::date)
  end;

  return query
  select
    private.field_data_freshness_status(sell_out_age),
    sell_out_age,
    sell_out_end,
    sell_out_quality_value,
    private.field_data_freshness_status(price_age),
    price_age,
    price_observed_at,
    private.field_data_freshness_status(audit_age),
    audit_age,
    audit_observed_at;
end;
$$;

revoke all on function public.get_pharmacy_field_data_freshness(uuid) from public, anon;
grant execute on function public.get_pharmacy_field_data_freshness(uuid) to authenticated, service_role;

comment on function public.get_pharmacy_field_data_freshness(uuid) is
  'Explainable freshness of validated sell-out, observed price and 4P+ audit for one brand-pharmacy relation. 0-30d fresh, 31-60d refresh, >60d stale, absent never.';
