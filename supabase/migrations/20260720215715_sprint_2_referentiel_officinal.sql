create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

alter type public.pharmacy_status rename to commercial_status;

create type public.pharmacy_group_type as enum (
  'national_group', 'regional_group', 'banner', 'network',
  'wholesaler_distributor', 'independent', 'other'
);
create type public.territory_type as enum ('country', 'region', 'department', 'postal_area', 'custom');
create type public.activity_status as enum ('never_ordered', 'active', 'watch', 'at_risk', 'dormant', 'lost');
create type public.priority_level as enum ('low', 'normal', 'high', 'strategic');
create type public.potential_level as enum ('unknown', 'low', 'medium', 'high', 'very_high');
create type public.pharmacy_source as enum (
  'tr1_prospecting', 'brand_existing_client', 'agent', 'referral',
  'groupement', 'event', 'inbound', 'import', 'other'
);
create type public.implantation_status as enum (
  'planned', 'implanted', 'active', 'temporarily_unavailable', 'removed'
);
create type public.contact_channel as enum ('email', 'phone', 'sms', 'visit', 'other');
create type public.import_entity_type as enum ('pharmacies', 'contacts', 'brand_pharmacies', 'products');
create type public.import_strategy as enum ('create_only', 'update_only', 'upsert', 'skip_duplicates');
create type public.import_status as enum ('preview', 'confirmed', 'failed', 'cancelled');

alter table public.pharmacies drop constraint if exists pharmacies_group_brand_fk;
alter table public.pharmacies drop constraint if exists pharmacies_territory_brand_fk;

drop policy if exists groups_select on public.groups;
drop policy if exists groups_manage on public.groups;
alter table public.groups rename to pharmacy_groups;
alter table public.pharmacy_groups
  drop constraint if exists groups_brand_id_name_key,
  drop constraint if exists groups_id_brand_unique,
  drop column brand_id;
alter table public.pharmacy_groups rename column external_code to notes;
alter table public.pharmacy_groups
  add column group_type public.pharmacy_group_type not null default 'other',
  add column parent_group_id uuid references public.pharmacy_groups(id) on delete set null,
  add column website text,
  add column headquarters_city text,
  add column archived_at timestamptz;
create unique index pharmacy_groups_active_name_unique
  on public.pharmacy_groups (lower(btrim(name))) where archived_at is null;

drop policy if exists territories_select on public.territories;
drop policy if exists territories_manage on public.territories;
alter table public.territories
  drop constraint if exists territories_brand_id_name_key,
  drop constraint if exists territories_id_brand_unique,
  alter column brand_id drop not null,
  add column organization_id uuid references public.organizations(id) on delete cascade,
  add column territory_type public.territory_type not null default 'custom',
  add column parent_territory_id uuid references public.territories(id) on delete set null,
  add column country_code char(2) not null default 'FR',
  add column region_code text,
  add column department_code text,
  add column postal_codes text[],
  add column archived_at timestamptz;
update public.territories t
set organization_id = b.organization_id
from public.brands b
where b.id = t.brand_id and t.organization_id is null;
alter table public.territories alter column organization_id set not null;
create unique index territories_active_scope_name_unique
  on public.territories (organization_id, coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)))
  where archived_at is null;

drop policy if exists pharmacies_select on public.pharmacies;
drop policy if exists pharmacies_manage on public.pharmacies;
drop policy if exists pharmacy_contacts_select on public.pharmacy_contacts;
drop policy if exists pharmacy_contacts_operate on public.pharmacy_contacts;

alter table public.pharmacy_contacts drop constraint if exists pharmacy_contacts_pharmacy_brand_fk;
alter table public.pharmacy_assignments drop constraint if exists pharmacy_assignments_pharmacy_brand_fk;
alter table public.interactions drop constraint if exists interactions_pharmacy_brand_fk;
alter table public.tasks drop constraint if exists tasks_pharmacy_brand_fk;
alter table public.orders drop constraint if exists orders_pharmacy_brand_fk;
alter table public.missions drop constraint if exists missions_pharmacy_brand_fk;
alter table public.pharmacies
  drop constraint if exists pharmacies_group_brand_fk,
  drop constraint if exists pharmacies_territory_brand_fk,
  drop constraint if exists pharmacies_id_brand_unique,
  drop constraint if exists pharmacies_brand_id_external_code_key;

alter table public.pharmacies
  add column legal_name text,
  add column trade_name text,
  add column cip_code text,
  add column finess_code text,
  add column siret text,
  add column phone text,
  add column email text,
  add column website text,
  add column address_line_1 text,
  add column address_line_2 text,
  add column latitude numeric(9,6),
  add column longitude numeric(9,6),
  add column pharmacy_group_id uuid references public.pharmacy_groups(id) on delete set null,
  add column is_active boolean not null default true,
  add column archived_at timestamptz,
  add column created_by uuid references public.users(id) on delete set null;
update public.pharmacies
set legal_name = name,
    trade_name = name,
    address_line_1 = address_line1,
    pharmacy_group_id = group_id;
alter table public.pharmacies
  alter column legal_name set not null,
  drop column group_id,
  drop column name,
  drop column address_line1,
  drop column external_code;
create unique index pharmacies_cip_unique
  on public.pharmacies (upper(btrim(cip_code))) where cip_code is not null and btrim(cip_code) <> '';
create unique index pharmacies_finess_unique
  on public.pharmacies (upper(btrim(finess_code))) where finess_code is not null and btrim(finess_code) <> '';
create unique index pharmacies_siret_unique
  on public.pharmacies (upper(btrim(siret))) where siret is not null and btrim(siret) <> '';
create index pharmacies_search_trgm_idx on public.pharmacies using gin (
  (coalesce(trade_name, '') || ' ' || legal_name || ' ' || coalesce(city, '') || ' ' || coalesce(postal_code, '')) extensions.gin_trgm_ops
);
create index pharmacies_group_idx on public.pharmacies(pharmacy_group_id) where archived_at is null;

