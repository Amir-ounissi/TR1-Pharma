-- TR1 Pharma evolves from a brand SaaS into an operator of commercial services.
-- A commercial engagement is the contract/project layer above field execution.
-- Existing operational "missions" remain point-in-time field actions and are intentionally unchanged.

do $$
begin
  create type public.commercial_engagement_status as enum (
    'draft',
    'active',
    'paused',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.commercial_engagements (
  id uuid primary key default gen_random_uuid(),
  provider_organization_id uuid not null references public.organizations(id) on delete restrict,
  client_organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 3 and 180),
  scope_summary text,
  territory_summary text,
  status public.commercial_engagement_status not null default 'draft',
  start_date date not null,
  end_date date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date is null or end_date >= start_date)
);

create index if not exists commercial_engagements_brand_idx
  on public.commercial_engagements (brand_id, status, start_date desc)
  where archived_at is null;

create index if not exists commercial_engagements_provider_idx
  on public.commercial_engagements (provider_organization_id, status)
  where archived_at is null;

create table if not exists public.commercial_engagement_members (
  id uuid primary key default gen_random_uuid(),
  commercial_engagement_id uuid not null references public.commercial_engagements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role_key text not null check (role_key in ('lead','commercial','facilitator','trainer','viewer')),
  starts_at date not null default current_date,
  ends_at date,
  is_primary boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  unique (commercial_engagement_id, user_id, role_key)
);

create unique index if not exists commercial_engagement_members_primary_idx
  on public.commercial_engagement_members (commercial_engagement_id)
  where is_primary and ends_at is null;

create table if not exists public.commercial_engagement_territories (
  commercial_engagement_id uuid not null references public.commercial_engagements(id) on delete cascade,
  territory_id uuid not null references public.territories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (commercial_engagement_id, territory_id)
);

create table if not exists public.commercial_engagement_objectives (
  id uuid primary key default gen_random_uuid(),
  commercial_engagement_id uuid not null references public.commercial_engagements(id) on delete cascade,
  metric_key text not null check (metric_key ~ '^[a-z0-9_]{2,80}$'),
  label text not null check (char_length(btrim(label)) between 2 and 160),
  target_value numeric not null check (target_value >= 0),
  unit text not null default 'count' check (char_length(btrim(unit)) between 1 and 40),
  period_start date,
  period_end date,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);

create index if not exists commercial_engagement_objectives_engagement_idx
  on public.commercial_engagement_objectives (commercial_engagement_id, metric_key);

create or replace function private.validate_commercial_engagement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_client_organization_id uuid;
  expected_provider_organization_id uuid;
begin
  select b.organization_id, b.managed_by_organization_id
  into expected_client_organization_id, expected_provider_organization_id
  from public.brands b
  where b.id = new.brand_id;

  if expected_client_organization_id is null then
    raise exception 'Unknown brand' using errcode='23503';
  end if;

  if new.client_organization_id <> expected_client_organization_id then
    raise exception 'Commercial engagement client must own the selected brand' using errcode='23514';
  end if;

  if new.provider_organization_id <> expected_provider_organization_id then
    raise exception 'Commercial engagement provider must manage the selected brand' using errcode='23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_commercial_engagement on public.commercial_engagements;
create trigger validate_commercial_engagement
before insert or update of provider_organization_id, client_organization_id, brand_id
on public.commercial_engagements
for each row execute function private.validate_commercial_engagement();

drop trigger if exists commercial_engagements_updated_at on public.commercial_engagements;
create trigger commercial_engagements_updated_at
before update on public.commercial_engagements
for each row execute function private.set_updated_at();

