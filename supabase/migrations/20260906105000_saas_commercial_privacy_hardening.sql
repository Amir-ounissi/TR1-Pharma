-- Commercial SaaS privacy and metering hardening.
-- Keep commercial terms admin-scoped while runtime feature gates remain available
-- through the existing effective-capability RPCs.

drop policy if exists saas_quota_definitions_select on public.saas_quota_definitions;
create policy saas_quota_definitions_select on public.saas_quota_definitions
for select to authenticated using (private.has_global_role(array['super_admin']));

drop policy if exists saas_plan_quotas_select on public.saas_plan_quotas;
create policy saas_plan_quotas_select on public.saas_plan_quotas
for select to authenticated using (private.has_global_role(array['super_admin']));

drop policy if exists brand_saas_entitlements_select on public.brand_saas_entitlements;
create policy brand_saas_entitlements_select on public.brand_saas_entitlements
for select to authenticated using (
  private.has_brand_role(brand_id,array['tr1_manager','brand_admin'])
);

drop policy if exists brand_capability_overrides_select on public.brand_capability_overrides;
create policy brand_capability_overrides_select on public.brand_capability_overrides
for select to authenticated using (
  private.has_brand_role(brand_id,array['tr1_manager','brand_admin'])
);

-- Billing periods are evaluated in UTC so the same timestamp always resolves to
-- the same accounting bucket regardless of the database session timezone.
create or replace function private.saas_quota_period_bounds(
  target_period text,
  target_at timestamptz
)
returns table(period_start date,period_end date)
language sql
immutable
security invoker
set search_path=''
as $$
  select
    case target_period
      when 'month' then date_trunc('month',target_at at time zone 'UTC')::date
      when 'year' then date_trunc('year',target_at at time zone 'UTC')::date
      when 'lifetime' then date '1970-01-01'
    end,
    case target_period
      when 'month' then (date_trunc('month',target_at at time zone 'UTC') + interval '1 month')::date
      when 'year' then (date_trunc('year',target_at at time zone 'UTC') + interval '1 year')::date
      when 'lifetime' then date '9999-12-31'
    end;
$$;

revoke all on function private.saas_quota_period_bounds(text,timestamptz) from public,anon,authenticated;

create or replace function public.record_brand_saas_usage(
  target_brand_id uuid,
  target_quota_key text,
  target_quantity bigint,
  target_idempotency_key text
)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  quota_period text;
  usage_period_start date;
  usage_period_end date;
  effective_limit bigint;
  existing_quantity bigint;
  current_used bigint := 0;
  next_used bigint;
begin
  if target_quantity <= 0 then
    raise exception 'Usage quantity must be positive' using errcode='22023';
  end if;
  if char_length(btrim(coalesce(target_idempotency_key,''))) not between 1 and 200 then
    raise exception 'Usage idempotency key is required' using errcode='22023';
  end if;

  select quota.period into quota_period
  from public.saas_quota_definitions quota
  where quota.key=target_quota_key and quota.is_active;
  if quota_period is null then
    raise exception 'Unknown SaaS quota' using errcode='22023';
  end if;
  if not exists(select 1 from public.brands where id=target_brand_id) then
    raise exception 'Unknown brand' using errcode='22023';
  end if;
  if not exists(
    select 1
    from public.brand_saas_entitlements entitlement
    where entitlement.brand_id=target_brand_id
      and entitlement.status in ('trialing','active')
      and (entitlement.ends_at is null or entitlement.ends_at > now())
  ) then
    raise exception 'SaaS entitlement is not active' using errcode='23514';
  end if;

  select bounds.period_start,bounds.period_end
  into usage_period_start,usage_period_end
  from private.saas_quota_period_bounds(quota_period,now()) bounds;

  perform pg_advisory_xact_lock(
    hashtextextended(target_brand_id::text || ':' || target_quota_key || ':' || usage_period_start::text,0)
  );

  select usage_key.quantity into existing_quantity
  from private.saas_usage_idempotency usage_key
  where usage_key.brand_id=target_brand_id
    and usage_key.quota_key=target_quota_key
    and usage_key.period_start=usage_period_start
    and usage_key.idempotency_key=btrim(target_idempotency_key);

  if found then
    if existing_quantity <> target_quantity then
      raise exception 'SaaS usage idempotency key reused with a different quantity' using errcode='23514';
    end if;

    select coalesce(counter.used_value,0) into current_used
    from private.saas_usage_counters counter
    where counter.brand_id=target_brand_id
      and counter.quota_key=target_quota_key
      and counter.period_start=usage_period_start;
    return coalesce(current_used,0);
  end if;

  select effective.limit_value into effective_limit
  from private.get_effective_saas_quota(target_brand_id,target_quota_key,now()) effective;

  select coalesce(counter.used_value,0) into current_used
  from private.saas_usage_counters counter
  where counter.brand_id=target_brand_id
    and counter.quota_key=target_quota_key
    and counter.period_start=usage_period_start;
  current_used := coalesce(current_used,0);

  if effective_limit is not null and current_used + target_quantity > effective_limit then
    raise exception 'SaaS quota exceeded for %',target_quota_key using errcode='23514';
  end if;

  insert into private.saas_usage_idempotency(
    brand_id,quota_key,period_start,idempotency_key,quantity
  ) values(
    target_brand_id,target_quota_key,usage_period_start,btrim(target_idempotency_key),target_quantity
  );

  insert into private.saas_usage_counters(
    brand_id,quota_key,period_start,period_end,used_value
  ) values(
    target_brand_id,target_quota_key,usage_period_start,usage_period_end,target_quantity
  )
  on conflict (brand_id,quota_key,period_start) do update set
    period_end=excluded.period_end,
    used_value=private.saas_usage_counters.used_value+excluded.used_value,
    updated_at=now()
  returning used_value into next_used;

  return next_used;
end;
$$;

revoke all on function public.record_brand_saas_usage(uuid,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.record_brand_saas_usage(uuid,text,bigint,text) to service_role;

comment on function private.saas_quota_period_bounds(text,timestamptz) is 'Returns deterministic UTC SaaS accounting period bounds.';
comment on function public.record_brand_saas_usage(uuid,text,bigint,text) is 'Trusted service-role-only metering entry point. Idempotency retries must preserve the original quantity.';
