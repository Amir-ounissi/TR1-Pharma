create table public.saas_quota_definitions (
  key text primary key,
  label text not null,
  description text not null,
  unit text not null,
  period text not null default 'month',
  capability_key text references public.saas_capabilities(key) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_quota_definitions_key_check check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint saas_quota_definitions_unit_check check (unit ~ '^[a-z][a-z0-9_]{1,31}$'),
  constraint saas_quota_definitions_period_check check (period in ('month','year','lifetime'))
);

create table public.saas_plan_quotas (
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  quota_key text not null references public.saas_quota_definitions(key) on delete cascade,
  limit_value bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, quota_key),
  constraint saas_plan_quotas_limit_check check (limit_value is null or limit_value > 0)
);

create table public.brand_saas_quota_overrides (
  brand_id uuid not null references public.brands(id) on delete cascade,
  quota_key text not null references public.saas_quota_definitions(key) on delete cascade,
  limit_value bigint,
  reason text,
  expires_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, quota_key),
  constraint brand_saas_quota_overrides_limit_check check (limit_value is null or limit_value > 0),
  constraint brand_saas_quota_overrides_reason_check check (reason is null or char_length(reason) <= 500)
);

create table public.brand_billing_accounts (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  billing_mode text not null default 'manual',
  provider_key text,
  external_customer_ref text,
  external_subscription_ref text,
  billing_email text,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_billing_accounts_mode_check check (billing_mode in ('manual','external')),
  constraint brand_billing_accounts_provider_check check (
    provider_key is null or provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'
  ),
  constraint brand_billing_accounts_external_provider_check check (
    billing_mode <> 'external' or provider_key is not null
  ),
  constraint brand_billing_accounts_customer_ref_check check (
    external_customer_ref is null or char_length(external_customer_ref) <= 255
  ),
  constraint brand_billing_accounts_subscription_ref_check check (
    external_subscription_ref is null or char_length(external_subscription_ref) <= 255
  ),
  constraint brand_billing_accounts_email_check check (
    billing_email is null or (char_length(billing_email) <= 320 and position('@' in billing_email) > 1)
  ),
  constraint brand_billing_accounts_metadata_check check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384
  )
);

create table private.saas_usage_counters (
  brand_id uuid not null references public.brands(id) on delete cascade,
  quota_key text not null references public.saas_quota_definitions(key) on delete cascade,
  period_start date not null,
  period_end date not null,
  used_value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, quota_key, period_start),
  constraint saas_usage_counters_period_check check (period_end > period_start),
  constraint saas_usage_counters_value_check check (used_value >= 0)
);

create table private.saas_usage_idempotency (
  brand_id uuid not null references public.brands(id) on delete cascade,
  quota_key text not null references public.saas_quota_definitions(key) on delete cascade,
  period_start date not null,
  idempotency_key text not null,
  quantity bigint not null,
  created_at timestamptz not null default now(),
  primary key (brand_id, quota_key, period_start, idempotency_key),
  constraint saas_usage_idempotency_key_check check (
    char_length(btrim(idempotency_key)) between 1 and 200
  ),
  constraint saas_usage_idempotency_quantity_check check (quantity > 0)
);

create index saas_usage_counters_brand_idx
  on private.saas_usage_counters(brand_id, period_start desc);
create index saas_usage_idempotency_created_idx
  on private.saas_usage_idempotency(brand_id, created_at desc);

insert into public.saas_quota_definitions(
  key,label,description,unit,period,capability_key
) values
  ('data_rows_monthly','Lignes de données','Volume de lignes traité par les flux de données et mappings.','rows','month','data_mapping'),
  ('pdf_orders_monthly','Commandes PDF','Nombre de commandes PDF traitées par la plateforme.','documents','month','pdf_order_import'),
  ('connector_runs_monthly','Exécutions connecteurs','Nombre d’exécutions de synchronisation des connecteurs externes.','runs','month','connectors'),
  ('api_requests_monthly','Requêtes API','Nombre de requêtes comptabilisées sur l’accès API tenant.','requests','month','api_access')
on conflict (key) do update set
  label=excluded.label,
  description=excluded.description,
  unit=excluded.unit,
  period=excluded.period,
  capability_key=excluded.capability_key,
  is_active=true;

insert into public.saas_plan_quotas(plan_id,quota_key,limit_value)
select plan.id, quota.key, null
from public.saas_plans plan
cross join public.saas_quota_definitions quota
where plan.is_active and quota.is_active
on conflict (plan_id,quota_key) do nothing;