create or replace function private.can_read_commercial_engagement(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_global_role(array['super_admin'])
    or exists (
      select 1
      from public.commercial_engagements engagement
      where engagement.id = target_engagement_id
        and engagement.archived_at is null
        and private.user_has_brand_access((select auth.uid()), engagement.brand_id)
    )
    or exists (
      select 1
      from public.commercial_engagement_members member_row
      where member_row.commercial_engagement_id = target_engagement_id
        and member_row.user_id = (select auth.uid())
        and member_row.starts_at <= current_date
        and (member_row.ends_at is null or member_row.ends_at >= current_date)
    );
$$;

create or replace function public.create_commercial_engagement(
  target_brand_id uuid,
  engagement_payload jsonb,
  objective_payload jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_brand public.brands%rowtype;
  new_engagement_id uuid;
  objective_record jsonb;
  normalized_name text := nullif(btrim(engagement_payload ->> 'name'),'');
  normalized_start date;
  normalized_end date;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;

  select * into selected_brand
  from public.brands
  where id = target_brand_id;

  if selected_brand.id is null then
    raise exception 'Unknown brand' using errcode='22023';
  end if;

  if normalized_name is null or char_length(normalized_name) < 3 then
    raise exception 'Commercial engagement name is required' using errcode='22023';
  end if;

  begin
    normalized_start := coalesce(nullif(engagement_payload ->> 'start_date','')::date, current_date);
    normalized_end := nullif(engagement_payload ->> 'end_date','')::date;
  exception when others then
    raise exception 'Invalid commercial engagement dates' using errcode='22023';
  end;

  if normalized_end is not null and normalized_end < normalized_start then
    raise exception 'Commercial engagement end date must follow start date' using errcode='22023';
  end if;

  insert into public.commercial_engagements (
    provider_organization_id,
    client_organization_id,
    brand_id,
    name,
    scope_summary,
    territory_summary,
    status,
    start_date,
    end_date,
    created_by
  ) values (
    selected_brand.managed_by_organization_id,
    selected_brand.organization_id,
    selected_brand.id,
    normalized_name,
    nullif(btrim(engagement_payload ->> 'scope_summary'),''),
    nullif(btrim(engagement_payload ->> 'territory_summary'),''),
    coalesce(nullif(engagement_payload ->> 'status','')::public.commercial_engagement_status, 'draft'),
    normalized_start,
    normalized_end,
    (select auth.uid())
  )
  returning id into new_engagement_id;

  insert into public.commercial_engagement_members (
    commercial_engagement_id,
    user_id,
    role_key,
    starts_at,
    is_primary,
    created_by
  )
  values (
    new_engagement_id,
    (select auth.uid()),
    'lead',
    normalized_start,
    true,
    (select auth.uid())
  );

  if jsonb_typeof(objective_payload) = 'array' then
    for objective_record in select value from jsonb_array_elements(objective_payload)
    loop
      if coalesce((objective_record ->> 'target_value')::numeric, 0) < 0 then
        raise exception 'Commercial engagement objective cannot be negative' using errcode='22023';
      end if;

      insert into public.commercial_engagement_objectives (
        commercial_engagement_id,
        metric_key,
        label,
        target_value,
        unit,
        period_start,
        period_end,
        is_primary
      ) values (
        new_engagement_id,
        lower(btrim(objective_record ->> 'metric_key')),
        btrim(objective_record ->> 'label'),
        (objective_record ->> 'target_value')::numeric,
        coalesce(nullif(btrim(objective_record ->> 'unit'),''),'count'),
        coalesce(nullif(objective_record ->> 'period_start','')::date, normalized_start),
        coalesce(nullif(objective_record ->> 'period_end','')::date, normalized_end),
        coalesce((objective_record ->> 'is_primary')::boolean, false)
      );
    end loop;
  end if;

  return new_engagement_id;
end;
$$;

revoke all on function public.create_commercial_engagement(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.create_commercial_engagement(uuid,jsonb,jsonb) to authenticated,service_role;

alter table public.commercial_engagements enable row level security;
alter table public.commercial_engagement_members enable row level security;
alter table public.commercial_engagement_territories enable row level security;
alter table public.commercial_engagement_objectives enable row level security;

drop policy if exists commercial_engagements_select on public.commercial_engagements;
create policy commercial_engagements_select on public.commercial_engagements
for select to authenticated
using (private.can_read_commercial_engagement(id));

drop policy if exists commercial_engagements_write on public.commercial_engagements;
create policy commercial_engagements_write on public.commercial_engagements
for all to authenticated
using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

drop policy if exists commercial_engagement_members_select on public.commercial_engagement_members;
create policy commercial_engagement_members_select on public.commercial_engagement_members
for select to authenticated
using (private.can_read_commercial_engagement(commercial_engagement_id));

drop policy if exists commercial_engagement_members_write on public.commercial_engagement_members;
create policy commercial_engagement_members_write on public.commercial_engagement_members
for all to authenticated
using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

drop policy if exists commercial_engagement_territories_select on public.commercial_engagement_territories;
create policy commercial_engagement_territories_select on public.commercial_engagement_territories
for select to authenticated
using (private.can_read_commercial_engagement(commercial_engagement_id));

drop policy if exists commercial_engagement_territories_write on public.commercial_engagement_territories;
create policy commercial_engagement_territories_write on public.commercial_engagement_territories
for all to authenticated
using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

drop policy if exists commercial_engagement_objectives_select on public.commercial_engagement_objectives;
create policy commercial_engagement_objectives_select on public.commercial_engagement_objectives
for select to authenticated
using (private.can_read_commercial_engagement(commercial_engagement_id));

drop policy if exists commercial_engagement_objectives_write on public.commercial_engagement_objectives;
create policy commercial_engagement_objectives_write on public.commercial_engagement_objectives
for all to authenticated
using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

revoke all on public.commercial_engagements,
  public.commercial_engagement_members,
  public.commercial_engagement_territories,
  public.commercial_engagement_objectives
from anon,authenticated;

grant select,insert,update,delete on public.commercial_engagements,
  public.commercial_engagement_members,
  public.commercial_engagement_territories,
  public.commercial_engagement_objectives
to authenticated;

grant all on public.commercial_engagements,
  public.commercial_engagement_members,
  public.commercial_engagement_territories,
  public.commercial_engagement_objectives
to service_role;

comment on table public.commercial_engagements is
  'Contract/project layer for TR1 Pharma commercial development services. Field missions remain operational actions beneath an engagement.';