alter table public.pharmacy_contacts
  add column first_name text,
  add column last_name text,
  add column preferred_contact_channel public.contact_channel,
  add column notes text,
  add column archived_at timestamptz;
update public.pharmacy_contacts
set first_name = case when strpos(full_name, ' ') > 0 then split_part(full_name, ' ', 1) else full_name end,
    last_name = case when strpos(full_name, ' ') > 0 then substr(full_name, strpos(full_name, ' ') + 1) else '' end;
alter table public.pharmacy_contacts
  alter column first_name set not null,
  alter column last_name set not null,
  drop column brand_id,
  drop column full_name;
create unique index pharmacy_contacts_one_primary_active
  on public.pharmacy_contacts(pharmacy_id) where is_primary and archived_at is null;

alter table public.products
  drop constraint if exists products_brand_id_name_key,
  add column sku text,
  add column ean text,
  add column category text,
  add column format text,
  add column wholesale_price_ht numeric(12,2),
  add column retail_price_ttc numeric(12,2),
  add column launch_date date,
  add column discontinued_at timestamptz;
with first_reference as (
  select distinct on (pr.product_id) pr.product_id, pr.sku, pr.ean, pr.unit_price
  from public.product_references pr
  order by pr.product_id, pr.created_at
)
update public.products p
set sku = r.sku,
    ean = r.ean,
    wholesale_price_ht = r.unit_price
from first_reference r
where r.product_id = p.id;
update public.products set sku = 'LEGACY-' || left(id::text, 8) where sku is null;
alter table public.products
  alter column sku set not null,
  add constraint products_wholesale_price_nonnegative check (wholesale_price_ht is null or wholesale_price_ht >= 0),
  add constraint products_retail_price_nonnegative check (retail_price_ttc is null or retail_price_ttc >= 0);
create unique index products_brand_sku_unique on public.products(brand_id, upper(btrim(sku)));
create unique index products_ean_unique on public.products(upper(btrim(ean))) where ean is not null and btrim(ean) <> '';

create table public.brand_pharmacies (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
  commercial_status public.commercial_status not null default 'targeted',
  activity_status public.activity_status not null default 'never_ordered',
  priority_level public.priority_level not null default 'normal',
  potential_level public.potential_level not null default 'unknown',
  potential_score numeric(5,2) check (potential_score is null or potential_score between 0 and 100),
  source public.pharmacy_source not null default 'tr1_prospecting',
  source_details text,
  current_agent_user_id uuid references public.users(id) on delete set null,
  tr1_manager_user_id uuid references public.users(id) on delete set null,
  territory_id uuid references public.territories(id) on delete set null,
  first_contact_at timestamptz,
  implanted_at timestamptz,
  activated_at timestamptz,
  dormant_since timestamptz,
  lost_at timestamptz,
  lost_reason text,
  last_interaction_at timestamptz,
  last_order_at timestamptz,
  next_action_type text,
  next_action_at timestamptz,
  next_action_owner_id uuid references public.users(id) on delete set null,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  unique (id, brand_id, pharmacy_id)
);
create unique index brand_pharmacies_one_active_relation
  on public.brand_pharmacies(brand_id, pharmacy_id) where archived_at is null;
create index brand_pharmacies_list_idx
  on public.brand_pharmacies(brand_id, commercial_status, activity_status, priority_level) where archived_at is null;
create index brand_pharmacies_agent_idx
  on public.brand_pharmacies(current_agent_user_id, brand_id) where archived_at is null;
create index brand_pharmacies_territory_idx
  on public.brand_pharmacies(territory_id, brand_id) where archived_at is null;

insert into public.brand_pharmacies (
  brand_id, pharmacy_id, commercial_status, territory_id, source, created_at, updated_at
)
select brand_id, id, status, territory_id, 'import', created_at, updated_at
from public.pharmacies;

alter table public.pharmacy_assignments add column brand_pharmacy_id uuid;
alter table public.interactions add column brand_pharmacy_id uuid;
alter table public.tasks add column brand_pharmacy_id uuid;
alter table public.orders add column brand_pharmacy_id uuid;
alter table public.missions add column brand_pharmacy_id uuid;
update public.pharmacy_assignments x set brand_pharmacy_id = bp.id
from public.brand_pharmacies bp where bp.brand_id = x.brand_id and bp.pharmacy_id = x.pharmacy_id and bp.archived_at is null;
update public.interactions x set brand_pharmacy_id = bp.id
from public.brand_pharmacies bp where bp.brand_id = x.brand_id and bp.pharmacy_id = x.pharmacy_id and bp.archived_at is null;
update public.tasks x set brand_pharmacy_id = bp.id
from public.brand_pharmacies bp where bp.brand_id = x.brand_id and bp.pharmacy_id = x.pharmacy_id and bp.archived_at is null;
update public.orders x set brand_pharmacy_id = bp.id
from public.brand_pharmacies bp where bp.brand_id = x.brand_id and bp.pharmacy_id = x.pharmacy_id and bp.archived_at is null;
update public.missions x set brand_pharmacy_id = bp.id
from public.brand_pharmacies bp where bp.brand_id = x.brand_id and bp.pharmacy_id = x.pharmacy_id and bp.archived_at is null;
alter table public.pharmacy_assignments alter column brand_pharmacy_id set not null;
alter table public.interactions alter column brand_pharmacy_id set not null;
alter table public.tasks alter column brand_pharmacy_id set not null;
alter table public.orders alter column brand_pharmacy_id set not null;
alter table public.missions alter column brand_pharmacy_id set not null;
alter table public.pharmacy_assignments add constraint pharmacy_assignments_brand_pharmacy_fk
  foreign key (brand_pharmacy_id, brand_id, pharmacy_id) references public.brand_pharmacies(id, brand_id, pharmacy_id) on delete cascade;
