create table public.data_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid not null,
  entity_type public.import_entity_type not null,
  name text not null,
  source_system text not null default 'generic_csv',
  mapping jsonb not null default '{}'::jsonb,
  transforms jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  version integer not null default 1,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_mapping_profiles_brand_organization_fk
    foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint data_mapping_profiles_name_check
    check (char_length(btrim(name)) between 2 and 120),
  constraint data_mapping_profiles_source_system_check
    check (char_length(btrim(source_system)) between 2 and 120),
  constraint data_mapping_profiles_mapping_object_check
    check (jsonb_typeof(mapping) = 'object' and octet_length(mapping::text) <= 32768),
  constraint data_mapping_profiles_transforms_object_check
    check (jsonb_typeof(transforms) = 'object' and octet_length(transforms::text) <= 16384),
  constraint data_mapping_profiles_version_check check (version > 0)
);

create unique index data_mapping_profiles_name_unique
  on public.data_mapping_profiles(brand_id, entity_type, lower(name))
  where is_active;

create unique index data_mapping_profiles_default_unique
  on public.data_mapping_profiles(brand_id, entity_type)
  where is_active and is_default;

create index data_mapping_profiles_brand_entity_idx
  on public.data_mapping_profiles(brand_id, entity_type, updated_at desc)
  where is_active;

create trigger data_mapping_profiles_updated_at
before update on public.data_mapping_profiles
for each row execute function private.set_updated_at();

create or replace function private.prepare_data_mapping_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id
  from public.brands
  where id = new.brand_id;

  if new.organization_id is null then
    raise exception 'Unknown brand' using errcode = '22023';
  end if;

  new.name := btrim(new.name);
  new.source_system := lower(regexp_replace(btrim(new.source_system), '[^a-zA-Z0-9_-]+', '_', 'g'));
  if tg_op = 'UPDATE' and (new.mapping is distinct from old.mapping or new.transforms is distinct from old.transforms) then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

create trigger data_mapping_profiles_prepare
before insert or update on public.data_mapping_profiles
for each row execute function private.prepare_data_mapping_profile();

create trigger audit_data_mapping_profiles
after insert or update or delete on public.data_mapping_profiles
for each row execute function private.audit_row_change();

alter table public.data_mapping_profiles enable row level security;

create policy data_mapping_profiles_select
on public.data_mapping_profiles
for select to authenticated
using (
  private.can_access_brand(brand_id)
  or private.has_global_role(array['super_admin'])
);

revoke all on public.data_mapping_profiles from public, anon, authenticated;
grant select on public.data_mapping_profiles to authenticated;
grant all on public.data_mapping_profiles to service_role;

create or replace function public.save_data_mapping_profile(
  target_brand_id uuid,
  target_profile_id uuid,
  target_name text,
  target_entity_type public.import_entity_type,
  target_source_system text,
  target_mapping jsonb,
  target_transforms jsonb default '{}'::jsonb,
  target_is_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  actor_id uuid := (select auth.uid());
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Brand administration access is required' using errcode = '42501';
  end if;

  if target_mapping is null or jsonb_typeof(target_mapping) <> 'object' then
    raise exception 'Mapping must be a JSON object' using errcode = '22023';
  end if;
  if target_transforms is null or jsonb_typeof(target_transforms) <> 'object' then
    raise exception 'Transforms must be a JSON object' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(target_name, ''))) < 2 then
    raise exception 'Profile name is required' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(target_source_system, ''))) < 2 then
    raise exception 'Source system is required' using errcode = '22023';
  end if;

  if target_is_default then
    update public.data_mapping_profiles
    set is_default = false, updated_by = actor_id
    where brand_id = target_brand_id
      and entity_type = target_entity_type
      and is_active
      and is_default
      and (target_profile_id is null or id <> target_profile_id);
  end if;

  if target_profile_id is null then
    insert into public.data_mapping_profiles(
      organization_id,
      brand_id,
      entity_type,
      name,
      source_system,
      mapping,
      transforms,
      is_default,
      created_by,
      updated_by
    )
    select
      brand.organization_id,
      brand.id,
      target_entity_type,
      target_name,
      target_source_system,
      target_mapping,
      target_transforms,
      target_is_default,
      actor_id,
      actor_id
    from public.brands brand
    where brand.id = target_brand_id
    returning id into result_id;
  else
    update public.data_mapping_profiles
    set entity_type = target_entity_type,
        name = target_name,
        source_system = target_source_system,
        mapping = target_mapping,
        transforms = target_transforms,
        is_default = target_is_default,
        is_active = true,
        updated_by = actor_id
    where id = target_profile_id
      and brand_id = target_brand_id
    returning id into result_id;
  end if;

  if result_id is null then
    raise exception 'Mapping profile not found' using errcode = 'P0002';
  end if;

  return result_id;
end;
$$;

create or replace function public.archive_data_mapping_profile(
  target_brand_id uuid,
  target_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Brand administration access is required' using errcode = '42501';
  end if;

  update public.data_mapping_profiles
  set is_active = false,
      is_default = false,
      updated_by = (select auth.uid())
  where id = target_profile_id
    and brand_id = target_brand_id
    and is_active;

  if not found then
    raise exception 'Mapping profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.save_data_mapping_profile(uuid,uuid,text,public.import_entity_type,text,jsonb,jsonb,boolean) from public, anon;
grant execute on function public.save_data_mapping_profile(uuid,uuid,text,public.import_entity_type,text,jsonb,jsonb,boolean) to authenticated, service_role;

revoke all on function public.archive_data_mapping_profile(uuid,uuid) from public, anon;
grant execute on function public.archive_data_mapping_profile(uuid,uuid) to authenticated, service_role;