create trigger saas_quota_definitions_updated_at
before update on public.saas_quota_definitions
for each row execute function private.set_updated_at();
create trigger saas_plan_quotas_updated_at
before update on public.saas_plan_quotas
for each row execute function private.set_updated_at();
create trigger brand_saas_quota_overrides_updated_at
before update on public.brand_saas_quota_overrides
for each row execute function private.set_updated_at();
create trigger brand_billing_accounts_updated_at
before update on public.brand_billing_accounts
for each row execute function private.set_updated_at();

alter table public.saas_quota_definitions enable row level security;
alter table public.saas_plan_quotas enable row level security;
alter table public.brand_saas_quota_overrides enable row level security;
alter table public.brand_billing_accounts enable row level security;
alter table private.saas_usage_counters enable row level security;
alter table private.saas_usage_idempotency enable row level security;

create policy saas_quota_definitions_select on public.saas_quota_definitions
for select to authenticated using (is_active);
create policy saas_plan_quotas_select on public.saas_plan_quotas
for select to authenticated using (
  exists (
    select 1
    from public.saas_plans plan
    where plan.id=plan_id
      and (plan.is_public or private.has_global_role(array['super_admin']))
  )
);
create policy brand_saas_quota_overrides_select on public.brand_saas_quota_overrides
for select to authenticated using (private.has_global_role(array['super_admin']));
create policy brand_billing_accounts_select on public.brand_billing_accounts
for select to authenticated using (private.has_global_role(array['super_admin']));

revoke all on public.saas_quota_definitions,public.saas_plan_quotas,public.brand_saas_quota_overrides,public.brand_billing_accounts from anon,authenticated;
grant select on public.saas_quota_definitions,public.saas_plan_quotas,public.brand_saas_quota_overrides,public.brand_billing_accounts to authenticated;
grant all on public.saas_quota_definitions,public.saas_plan_quotas,public.brand_saas_quota_overrides,public.brand_billing_accounts to service_role;

revoke all on private.saas_usage_counters,private.saas_usage_idempotency from public,anon,authenticated;

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
      when 'month' then date_trunc('month',target_at)::date
      when 'year' then date_trunc('year',target_at)::date
      when 'lifetime' then date '1970-01-01'
    end,
    case target_period
      when 'month' then (date_trunc('month',target_at) + interval '1 month')::date
      when 'year' then (date_trunc('year',target_at) + interval '1 year')::date
      when 'lifetime' then date '9999-12-31'
    end;
$$;

revoke all on function private.saas_quota_period_bounds(text,timestamptz) from public,anon,authenticated;

create or replace function private.get_effective_saas_quota(
  target_brand_id uuid,
  target_quota_key text,
  target_at timestamptz default now()
)
returns table(limit_value bigint,source text)
language sql
stable
security definer
set search_path=''
as $$
  with entitlement as (
    select plan.id as plan_id, plan.key as plan_key
    from public.brand_saas_entitlements entitlement
    join public.saas_plans plan on plan.id=entitlement.plan_id and plan.is_active
    where entitlement.brand_id=target_brand_id
      and entitlement.status in ('trialing','active')
      and (entitlement.ends_at is null or entitlement.ends_at > target_at)
  ), live_override as (
    select override_row.quota_key, override_row.limit_value
    from public.brand_saas_quota_overrides override_row
    where override_row.brand_id=target_brand_id
      and override_row.quota_key=target_quota_key
      and (override_row.expires_at is null or override_row.expires_at > target_at)
  )
  select
    case
      when live_override.quota_key is not null then live_override.limit_value
      when entitlement.plan_key='legacy_full' then null
      when plan_quota.quota_key is not null then plan_quota.limit_value
      else null
    end,
    case
      when entitlement.plan_id is null then 'none'
      when live_override.quota_key is not null then 'override'
      when entitlement.plan_key='legacy_full' then 'legacy_full'
      when plan_quota.quota_key is not null then 'plan'
      else 'none'
    end::text
  from public.saas_quota_definitions quota
  left join entitlement on true
  left join public.saas_plan_quotas plan_quota
    on plan_quota.plan_id=entitlement.plan_id
   and plan_quota.quota_key=quota.key
  left join live_override on live_override.quota_key=quota.key
  where quota.key=target_quota_key
    and quota.is_active;
$$;

revoke all on function private.get_effective_saas_quota(uuid,text,timestamptz) from public,anon,authenticated;