alter table public.interactions add constraint interactions_brand_pharmacy_fk
  foreign key (brand_pharmacy_id, brand_id, pharmacy_id) references public.brand_pharmacies(id, brand_id, pharmacy_id) on delete cascade;
alter table public.tasks add constraint tasks_brand_pharmacy_fk
  foreign key (brand_pharmacy_id, brand_id, pharmacy_id) references public.brand_pharmacies(id, brand_id, pharmacy_id) on delete cascade;
alter table public.orders add constraint orders_brand_pharmacy_fk
  foreign key (brand_pharmacy_id, brand_id, pharmacy_id) references public.brand_pharmacies(id, brand_id, pharmacy_id);
alter table public.missions add constraint missions_brand_pharmacy_fk
  foreign key (brand_pharmacy_id, brand_id, pharmacy_id) references public.brand_pharmacies(id, brand_id, pharmacy_id) on delete cascade;
alter table public.pharmacies drop column brand_id, drop column status, drop column territory_id;

create table public.brand_pharmacy_products (
  id uuid primary key default gen_random_uuid(),
  brand_pharmacy_id uuid not null references public.brand_pharmacies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  status public.implantation_status not null default 'planned',
  first_implanted_at timestamptz,
  last_confirmed_at timestamptz,
  removed_at timestamptz,
  removal_reason text,
  source public.pharmacy_source not null default 'tr1_prospecting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brand_pharmacy_products_one_active
  on public.brand_pharmacy_products(brand_pharmacy_id, product_id)
  where status <> 'removed' and removed_at is null;

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  entity_type public.import_entity_type not null,
  strategy public.import_strategy not null,
  status public.import_status not null default 'preview',
  file_name text not null,
  column_mapping jsonb not null default '{}'::jsonb,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  error_report jsonb
);
create table public.import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  line_number integer not null,
  payload jsonb not null,
  normalized_payload jsonb not null,
  errors text[] not null default '{}',
  is_valid boolean not null default false,
  is_duplicate boolean not null default false,
  processed_entity_id uuid,
  created_at timestamptz not null default now(),
  unique(batch_id, line_number)
);

create or replace function private.normalize_reference_text(value text)
returns text language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(lower(extensions.unaccent(coalesce(value, ''))), '[^a-z0-9]+', ' ', 'g'), '');
$$;

create or replace function public.find_pharmacy_duplicates(
  candidate_siret text default null,
  candidate_cip text default null,
  candidate_finess text default null,
  candidate_name text default null,
  candidate_postal_code text default null,
  candidate_address text default null
)
returns table (pharmacy_id uuid, match_reason text, confidence integer)
language sql stable security invoker set search_path = '' as $$
  select distinct on (p.id) p.id,
    case
      when candidate_siret is not null and upper(btrim(p.siret)) = upper(btrim(candidate_siret)) then 'siret'
      when candidate_cip is not null and upper(btrim(p.cip_code)) = upper(btrim(candidate_cip)) then 'cip'
      when candidate_finess is not null and upper(btrim(p.finess_code)) = upper(btrim(candidate_finess)) then 'finess'
      when private.normalize_reference_text(coalesce(p.trade_name, p.legal_name)) = private.normalize_reference_text(candidate_name)
        and p.postal_code = candidate_postal_code then 'name_postal_code'
      else 'address'
    end,
    case
      when candidate_siret is not null and upper(btrim(p.siret)) = upper(btrim(candidate_siret)) then 100
      when candidate_cip is not null and upper(btrim(p.cip_code)) = upper(btrim(candidate_cip)) then 100
      when candidate_finess is not null and upper(btrim(p.finess_code)) = upper(btrim(candidate_finess)) then 100
      when private.normalize_reference_text(coalesce(p.trade_name, p.legal_name)) = private.normalize_reference_text(candidate_name)
        and p.postal_code = candidate_postal_code then 80
      else 60
    end
  from public.pharmacies p
  where private.can_access_pharmacy(p.id) and (
    (candidate_siret is not null and upper(btrim(p.siret)) = upper(btrim(candidate_siret))) or
    (candidate_cip is not null and upper(btrim(p.cip_code)) = upper(btrim(candidate_cip))) or
    (candidate_finess is not null and upper(btrim(p.finess_code)) = upper(btrim(candidate_finess))) or
    (candidate_name is not null and candidate_postal_code is not null
      and private.normalize_reference_text(coalesce(p.trade_name, p.legal_name)) = private.normalize_reference_text(candidate_name)
      and p.postal_code = candidate_postal_code) or
    (candidate_address is not null and private.normalize_reference_text(p.address_line_1) = private.normalize_reference_text(candidate_address))
  )
  order by p.id, 3 desc;
$$;

