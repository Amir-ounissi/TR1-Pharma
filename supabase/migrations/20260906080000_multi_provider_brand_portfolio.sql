create table public.brand_field_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid not null,
  field_provider_id uuid not null references public.field_providers(id) on delete restrict,
  status text not null default 'active',
  contract_status public.provider_contract_status not null default 'pending',
  activities text[] not null default array['other']::text[],
  preferred boolean not null default false,
  priority smallint not null default 100,
  daily_rate_ht numeric(12,2),
  half_day_rate_ht numeric(12,2),
  travel_rate_type text,
  valid_from date,
  valid_until date,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_field_providers_brand_organization_fk
    foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint brand_field_providers_status_check
    check (status in ('active','paused','archived')),
  constraint brand_field_providers_activities_check
    check (
      cardinality(activities) > 0
      and activities <@ array['animation','training','merchandising','audit','commercial','other']::text[]
    ),
  constraint brand_field_providers_priority_check check (priority between 1 and 999),
  constraint brand_field_providers_rates_check
    check (coalesce(daily_rate_ht,0) >= 0 and coalesce(half_day_rate_ht,0) >= 0),
  constraint brand_field_providers_dates_check
    check (valid_until is null or valid_from is null or valid_until >= valid_from),
  constraint brand_field_providers_travel_rate_check
    check (travel_rate_type is null or char_length(btrim(travel_rate_type)) <= 120),
  constraint brand_field_providers_notes_check
    check (notes is null or char_length(notes) <= 4000),
  unique (brand_id, field_provider_id)
);

create index brand_field_providers_brand_status_idx
  on public.brand_field_providers(brand_id, status, preferred desc, priority, updated_at desc);
create index missions_brand_external_provider_idx
  on public.missions(brand_id, assigned_external_provider_id, scheduled_start_at desc)
  where assigned_external_provider_id is not null and archived_at is null;

create trigger brand_field_providers_updated_at
before update on public.brand_field_providers
for each row execute function private.set_updated_at();

create trigger audit_brand_field_providers
after insert or update or delete on public.brand_field_providers
for each row execute function private.audit_row_change();

create or replace function private.prepare_brand_field_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  brand_org uuid;
  provider_org uuid;
begin
  select organization_id into brand_org from public.brands where id = new.brand_id;
  select organization_id into provider_org from public.field_providers where id = new.field_provider_id;
  if brand_org is null or provider_org is null or brand_org <> provider_org then
    raise exception 'Provider and brand must belong to the same organization' using errcode = '23514';
  end if;
  new.organization_id := brand_org;
  new.activities := array(
    select distinct lower(btrim(activity))
    from unnest(new.activities) activity
    where lower(btrim(activity)) in ('animation','training','merchandising','audit','commercial','other')
    order by 1
  );
  if cardinality(new.activities) = 0 then
    new.activities := array['other']::text[];
  end if;
  new.travel_rate_type := nullif(btrim(new.travel_rate_type), '');
  new.notes := nullif(btrim(new.notes), '');
  return new;
end;
$$;

create trigger brand_field_providers_prepare
before insert or update on public.brand_field_providers
for each row execute function private.prepare_brand_field_provider();