create or replace function public.get_brand_saas_subscription(target_brand_id uuid)
returns table(
  plan_key text,
  plan_name text,
  entitlement_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  seat_limit integer,
  seats_used bigint,
  seats_remaining bigint,
  billing_mode text,
  billing_ready boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not private.has_brand_role(target_brand_id,array['tr1_manager','brand_admin']) then
    raise exception 'Brand SaaS commercial access is required' using errcode='42501';
  end if;

  return query
  select
    plan.key,
    plan.name,
    entitlement.status,
    entitlement.starts_at,
    entitlement.ends_at,
    entitlement.seat_limit,
    coalesce(seats.used_count,0),
    case
      when entitlement.seat_limit is null then null
      else greatest(entitlement.seat_limit::bigint-coalesce(seats.used_count,0),0)
    end,
    coalesce(billing.billing_mode,'unconfigured')::text,
    case
      when billing.brand_id is null then false
      when billing.billing_mode='manual' then true
      when billing.billing_mode='external' then
        billing.provider_key is not null
        and billing.external_customer_ref is not null
        and billing.external_subscription_ref is not null
      else false
    end
  from public.brand_saas_entitlements entitlement
  join public.saas_plans plan on plan.id=entitlement.plan_id
  left join lateral (
    select count(distinct membership.user_id)::bigint as used_count
    from public.memberships membership
    where membership.brand_id=target_brand_id
      and membership.status in ('invited','active')
  ) seats on true
  left join public.brand_billing_accounts billing on billing.brand_id=target_brand_id
  where entitlement.brand_id=target_brand_id;
end;
$$;

create or replace function public.get_brand_saas_usage(target_brand_id uuid)
returns table(
  quota_key text,
  label text,
  unit text,
  period text,
  period_start date,
  period_end date,
  limit_value bigint,
  used_value bigint,
  remaining_value bigint,
  exceeded boolean,
  source text
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not private.has_brand_role(target_brand_id,array['tr1_manager','brand_admin']) then
    raise exception 'Brand SaaS commercial access is required' using errcode='42501';
  end if;

  return query
  select
    quota.key,
    quota.label,
    quota.unit,
    quota.period,
    bounds.period_start,
    bounds.period_end,
    effective.limit_value,
    coalesce(counter.used_value,0),
    case
      when effective.limit_value is null then null
      else greatest(effective.limit_value-coalesce(counter.used_value,0),0)
    end,
    effective.limit_value is not null and coalesce(counter.used_value,0) > effective.limit_value,
    effective.source
  from public.saas_quota_definitions quota
  cross join lateral private.saas_quota_period_bounds(quota.period,now()) bounds
  cross join lateral private.get_effective_saas_quota(target_brand_id,quota.key,now()) effective
  left join private.saas_usage_counters counter
    on counter.brand_id=target_brand_id
   and counter.quota_key=quota.key
   and counter.period_start=bounds.period_start
  where quota.is_active
    and (
      quota.capability_key is null
      or exists (
        select 1
        from public.get_my_brand_capabilities(target_brand_id) capability
        where capability.capability_key=quota.capability_key
          and capability.enabled
      )
    )
  order by quota.key;
end;
$$;

create or replace function public.set_saas_plan_quota(
  target_plan_key text,
  target_quota_key text,
  target_limit_value bigint default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  target_plan_id uuid;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;
  if target_limit_value is not null and target_limit_value <= 0 then
    raise exception 'Quota limit must be positive' using errcode='22023';
  end if;

  select id into target_plan_id
  from public.saas_plans
  where key=target_plan_key and is_active;
  if target_plan_id is null then
    raise exception 'Unknown SaaS plan' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.saas_quota_definitions
    where key=target_quota_key and is_active
  ) then
    raise exception 'Unknown SaaS quota' using errcode='22023';
  end if;

  insert into public.saas_plan_quotas(plan_id,quota_key,limit_value)
  values(target_plan_id,target_quota_key,target_limit_value)
  on conflict (plan_id,quota_key) do update set
    limit_value=excluded.limit_value;
end;
$$;

create or replace function public.set_brand_saas_quota_override(
  target_brand_id uuid,
  target_quota_key text,
  target_limit_value bigint default null,
  target_reason text default null,
  target_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;
  if target_limit_value is not null and target_limit_value <= 0 then
    raise exception 'Quota limit must be positive' using errcode='22023';
  end if;
  if target_expires_at is not null and target_expires_at <= now() then
    raise exception 'Override expiry must be in the future' using errcode='22023';
  end if;
  if not exists(select 1 from public.brands where id=target_brand_id) then
    raise exception 'Unknown brand' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.saas_quota_definitions
    where key=target_quota_key and is_active
  ) then
    raise exception 'Unknown SaaS quota' using errcode='22023';
  end if;

  insert into public.brand_saas_quota_overrides(
    brand_id,quota_key,limit_value,reason,expires_at,created_by,updated_by
  ) values(
    target_brand_id,target_quota_key,target_limit_value,nullif(btrim(target_reason),''),target_expires_at,(select auth.uid()),(select auth.uid())
  )
  on conflict (brand_id,quota_key) do update set
    limit_value=excluded.limit_value,
    reason=excluded.reason,
    expires_at=excluded.expires_at,
    updated_by=(select auth.uid());
end;
$$;

create or replace function public.clear_brand_saas_quota_override(
  target_brand_id uuid,
  target_quota_key text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;

  delete from public.brand_saas_quota_overrides
  where brand_id=target_brand_id and quota_key=target_quota_key;
end;
$$;

create or replace function public.set_brand_billing_account(
  target_brand_id uuid,
  target_billing_mode text,
  target_provider_key text default null,
  target_external_customer_ref text default null,
  target_external_subscription_ref text default null,
  target_billing_email text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_provider text := nullif(lower(btrim(target_provider_key)),'');
  normalized_customer_ref text := nullif(btrim(target_external_customer_ref),'');
  normalized_subscription_ref text := nullif(btrim(target_external_subscription_ref),'');
  normalized_email text := nullif(lower(btrim(target_billing_email)),'');
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;
  if target_billing_mode not in ('manual','external') then
    raise exception 'Invalid billing mode' using errcode='22023';
  end if;
  if not exists(select 1 from public.brands where id=target_brand_id) then
    raise exception 'Unknown brand' using errcode='22023';
  end if;
  if target_billing_mode='external' and normalized_provider is null then
    raise exception 'External billing provider is required' using errcode='22023';
  end if;

  if target_billing_mode='manual' then
    normalized_provider := null;
    normalized_customer_ref := null;
    normalized_subscription_ref := null;
  end if;

  insert into public.brand_billing_accounts(
    brand_id,billing_mode,provider_key,external_customer_ref,external_subscription_ref,billing_email,updated_by
  ) values(
    target_brand_id,target_billing_mode,normalized_provider,normalized_customer_ref,normalized_subscription_ref,normalized_email,(select auth.uid())
  )
  on conflict (brand_id) do update set
    billing_mode=excluded.billing_mode,
    provider_key=excluded.provider_key,
    external_customer_ref=excluded.external_customer_ref,
    external_subscription_ref=excluded.external_subscription_ref,
    billing_email=excluded.billing_email,
    updated_by=(select auth.uid());
end;
$$;

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

  if exists(
    select 1
    from private.saas_usage_idempotency usage_key
    where usage_key.brand_id=target_brand_id
      and usage_key.quota_key=target_quota_key
      and usage_key.period_start=usage_period_start
      and usage_key.idempotency_key=btrim(target_idempotency_key)
  ) then
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

create or replace function private.enforce_brand_seat_limit()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  target_limit integer;
  used_seats bigint;
begin
  if new.brand_id is null or new.status not in ('invited','active') then
    return new;
  end if;

  select entitlement.seat_limit into target_limit
  from public.brand_saas_entitlements entitlement
  where entitlement.brand_id=new.brand_id
  for update;

  if not found then
    raise exception 'Brand SaaS entitlement is required before assigning seats' using errcode='23514';
  end if;
  if target_limit is null then
    return new;
  end if;

  if exists(
    select 1
    from public.memberships membership
    where membership.brand_id=new.brand_id
      and membership.user_id=new.user_id
      and membership.status in ('invited','active')
      and membership.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    return new;
  end if;

  select count(distinct membership.user_id)::bigint into used_seats
  from public.memberships membership
  where membership.brand_id=new.brand_id
    and membership.status in ('invited','active')
    and membership.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if used_seats >= target_limit then
    raise exception 'SaaS seat limit reached for this brand' using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_brand_seat_limit() from public,anon,authenticated;

create trigger enforce_brand_seat_limit_before_insert
before insert on public.memberships
for each row execute function private.enforce_brand_seat_limit();
create trigger enforce_brand_seat_limit_before_update
before update of brand_id,user_id,status on public.memberships
for each row execute function private.enforce_brand_seat_limit();

create or replace function public.set_brand_saas_plan(
  target_brand_id uuid,
  target_plan_key text,
  target_status text default 'active',
  target_seat_limit integer default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  selected_plan_id uuid;
  used_seats bigint;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;
  if target_status not in ('trialing','active','suspended') then
    raise exception 'Invalid SaaS entitlement status' using errcode='22023';
  end if;
  if target_seat_limit is not null and target_seat_limit <= 0 then
    raise exception 'Seat limit must be positive' using errcode='22023';
  end if;

  select id into selected_plan_id
  from public.saas_plans
  where key=target_plan_key and is_active;
  if selected_plan_id is null then
    raise exception 'Unknown SaaS plan' using errcode='22023';
  end if;
  if not exists(select 1 from public.brands where id=target_brand_id) then
    raise exception 'Unknown brand' using errcode='22023';
  end if;

  select count(distinct membership.user_id)::bigint into used_seats
  from public.memberships membership
  where membership.brand_id=target_brand_id
    and membership.status in ('invited','active');
  if target_seat_limit is not null and target_seat_limit < used_seats then
    raise exception 'Seat limit cannot be below current seat usage (%)',used_seats using errcode='23514';
  end if;

  insert into public.brand_saas_entitlements(
    brand_id,plan_id,status,seat_limit,created_by,updated_by
  ) values(
    target_brand_id,selected_plan_id,target_status,target_seat_limit,(select auth.uid()),(select auth.uid())
  )
  on conflict (brand_id) do update set
    plan_id=excluded.plan_id,
    status=excluded.status,
    seat_limit=excluded.seat_limit,
    starts_at=case when public.brand_saas_entitlements.plan_id<>excluded.plan_id then now() else public.brand_saas_entitlements.starts_at end,
    ends_at=null,
    updated_by=(select auth.uid());
end;
$$;

revoke all on function public.get_brand_saas_subscription(uuid),public.get_brand_saas_usage(uuid),public.set_saas_plan_quota(text,text,bigint),public.set_brand_saas_quota_override(uuid,text,bigint,text,timestamptz),public.clear_brand_saas_quota_override(uuid,text),public.set_brand_billing_account(uuid,text,text,text,text,text),public.record_brand_saas_usage(uuid,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.get_brand_saas_subscription(uuid),public.get_brand_saas_usage(uuid) to authenticated,service_role;
grant execute on function public.set_saas_plan_quota(text,text,bigint),public.set_brand_saas_quota_override(uuid,text,bigint,text,timestamptz),public.clear_brand_saas_quota_override(uuid,text),public.set_brand_billing_account(uuid,text,text,text,text,text) to authenticated,service_role;
grant execute on function public.record_brand_saas_usage(uuid,text,bigint,text) to service_role;

-- Preserve the existing SaaS RPC signature while keeping execution explicit.
revoke all on function public.set_brand_saas_plan(uuid,text,text,integer) from public,anon;
grant execute on function public.set_brand_saas_plan(uuid,text,text,integer) to authenticated,service_role;

drop trigger if exists audit_brand_saas_entitlements on public.brand_saas_entitlements;
create trigger audit_brand_saas_entitlements
after insert or update or delete on public.brand_saas_entitlements
for each row execute function private.audit_row_change();
drop trigger if exists audit_brand_capability_overrides on public.brand_capability_overrides;
create trigger audit_brand_capability_overrides
after insert or update or delete on public.brand_capability_overrides
for each row execute function private.audit_row_change();
create trigger audit_brand_saas_quota_overrides
after insert or update or delete on public.brand_saas_quota_overrides
for each row execute function private.audit_row_change();
create trigger audit_brand_billing_accounts
after insert or update or delete on public.brand_billing_accounts
for each row execute function private.audit_row_change();

comment on table public.saas_quota_definitions is 'Canonical measurable SaaS quotas. Feature access remains governed separately by saas_capabilities.';
comment on table public.saas_plan_quotas is 'Per-plan quota limits. NULL means unlimited; commercial values can be changed without redeploying TR1.';
comment on table public.brand_saas_quota_overrides is 'Explicit per-brand quota exceptions. A live override wins over the plan quota.';
comment on table private.saas_usage_counters is 'Trusted aggregated SaaS consumption counters, kept outside exposed schemas.';
comment on table private.saas_usage_idempotency is 'Idempotency ledger preventing duplicate SaaS consumption on retries.';
comment on table public.brand_billing_accounts is 'Provider-neutral billing readiness references. No payment provider is coupled to product entitlements.';
comment on function public.get_brand_saas_subscription(uuid) is 'Tenant-admin readable plan, seat usage and billing readiness overview.';
comment on function public.get_brand_saas_usage(uuid) is 'Tenant-admin readable effective quota and consumption matrix.';
comment on function public.record_brand_saas_usage(uuid,text,bigint,text) is 'Trusted service-role-only idempotent metering entry point with quota enforcement.';