create or replace function private.user_has_brand_access(target_user_id uuid, target_brand_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_user_id is null or exists (
    select 1 from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = target_user_id and m.status = 'active'
      and (m.brand_id = target_brand_id or (m.brand_id is null and r.key = 'super_admin'))
  );
$$;

create or replace function private.validate_brand_pharmacy()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pharmacy_archived_at timestamptz;
  territory_brand_id uuid;
  territory_organization_id uuid;
  brand_organization_id uuid;
  managed_by_organization_id uuid;
begin
  select archived_at into pharmacy_archived_at from public.pharmacies where id = new.pharmacy_id;
  if new.archived_at is null and pharmacy_archived_at is not null then
    raise exception 'An archived pharmacy cannot receive an active brand relation' using errcode = '23514';
  end if;
  if not private.user_has_brand_access(new.current_agent_user_id, new.brand_id)
    or not private.user_has_brand_access(new.tr1_manager_user_id, new.brand_id)
    or not private.user_has_brand_access(new.next_action_owner_id, new.brand_id) then
    raise exception 'Assigned users must have active access to the brand' using errcode = '23514';
  end if;
  if new.territory_id is not null then
    select t.brand_id, t.organization_id into territory_brand_id, territory_organization_id
    from public.territories t where t.id = new.territory_id and t.archived_at is null;
    select b.organization_id, b.managed_by_organization_id into brand_organization_id, managed_by_organization_id
    from public.brands b where b.id = new.brand_id;
    if territory_organization_id is null or not (
      territory_brand_id = new.brand_id or
      (territory_brand_id is null and territory_organization_id in (brand_organization_id, managed_by_organization_id))
    ) then
      raise exception 'Territory is outside the brand scope' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_brand_pharmacy_product()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.brand_pharmacies bp
    join public.products p on p.id = new.product_id and p.brand_id = bp.brand_id
    where bp.id = new.brand_pharmacy_id
  ) then
    raise exception 'Product and brand pharmacy must belong to the same brand' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.can_access_brand_pharmacy(target_brand_pharmacy_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.brand_pharmacies bp
    where bp.id = target_brand_pharmacy_id and bp.archived_at is null and (
      private.has_elevated_brand_access(bp.brand_id) or
      (bp.current_agent_user_id = (select auth.uid())) or exists (
        select 1 from public.pharmacy_assignments pa
        join public.agents a on a.id = pa.agent_id
        where pa.brand_pharmacy_id = bp.id and a.user_id = (select auth.uid())
          and pa.starts_at <= current_date and (pa.ends_at is null or pa.ends_at >= current_date)
      )
    )
  );
$$;

create or replace function private.can_access_pharmacy(target_pharmacy_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_global_role(array['super_admin']) or exists (
    select 1 from public.brand_pharmacies bp
    where bp.pharmacy_id = target_pharmacy_id and private.can_access_brand_pharmacy(bp.id)
  );
$$;

create or replace function private.enforce_brand_pharmacy_update_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if private.has_elevated_brand_access(old.brand_id) then
    return new;
  end if;
  if old.current_agent_user_id = (select auth.uid()) and
    (to_jsonb(new) - array['potential_level','potential_score','next_action_type','next_action_at','next_action_owner_id','notes','last_interaction_at','updated_at']) =
    (to_jsonb(old) - array['potential_level','potential_score','next_action_type','next_action_at','next_action_owner_id','notes','last_interaction_at','updated_at']) then
    return new;
  end if;
  raise exception 'Agent update scope exceeded' using errcode = '42501';
end;
$$;

create trigger validate_brand_pharmacy before insert or update on public.brand_pharmacies
for each row execute function private.validate_brand_pharmacy();
create trigger enforce_brand_pharmacy_update_scope before update on public.brand_pharmacies
for each row execute function private.enforce_brand_pharmacy_update_scope();
create trigger set_brand_pharmacies_updated_at before update on public.brand_pharmacies
for each row execute function private.set_updated_at();
create trigger validate_brand_pharmacy_product before insert or update on public.brand_pharmacy_products
for each row execute function private.validate_brand_pharmacy_product();
create trigger set_brand_pharmacy_products_updated_at before update on public.brand_pharmacy_products
for each row execute function private.set_updated_at();
create trigger audit_brand_pharmacies after insert or update or delete on public.brand_pharmacies
for each row execute function private.audit_row_change();
create trigger audit_brand_pharmacy_products after insert or update or delete on public.brand_pharmacy_products
for each row execute function private.audit_row_change();
create trigger audit_pharmacy_contacts after insert or update or delete on public.pharmacy_contacts
for each row execute function private.audit_row_change();
create trigger audit_pharmacy_groups after insert or update or delete on public.pharmacy_groups
for each row execute function private.audit_row_change();
create trigger audit_territories after insert or update or delete on public.territories
for each row execute function private.audit_row_change();

alter table public.pharmacy_groups enable row level security;
alter table public.territories enable row level security;
alter table public.pharmacies enable row level security;
alter table public.pharmacy_contacts enable row level security;
alter table public.brand_pharmacies enable row level security;
alter table public.brand_pharmacy_products enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;

revoke all on public.pharmacy_groups, public.brand_pharmacies, public.brand_pharmacy_products, public.import_batches, public.import_rows from anon;
grant select, insert, update on public.pharmacy_groups, public.territories, public.pharmacies, public.pharmacy_contacts,
  public.products, public.brand_pharmacies, public.brand_pharmacy_products, public.import_batches, public.import_rows to authenticated;
grant usage, select on sequence public.import_rows_id_seq to authenticated;
grant all on public.pharmacy_groups, public.brand_pharmacies, public.brand_pharmacy_products, public.import_batches, public.import_rows to service_role;

create policy pharmacy_groups_select on public.pharmacy_groups for select to authenticated
using (private.has_global_role(array['super_admin']) or exists (
  select 1 from public.pharmacies p where p.pharmacy_group_id = id and private.can_access_pharmacy(p.id)
));
create policy pharmacy_groups_insert on public.pharmacy_groups for insert to authenticated
with check (private.has_global_role(array['super_admin']) or exists (
  select 1 from public.memberships m join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and r.key in ('tr1_manager','brand_admin')
));
create policy pharmacy_groups_update on public.pharmacy_groups for update to authenticated
using (private.has_global_role(array['super_admin']) or exists (
  select 1 from public.memberships m join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and r.key in ('tr1_manager','brand_admin')
))
with check (private.has_global_role(array['super_admin']) or exists (
  select 1 from public.memberships m join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and r.key in ('tr1_manager','brand_admin')
));

create policy territories_select on public.territories for select to authenticated
using ((brand_id is not null and private.can_access_brand(brand_id)) or
  (brand_id is null and exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active' and m.organization_id = organization_id
  )) or private.has_global_role(array['super_admin']));