create or replace function private.can_manage_brand_providers(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_brand_capability(target_brand_id, 'multi_provider')
    and (
      private.has_global_role(array['super_admin'])
      or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin'])
    );
$$;

revoke all on function private.can_manage_brand_providers(uuid) from public, anon, authenticated;
grant execute on function private.can_manage_brand_providers(uuid) to authenticated;

alter table public.brand_field_providers enable row level security;

create policy brand_field_providers_select
on public.brand_field_providers
for select to authenticated
using (private.can_manage_brand_providers(brand_id));

revoke all on public.brand_field_providers from public, anon, authenticated;
grant select on public.brand_field_providers to authenticated;
grant all on public.brand_field_providers to service_role;

insert into public.brand_field_providers (
  organization_id,
  brand_id,
  field_provider_id,
  status,
  contract_status,
  activities,
  daily_rate_ht,
  half_day_rate_ht,
  travel_rate_type,
  created_at,
  updated_at
)
select
  provider.organization_id,
  brand.id,
  provider.id,
  case when provider.status = 'active' then 'active' else 'paused' end,
  provider.contract_status,
  case
    when cardinality(array(
      select distinct lower(btrim(skill))
      from unnest(provider.skills) skill
      where lower(btrim(skill)) in ('animation','training','merchandising','audit','commercial')
    )) > 0
      then array(
        select distinct lower(btrim(skill))
        from unnest(provider.skills) skill
        where lower(btrim(skill)) in ('animation','training','merchandising','audit','commercial')
        order by 1
      )
    else array['other']::text[]
  end,
  provider.daily_rate_ht,
  provider.half_day_rate_ht,
  provider.travel_rate_type,
  provider.created_at,
  provider.updated_at
from public.field_providers provider
cross join lateral unnest(provider.brands_authorized) authorized_brand_id
join public.brands brand
  on brand.id = authorized_brand_id
 and brand.organization_id = provider.organization_id
on conflict (brand_id, field_provider_id) do nothing;

create or replace function private.sync_field_provider_brand_authorizations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorized_brand uuid;
  normalized_activities text[];
begin
  normalized_activities := array(
    select distinct lower(btrim(skill))
    from unnest(new.skills) skill
    where lower(btrim(skill)) in ('animation','training','merchandising','audit','commercial')
    order by 1
  );
  if cardinality(normalized_activities) = 0 then
    normalized_activities := array['other']::text[];
  end if;

  foreach authorized_brand in array new.brands_authorized loop
    if exists (
      select 1 from public.brands brand
      where brand.id = authorized_brand and brand.organization_id = new.organization_id
    ) then
      insert into public.brand_field_providers (
        organization_id, brand_id, field_provider_id, status, contract_status,
        activities, daily_rate_ht, half_day_rate_ht, travel_rate_type
      ) values (
        new.organization_id, authorized_brand, new.id,
        case when new.status = 'active' then 'active' else 'paused' end,
        new.contract_status,
        normalized_activities,
        new.daily_rate_ht,
        new.half_day_rate_ht,
        new.travel_rate_type
      )
      on conflict (brand_id, field_provider_id) do update set
        status = case
          when public.brand_field_providers.status = 'archived'
            then case when new.status = 'active' then 'active' else 'paused' end
          else public.brand_field_providers.status
        end,
        archived_at = case when public.brand_field_providers.status = 'archived' then null else public.brand_field_providers.archived_at end;
    end if;
  end loop;

  if tg_op = 'UPDATE' then
    update public.brand_field_providers relation
    set status = 'archived', archived_at = now(), updated_by = (select auth.uid())
    where relation.field_provider_id = new.id
      and relation.status <> 'archived'
      and not (relation.brand_id = any(new.brands_authorized));
  end if;
  return new;
end;
$$;

create trigger field_providers_sync_brand_authorizations
after insert or update of brands_authorized, skills, status on public.field_providers
for each row execute function private.sync_field_provider_brand_authorizations();

create or replace function public.save_brand_field_provider(
  target_brand_id uuid,
  target_field_provider_id uuid,
  target_display_name text,
  target_email text,
  target_phone text,
  target_provider_type public.field_provider_type,
  target_activities text[],
  target_contract_status public.provider_contract_status default 'pending',
  target_daily_rate_ht numeric default null,
  target_half_day_rate_ht numeric default null,
  target_travel_rate_type text default null,
  target_preferred boolean default false,
  target_priority smallint default 100,
  target_valid_from date default null,
  target_valid_until date default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  brand_record public.brands%rowtype;
  provider_id uuid := target_field_provider_id;
  relation_id uuid;
  normalized_email text := lower(btrim(target_email));
  normalized_activities text[];
  actor_id uuid := (select auth.uid());
begin
  if not private.can_manage_brand_providers(target_brand_id) then
    raise exception 'Brand provider administration access is required' using errcode = '42501';
  end if;
  select * into brand_record from public.brands where id = target_brand_id and is_active;
  if brand_record.id is null then
    raise exception 'Active brand not found' using errcode = 'P0002';
  end if;
  if nullif(btrim(target_display_name), '') is null or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Provider name and valid email are required' using errcode = '22023';
  end if;
  if coalesce(target_daily_rate_ht,0) < 0 or coalesce(target_half_day_rate_ht,0) < 0 then
    raise exception 'Provider rates cannot be negative' using errcode = '22023';
  end if;
  if target_priority not between 1 and 999 then
    raise exception 'Provider priority is invalid' using errcode = '22023';
  end if;
  if target_valid_until is not null and target_valid_from is not null and target_valid_until < target_valid_from then
    raise exception 'Provider contract dates are invalid' using errcode = '22023';
  end if;

  normalized_activities := array(
    select distinct lower(btrim(activity))
    from unnest(coalesce(target_activities, array[]::text[])) activity
    where lower(btrim(activity)) in ('animation','training','merchandising','audit','commercial','other')
    order by 1
  );
  if cardinality(normalized_activities) = 0 then
    normalized_activities := array['other']::text[];
  end if;

  if provider_id is null then
    select id into provider_id
    from public.field_providers
    where organization_id = brand_record.organization_id and lower(email) = normalized_email
    limit 1;
  end if;

  if provider_id is null then
    insert into public.field_providers (
      organization_id, provider_type, display_name, email, phone, status,
      skills, brands_authorized, contract_status, daily_rate_ht, half_day_rate_ht,
      travel_rate_type, archived_at
    ) values (
      brand_record.organization_id, target_provider_type, btrim(target_display_name), normalized_email,
      nullif(btrim(target_phone), ''), 'active', normalized_activities,
      array[target_brand_id]::uuid[], target_contract_status, target_daily_rate_ht,
      target_half_day_rate_ht, nullif(btrim(target_travel_rate_type), ''), null
    ) returning id into provider_id;
  else
    if not exists (
      select 1 from public.field_providers
      where id = provider_id and organization_id = brand_record.organization_id
    ) then
      raise exception 'Provider does not belong to the brand organization' using errcode = '42501';
    end if;
    update public.field_providers provider
    set provider_type = target_provider_type,
        display_name = btrim(target_display_name),
        email = normalized_email,
        phone = nullif(btrim(target_phone), ''),
        status = 'active',
        skills = (
          select array_agg(distinct item order by item)
          from unnest(provider.skills || normalized_activities) item
        ),
        brands_authorized = (
          select array_agg(distinct item order by item)
          from unnest(provider.brands_authorized || array[target_brand_id]::uuid[]) item
        ),
        archived_at = null
    where provider.id = provider_id;
  end if;

  insert into public.brand_field_providers (
    organization_id, brand_id, field_provider_id, status, contract_status, activities,
    preferred, priority, daily_rate_ht, half_day_rate_ht, travel_rate_type,
    valid_from, valid_until, notes, created_by, updated_by, archived_at
  ) values (
    brand_record.organization_id, target_brand_id, provider_id, 'active', target_contract_status,
    normalized_activities, target_preferred, target_priority, target_daily_rate_ht,
    target_half_day_rate_ht, nullif(btrim(target_travel_rate_type), ''), target_valid_from,
    target_valid_until, nullif(btrim(target_notes), ''), actor_id, actor_id, null
  )
  on conflict (brand_id, field_provider_id) do update set
    status = 'active',
    contract_status = excluded.contract_status,
    activities = excluded.activities,
    preferred = excluded.preferred,
    priority = excluded.priority,
    daily_rate_ht = excluded.daily_rate_ht,
    half_day_rate_ht = excluded.half_day_rate_ht,
    travel_rate_type = excluded.travel_rate_type,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    notes = excluded.notes,
    updated_by = actor_id,
    archived_at = null
  returning id into relation_id;

  return relation_id;
end;
$$;

create or replace function public.set_brand_field_provider_status(
  target_brand_id uuid,
  target_relation_id uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_record public.brand_field_providers%rowtype;
begin
  if not private.can_manage_brand_providers(target_brand_id) then
    raise exception 'Brand provider administration access is required' using errcode = '42501';
  end if;
  if target_status not in ('active','paused','archived') then
    raise exception 'Invalid brand provider status' using errcode = '22023';
  end if;

  select * into relation_record
  from public.brand_field_providers
  where id = target_relation_id and brand_id = target_brand_id
  for update;
  if relation_record.id is null then
    raise exception 'Brand provider relation not found' using errcode = 'P0002';
  end if;

  update public.brand_field_providers
  set status = target_status,
      archived_at = case when target_status = 'archived' then now() else null end,
      updated_by = (select auth.uid())
  where id = relation_record.id;

  if target_status = 'archived' then
    update public.field_providers provider
    set brands_authorized = array(
      select brand_id from unnest(provider.brands_authorized) brand_id
      where brand_id <> target_brand_id
      order by 1
    )
    where provider.id = relation_record.field_provider_id;
  else
    update public.field_providers provider
    set brands_authorized = (
      select array_agg(distinct brand_id order by brand_id)
      from unnest(provider.brands_authorized || array[target_brand_id]::uuid[]) brand_id
    )
    where provider.id = relation_record.field_provider_id;
  end if;
end;
$$;

create or replace function public.get_brand_field_provider_portfolio(target_brand_id uuid)
returns table (
  relation_id uuid,
  field_provider_id uuid,
  display_name text,
  email text,
  phone text,
  provider_type text,
  relation_status text,
  contract_status text,
  activities text[],
  preferred boolean,
  priority smallint,
  daily_rate_ht numeric,
  half_day_rate_ht numeric,
  travel_rate_type text,
  valid_from date,
  valid_until date,
  notes text,
  missions_total bigint,
  upcoming_missions bigint,
  completed_90d bigint,
  cost_90d numeric,
  last_mission_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_brand_providers(target_brand_id) then
    raise exception 'Brand provider administration access is required' using errcode = '42501';
  end if;

  return query
  select
    relation.id,
    provider.id,
    provider.display_name,
    provider.email,
    provider.phone,
    provider.provider_type::text,
    relation.status,
    relation.contract_status::text,
    relation.activities,
    relation.preferred,
    relation.priority,
    relation.daily_rate_ht,
    relation.half_day_rate_ht,
    relation.travel_rate_type,
    relation.valid_from,
    relation.valid_until,
    relation.notes,
    coalesce(metrics.missions_total,0),
    coalesce(metrics.upcoming_missions,0),
    coalesce(metrics.completed_90d,0),
    coalesce(metrics.cost_90d,0),
    metrics.last_mission_at
  from public.brand_field_providers relation
  join public.field_providers provider on provider.id = relation.field_provider_id
  left join lateral (
    select
      count(*)::bigint as missions_total,
      count(*) filter (
        where mission.status in ('assigned','accepted','scheduled')
          and mission.scheduled_start_at >= now()
      )::bigint as upcoming_missions,
      count(*) filter (
        where mission.status = 'completed'
          and coalesce(mission.completed_at, mission.actual_end_at, mission.scheduled_end_at) >= now() - interval '90 days'
      )::bigint as completed_90d,
      coalesce(sum(
        case
          when mission.status = 'completed'
           and coalesce(mission.completed_at, mission.actual_end_at, mission.scheduled_end_at) >= now() - interval '90 days'
          then coalesce(mission.cost_actual_ht, mission.provider_cost_ht, 0)
          else 0
        end
      ),0)::numeric as cost_90d,
      max(coalesce(mission.actual_end_at, mission.completed_at, mission.scheduled_end_at, mission.scheduled_start_at)) as last_mission_at
    from public.missions mission
    where mission.brand_id = target_brand_id
      and mission.assigned_external_provider_id = provider.id
      and mission.archived_at is null
  ) metrics on true
  where relation.brand_id = target_brand_id
    and relation.status <> 'archived'
  order by relation.preferred desc, relation.priority asc, provider.display_name asc;
end;
$$;

revoke all on function public.save_brand_field_provider(uuid,uuid,text,text,text,public.field_provider_type,text[],public.provider_contract_status,numeric,numeric,text,boolean,smallint,date,date,text) from public, anon;
revoke all on function public.set_brand_field_provider_status(uuid,uuid,text) from public, anon;
revoke all on function public.get_brand_field_provider_portfolio(uuid) from public, anon;

grant execute on function public.save_brand_field_provider(uuid,uuid,text,text,text,public.field_provider_type,text[],public.provider_contract_status,numeric,numeric,text,boolean,smallint,date,date,text) to authenticated;
grant execute on function public.set_brand_field_provider_status(uuid,uuid,text) to authenticated;
grant execute on function public.get_brand_field_provider_portfolio(uuid) to authenticated;