create policy territories_insert on public.territories for insert to authenticated
with check ((brand_id is not null and private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) or private.has_global_role(array['super_admin']));
create policy territories_update on public.territories for update to authenticated
using ((brand_id is not null and private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) or private.has_global_role(array['super_admin']))
with check ((brand_id is not null and private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) or private.has_global_role(array['super_admin']));

create policy pharmacies_select on public.pharmacies for select to authenticated using (private.can_access_pharmacy(id));
create policy pharmacies_insert on public.pharmacies for insert to authenticated
with check (private.has_global_role(array['super_admin']) or exists (
  select 1 from public.memberships m join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and r.key in ('tr1_manager','brand_admin')
));
create policy pharmacies_update on public.pharmacies for update to authenticated
using (private.can_access_pharmacy(id) and (private.has_global_role(array['super_admin']) or exists (
  select 1 from public.brand_pharmacies bp where bp.pharmacy_id = id
    and private.has_brand_role(bp.brand_id, array['tr1_manager','brand_admin'])
)))
with check (private.can_access_pharmacy(id));

create policy pharmacy_contacts_select on public.pharmacy_contacts for select to authenticated
using (private.can_access_pharmacy(pharmacy_id));
create policy pharmacy_contacts_insert on public.pharmacy_contacts for insert to authenticated
with check (private.can_access_pharmacy(pharmacy_id));
create policy pharmacy_contacts_update on public.pharmacy_contacts for update to authenticated
using (private.can_access_pharmacy(pharmacy_id)) with check (private.can_access_pharmacy(pharmacy_id));

drop policy if exists products_select on public.products;
drop policy if exists products_manage on public.products;
create policy products_select on public.products for select to authenticated using (private.can_access_brand(brand_id));
create policy products_insert on public.products for insert to authenticated
with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy products_update on public.products for update to authenticated
using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']))
with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));

create policy brand_pharmacies_select on public.brand_pharmacies for select to authenticated
using (
  private.has_elevated_brand_access(brand_id) or
  (archived_at is null and (
    current_agent_user_id = (select auth.uid()) or exists (
      select 1
      from public.pharmacy_assignments pa
      join public.agents a on a.id = pa.agent_id
      where pa.brand_pharmacy_id = brand_pharmacies.id
        and a.user_id = (select auth.uid())
        and pa.starts_at <= current_date
        and (pa.ends_at is null or pa.ends_at >= current_date)
    )
  ))
);
create policy brand_pharmacies_insert on public.brand_pharmacies for insert to authenticated
with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy brand_pharmacies_update on public.brand_pharmacies for update to authenticated
using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']) or current_agent_user_id = (select auth.uid()))
with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']) or current_agent_user_id = (select auth.uid()));

create policy brand_pharmacy_products_select on public.brand_pharmacy_products for select to authenticated
using (private.can_access_brand_pharmacy(brand_pharmacy_id));
create policy brand_pharmacy_products_insert on public.brand_pharmacy_products for insert to authenticated
with check (exists (
  select 1 from public.brand_pharmacies bp where bp.id = brand_pharmacy_id
    and private.has_brand_role(bp.brand_id, array['tr1_manager','brand_admin'])
));
create policy brand_pharmacy_products_update on public.brand_pharmacy_products for update to authenticated
using (exists (
  select 1 from public.brand_pharmacies bp where bp.id = brand_pharmacy_id
    and private.has_brand_role(bp.brand_id, array['tr1_manager','brand_admin'])
))
with check (exists (
  select 1 from public.brand_pharmacies bp where bp.id = brand_pharmacy_id
    and private.has_brand_role(bp.brand_id, array['tr1_manager','brand_admin'])
));

create policy import_batches_select on public.import_batches for select to authenticated
using (created_by = (select auth.uid()) or private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy import_batches_insert on public.import_batches for insert to authenticated
with check (created_by = (select auth.uid()) and private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy import_batches_update on public.import_batches for update to authenticated
using (created_by = (select auth.uid()) and status = 'preview')
with check (created_by = (select auth.uid()));
create policy import_rows_select on public.import_rows for select to authenticated
using (exists (select 1 from public.import_batches b where b.id = batch_id));
create policy import_rows_insert on public.import_rows for insert to authenticated
with check (exists (select 1 from public.import_batches b where b.id = batch_id and b.created_by = (select auth.uid()) and b.status = 'preview'));
create policy import_rows_update on public.import_rows for update to authenticated
using (exists (select 1 from public.import_batches b where b.id = batch_id and b.created_by = (select auth.uid()) and b.status = 'preview'))
with check (exists (select 1 from public.import_batches b where b.id = batch_id and b.created_by = (select auth.uid())));

revoke all on function private.normalize_reference_text(text) from public, anon;
grant execute on function private.normalize_reference_text(text) to authenticated, service_role;
revoke all on function private.user_has_brand_access(uuid,uuid) from public, anon;
revoke all on function private.validate_brand_pharmacy() from public, anon, authenticated;
revoke all on function private.validate_brand_pharmacy_product() from public, anon, authenticated;
revoke all on function private.enforce_brand_pharmacy_update_scope() from public, anon, authenticated;
revoke all on function private.can_access_brand_pharmacy(uuid) from public, anon;
grant execute on function private.can_access_brand_pharmacy(uuid) to authenticated;
revoke all on function public.find_pharmacy_duplicates(text,text,text,text,text,text) from public, anon;
grant execute on function public.find_pharmacy_duplicates(text,text,text,text,text,text) to authenticated, service_role;

create or replace function public.confirm_reference_import(target_batch_id uuid)
returns table (processed integer, skipped integer)
language plpgsql security invoker set search_path = '' as $$
declare
  target_batch public.import_batches%rowtype;
  import_row public.import_rows%rowtype;
  entity_id uuid;
  existing_id uuid;
  processed_count integer := 0;
  skipped_count integer := 0;
begin
  select * into target_batch
  from public.import_batches
  where id = target_batch_id and status = 'preview' and created_by = (select auth.uid())
  for update;

  if target_batch.id is null then
    raise exception 'Import batch is unavailable or already confirmed' using errcode = '42501';
  end if;

  for import_row in
    select * from public.import_rows
    where batch_id = target_batch_id and is_valid
    order by line_number
  loop
    entity_id := null;
    existing_id := null;

    if target_batch.entity_type = 'pharmacies' then
      select p.id into existing_id
      from public.pharmacies p
      where
        (nullif(import_row.normalized_payload ->> 'siret', '') is not null and upper(btrim(p.siret)) = upper(btrim(import_row.normalized_payload ->> 'siret'))) or
        (nullif(import_row.normalized_payload ->> 'cip_code', '') is not null and upper(btrim(p.cip_code)) = upper(btrim(import_row.normalized_payload ->> 'cip_code'))) or
        (nullif(import_row.normalized_payload ->> 'finess_code', '') is not null and upper(btrim(p.finess_code)) = upper(btrim(import_row.normalized_payload ->> 'finess_code')))
      order by p.created_at
      limit 1;

      if existing_id is not null and target_batch.strategy in ('create_only', 'skip_duplicates') then
        skipped_count := skipped_count + 1;
        update public.import_rows set is_duplicate = true where id = import_row.id;
        continue;
      elsif existing_id is null and target_batch.strategy = 'update_only' then
        skipped_count := skipped_count + 1;
        update public.import_rows set errors = array_append(errors, 'Aucune pharmacie existante à mettre à jour') where id = import_row.id;
        continue;
      elsif existing_id is null then
        insert into public.pharmacies (
          legal_name, trade_name, cip_code, finess_code, siret, phone, email, website,
          address_line_1, address_line_2, postal_code, city, country_code, created_by
        ) values (
          import_row.normalized_payload ->> 'legal_name', nullif(import_row.normalized_payload ->> 'trade_name', ''),
          nullif(import_row.normalized_payload ->> 'cip_code', ''), nullif(import_row.normalized_payload ->> 'finess_code', ''),
          nullif(import_row.normalized_payload ->> 'siret', ''), nullif(import_row.normalized_payload ->> 'phone', ''),
          nullif(import_row.normalized_payload ->> 'email', ''), nullif(import_row.normalized_payload ->> 'website', ''),
          nullif(import_row.normalized_payload ->> 'address_line_1', ''), nullif(import_row.normalized_payload ->> 'address_line_2', ''),
          nullif(import_row.normalized_payload ->> 'postal_code', ''), nullif(import_row.normalized_payload ->> 'city', ''),
          coalesce(nullif(import_row.normalized_payload ->> 'country_code', ''), 'FR'), (select auth.uid())
        ) returning id into entity_id;
      else
        update public.pharmacies p set
          legal_name = coalesce(nullif(p.legal_name, ''), import_row.normalized_payload ->> 'legal_name'),
          trade_name = coalesce(nullif(p.trade_name, ''), nullif(import_row.normalized_payload ->> 'trade_name', '')),
          cip_code = coalesce(nullif(p.cip_code, ''), nullif(import_row.normalized_payload ->> 'cip_code', '')),
          finess_code = coalesce(nullif(p.finess_code, ''), nullif(import_row.normalized_payload ->> 'finess_code', '')),
          siret = coalesce(nullif(p.siret, ''), nullif(import_row.normalized_payload ->> 'siret', '')),
          phone = coalesce(nullif(p.phone, ''), nullif(import_row.normalized_payload ->> 'phone', '')),
          email = coalesce(nullif(p.email, ''), nullif(import_row.normalized_payload ->> 'email', '')),
          website = coalesce(nullif(p.website, ''), nullif(import_row.normalized_payload ->> 'website', '')),
          address_line_1 = coalesce(nullif(p.address_line_1, ''), nullif(import_row.normalized_payload ->> 'address_line_1', '')),
          postal_code = coalesce(nullif(p.postal_code, ''), nullif(import_row.normalized_payload ->> 'postal_code', '')),
          city = coalesce(nullif(p.city, ''), nullif(import_row.normalized_payload ->> 'city', ''))
        where p.id = existing_id;
        entity_id := existing_id;
      end if;

      insert into public.brand_pharmacies (brand_id, pharmacy_id, source, created_by)
      values (target_batch.brand_id, entity_id, 'import', (select auth.uid()))
      on conflict (brand_id, pharmacy_id) where archived_at is null do nothing;

    elsif target_batch.entity_type = 'contacts' then
      select c.id into existing_id from public.pharmacy_contacts c
      where c.pharmacy_id = (import_row.normalized_payload ->> 'pharmacy_id')::uuid
        and lower(coalesce(c.email, '')) = lower(coalesce(import_row.normalized_payload ->> 'email', ''))
        and c.archived_at is null limit 1;
      if existing_id is not null and target_batch.strategy in ('create_only', 'skip_duplicates') then
        skipped_count := skipped_count + 1;
        update public.import_rows set is_duplicate = true where id = import_row.id;
        continue;
      elsif existing_id is null and target_batch.strategy = 'update_only' then
        skipped_count := skipped_count + 1;
        continue;
      elsif existing_id is null then
        insert into public.pharmacy_contacts (
          pharmacy_id, first_name, last_name, job_title, email, phone, is_primary, preferred_contact_channel, notes
        ) values (
          (import_row.normalized_payload ->> 'pharmacy_id')::uuid,
          import_row.normalized_payload ->> 'first_name', import_row.normalized_payload ->> 'last_name',
          nullif(import_row.normalized_payload ->> 'job_title', ''), nullif(import_row.normalized_payload ->> 'email', ''),
          nullif(import_row.normalized_payload ->> 'phone', ''), coalesce((import_row.normalized_payload ->> 'is_primary')::boolean, false),
          nullif(import_row.normalized_payload ->> 'preferred_contact_channel', '')::public.contact_channel,
          nullif(import_row.normalized_payload ->> 'notes', '')
        ) returning id into entity_id;
      else
        update public.pharmacy_contacts c set
          job_title = coalesce(nullif(c.job_title, ''), nullif(import_row.normalized_payload ->> 'job_title', '')),
          phone = coalesce(nullif(c.phone, ''), nullif(import_row.normalized_payload ->> 'phone', '')),
          notes = coalesce(nullif(c.notes, ''), nullif(import_row.normalized_payload ->> 'notes', ''))
        where c.id = existing_id;
        entity_id := existing_id;
      end if;

    elsif target_batch.entity_type = 'brand_pharmacies' then
      select bp.id into existing_id from public.brand_pharmacies bp
      where bp.brand_id = target_batch.brand_id
        and bp.pharmacy_id = (import_row.normalized_payload ->> 'pharmacy_id')::uuid
        and bp.archived_at is null limit 1;
      if existing_id is not null and target_batch.strategy in ('create_only', 'skip_duplicates') then
        skipped_count := skipped_count + 1;
        update public.import_rows set is_duplicate = true where id = import_row.id;
        continue;
      elsif existing_id is null and target_batch.strategy = 'update_only' then
        skipped_count := skipped_count + 1;
        continue;
      elsif existing_id is null then
        insert into public.brand_pharmacies (
          brand_id, pharmacy_id, commercial_status, activity_status, priority_level,
          potential_level, source, notes, created_by
        ) values (
          target_batch.brand_id, (import_row.normalized_payload ->> 'pharmacy_id')::uuid,
          coalesce(nullif(import_row.normalized_payload ->> 'commercial_status', '')::public.commercial_status, 'targeted'),
          coalesce(nullif(import_row.normalized_payload ->> 'activity_status', '')::public.activity_status, 'never_ordered'),
          coalesce(nullif(import_row.normalized_payload ->> 'priority_level', '')::public.priority_level, 'normal'),
          coalesce(nullif(import_row.normalized_payload ->> 'potential_level', '')::public.potential_level, 'unknown'),
          coalesce(nullif(import_row.normalized_payload ->> 'source', '')::public.pharmacy_source, 'import'),
          nullif(import_row.normalized_payload ->> 'notes', ''), (select auth.uid())
        ) returning id into entity_id;
      else
        update public.brand_pharmacies bp set
          notes = coalesce(nullif(bp.notes, ''), nullif(import_row.normalized_payload ->> 'notes', '')),
          source_details = coalesce(nullif(bp.source_details, ''), nullif(import_row.normalized_payload ->> 'source_details', ''))
        where bp.id = existing_id;
        entity_id := existing_id;
      end if;

    elsif target_batch.entity_type = 'products' then
      select p.id into existing_id from public.products p
      where p.brand_id = target_batch.brand_id and upper(btrim(p.sku)) = upper(btrim(import_row.normalized_payload ->> 'sku')) limit 1;
      if existing_id is not null and target_batch.strategy in ('create_only', 'skip_duplicates') then
        skipped_count := skipped_count + 1;
        update public.import_rows set is_duplicate = true where id = import_row.id;
        continue;
      elsif existing_id is null and target_batch.strategy = 'update_only' then
        skipped_count := skipped_count + 1;
        continue;
      elsif existing_id is null then
        insert into public.products (
          brand_id, name, sku, ean, category, format, wholesale_price_ht, retail_price_ttc
        ) values (
          target_batch.brand_id, import_row.normalized_payload ->> 'name', import_row.normalized_payload ->> 'sku',
          nullif(import_row.normalized_payload ->> 'ean', ''), nullif(import_row.normalized_payload ->> 'category', ''),
          nullif(import_row.normalized_payload ->> 'format', ''),
          nullif(import_row.normalized_payload ->> 'wholesale_price_ht', '')::numeric,
          nullif(import_row.normalized_payload ->> 'retail_price_ttc', '')::numeric
        ) returning id into entity_id;
      else
        update public.products p set
          name = coalesce(nullif(p.name, ''), import_row.normalized_payload ->> 'name'),
          ean = coalesce(nullif(p.ean, ''), nullif(import_row.normalized_payload ->> 'ean', '')),
          category = coalesce(nullif(p.category, ''), nullif(import_row.normalized_payload ->> 'category', '')),
          format = coalesce(nullif(p.format, ''), nullif(import_row.normalized_payload ->> 'format', '')),
          wholesale_price_ht = coalesce(p.wholesale_price_ht, nullif(import_row.normalized_payload ->> 'wholesale_price_ht', '')::numeric),
          retail_price_ttc = coalesce(p.retail_price_ttc, nullif(import_row.normalized_payload ->> 'retail_price_ttc', '')::numeric)
        where p.id = existing_id;
        entity_id := existing_id;
      end if;
    end if;

    update public.import_rows set processed_entity_id = entity_id where id = import_row.id;
    processed_count := processed_count + 1;
  end loop;

  update public.import_batches
  set status = 'confirmed', confirmed_at = now()
  where id = target_batch_id;

  insert into public.activity_logs (organization_id, brand_id, actor_user_id, action, entity_type, entity_id, metadata)
  select b.organization_id, target_batch.brand_id, (select auth.uid()), 'import.confirm', 'import_batches', target_batch.id,
    jsonb_build_object('entity_type', target_batch.entity_type, 'processed', processed_count, 'skipped', skipped_count)
  from public.brands b where b.id = target_batch.brand_id;

  return query select processed_count, skipped_count;
end;
$$;

revoke all on function public.confirm_reference_import(uuid) from public, anon;
grant execute on function public.confirm_reference_import(uuid) to authenticated, service_role;

create or replace function private.is_active_pharmacy(target_pharmacy_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.pharmacies p
    where p.id = target_pharmacy_id
      and p.archived_at is null
  );
$$;

revoke all on function private.is_active_pharmacy(uuid) from public, anon, authenticated;
grant execute on function private.is_active_pharmacy(uuid) to authenticated, service_role;

create or replace function public.create_brand_pharmacy(
  target_brand_id uuid,
  pharmacy_data jsonb,
  relation_data jsonb default '{}'::jsonb,
  existing_pharmacy_id uuid default null
)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  target_pharmacy_id uuid := existing_pharmacy_id;
  target_relation_id uuid;
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Insufficient brand permission' using errcode = '42501';
  end if;

  if target_pharmacy_id is null then
    insert into public.pharmacies (
      legal_name, trade_name, cip_code, finess_code, siret, phone, email, website,
      address_line_1, address_line_2, postal_code, city, country_code,
      latitude, longitude, pharmacy_group_id, created_by
    ) values (
      pharmacy_data ->> 'legal_name', nullif(pharmacy_data ->> 'trade_name', ''),
      nullif(pharmacy_data ->> 'cip_code', ''), nullif(pharmacy_data ->> 'finess_code', ''),
      nullif(pharmacy_data ->> 'siret', ''), nullif(pharmacy_data ->> 'phone', ''),
      nullif(pharmacy_data ->> 'email', ''), nullif(pharmacy_data ->> 'website', ''),
      nullif(pharmacy_data ->> 'address_line_1', ''), nullif(pharmacy_data ->> 'address_line_2', ''),
      nullif(pharmacy_data ->> 'postal_code', ''), nullif(pharmacy_data ->> 'city', ''),
      coalesce(nullif(pharmacy_data ->> 'country_code', ''), 'FR'),
      nullif(pharmacy_data ->> 'latitude', '')::numeric, nullif(pharmacy_data ->> 'longitude', '')::numeric,
      nullif(pharmacy_data ->> 'pharmacy_group_id', '')::uuid, (select auth.uid())
    ) returning id into target_pharmacy_id;
  elsif not private.is_active_pharmacy(target_pharmacy_id) then
    raise exception 'Pharmacy unavailable' using errcode = '42501';
  end if;

  insert into public.brand_pharmacies (
    brand_id, pharmacy_id, commercial_status, activity_status, priority_level,
    potential_level, potential_score, source, source_details, current_agent_user_id,
    tr1_manager_user_id, territory_id, next_action_type, next_action_at,
    next_action_owner_id, notes, created_by
  ) values (
    target_brand_id, target_pharmacy_id,
    coalesce(nullif(relation_data ->> 'commercial_status', '')::public.commercial_status, 'targeted'),
    coalesce(nullif(relation_data ->> 'activity_status', '')::public.activity_status, 'never_ordered'),
    coalesce(nullif(relation_data ->> 'priority_level', '')::public.priority_level, 'normal'),
    coalesce(nullif(relation_data ->> 'potential_level', '')::public.potential_level, 'unknown'),
    nullif(relation_data ->> 'potential_score', '')::numeric,
    coalesce(nullif(relation_data ->> 'source', '')::public.pharmacy_source, 'tr1_prospecting'),
    nullif(relation_data ->> 'source_details', ''), nullif(relation_data ->> 'current_agent_user_id', '')::uuid,
    nullif(relation_data ->> 'tr1_manager_user_id', '')::uuid, nullif(relation_data ->> 'territory_id', '')::uuid,
    nullif(relation_data ->> 'next_action_type', ''), nullif(relation_data ->> 'next_action_at', '')::timestamptz,
    nullif(relation_data ->> 'next_action_owner_id', '')::uuid, nullif(relation_data ->> 'notes', ''), (select auth.uid())
  ) returning id into target_relation_id;

  return target_relation_id;
end;
$$;

revoke all on function public.create_brand_pharmacy(uuid,jsonb,jsonb,uuid) from public, anon;
grant execute on function public.create_brand_pharmacy(uuid,jsonb,jsonb,uuid) to authenticated, service_role;

create view public.brand_pharmacy_directory with (security_invoker = true) as
select
  bp.id,
  bp.brand_id,
  bp.pharmacy_id,
  bp.commercial_status,
  bp.activity_status,
  bp.priority_level,
  bp.potential_level,
  bp.potential_score,
  bp.current_agent_user_id,
  bp.territory_id,
  bp.next_action_type,
  bp.next_action_at,
  bp.last_interaction_at,
  bp.archived_at,
  p.legal_name,
  p.trade_name,
  p.cip_code,
  p.finess_code,
  p.siret,
  p.phone,
  p.email,
  p.postal_code,
  p.city,
  p.pharmacy_group_id,
  pg.name as pharmacy_group_name,
  t.name as territory_name,
  up.full_name as agent_name,
  concat_ws(' ', p.trade_name, p.legal_name, p.city, p.postal_code, p.cip_code, p.finess_code, p.siret, p.phone, p.email) as search_text
from public.brand_pharmacies bp
join public.pharmacies p on p.id = bp.pharmacy_id
left join public.pharmacy_groups pg on pg.id = p.pharmacy_group_id
left join public.territories t on t.id = bp.territory_id
left join public.user_profiles up on up.user_id = bp.current_agent_user_id;

revoke all on public.brand_pharmacy_directory from anon;
grant select on public.brand_pharmacy_directory to authenticated, service_role;

comment on table public.pharmacies is 'Établissement officinal physique commun à toutes les marques.';
comment on table public.brand_pharmacies is 'Relation commerciale spécifique entre une marque et une pharmacie physique.';
comment on table public.brand_pharmacy_products is 'Produits implantés ou planifiés pour une relation marque-pharmacie.';
