-- P0 #211 — Field price observations collected by agents.
-- A price observation is a dated, evidenced fact; it is not assumed to be the
-- pharmacy's permanent price.

create table public.pharmacy_price_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null,
  pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
  field_visit_id uuid references public.field_visits(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  observed_ean text,
  observed_price_ttc numeric(12,2) not null,
  price_type text not null default 'regular'
    check (price_type in ('regular','promotion','bundle','other')),
  bundle_quantity integer,
  unit_price_ttc numeric(12,4) not null,
  capture_method text not null default 'photo'
    check (capture_method in ('photo','manual','import')),
  confidence numeric(5,4),
  raw_extraction jsonb,
  notes text,
  observed_at timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (brand_pharmacy_id, brand_id)
    references public.brand_pharmacies(id, brand_id) on delete restrict,
  constraint pharmacy_price_observations_price_check check (observed_price_ttc > 0 and observed_price_ttc <= 10000),
  constraint pharmacy_price_observations_unit_price_check check (unit_price_ttc > 0 and unit_price_ttc <= 10000),
  constraint pharmacy_price_observations_bundle_check check (
    (price_type = 'bundle' and bundle_quantity is not null and bundle_quantity between 2 and 100)
    or (price_type <> 'bundle' and bundle_quantity is null)
  ),
  constraint pharmacy_price_observations_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint pharmacy_price_observations_ean_check check (observed_ean is null or char_length(observed_ean) <= 32),
  constraint pharmacy_price_observations_raw_check check (raw_extraction is null or octet_length(raw_extraction::text) <= 32768),
  constraint pharmacy_price_observations_notes_check check (notes is null or char_length(notes) <= 2000)
);

create index pharmacy_price_observations_relation_idx
  on public.pharmacy_price_observations(brand_pharmacy_id, observed_at desc)
  where archived_at is null;

create index pharmacy_price_observations_product_idx
  on public.pharmacy_price_observations(brand_id, product_id, observed_at desc)
  where archived_at is null;

create index pharmacy_price_observations_visit_idx
  on public.pharmacy_price_observations(field_visit_id, observed_at desc)
  where archived_at is null and field_visit_id is not null;

create trigger pharmacy_price_observations_updated_at
before update on public.pharmacy_price_observations
for each row execute function private.set_updated_at();

alter table public.pharmacy_price_observations enable row level security;
revoke all on public.pharmacy_price_observations from public, anon;
grant select on public.pharmacy_price_observations to authenticated;
grant all on public.pharmacy_price_observations to service_role;

create policy pharmacy_price_observations_select
on public.pharmacy_price_observations for select to authenticated
using (
  archived_at is null
  and private.can_access_brand_pharmacy(brand_pharmacy_id)
);

create table public.pharmacy_price_observation_attachments (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.pharmacy_price_observations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  bucket_id text not null default 'price-evidence',
  object_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (size_bytes > 0 and size_bytes <= 5242880),
  check (mime_type in ('image/jpeg','image/png','image/webp')),
  check (
    object_path = brand_id::text || '/' || observation_id::text || '/' || split_part(object_path, '/', 3)
  )
);

create index pharmacy_price_observation_attachments_observation_idx
  on public.pharmacy_price_observation_attachments(observation_id, created_at desc)
  where archived_at is null;

alter table public.pharmacy_price_observation_attachments enable row level security;
revoke all on public.pharmacy_price_observation_attachments from public, anon;
grant select, insert, update on public.pharmacy_price_observation_attachments to authenticated;
grant all on public.pharmacy_price_observation_attachments to service_role;

create policy pharmacy_price_observation_attachments_select
on public.pharmacy_price_observation_attachments for select to authenticated
using (
  archived_at is null
  and exists (
    select 1
    from public.pharmacy_price_observations observation
    where observation.id = observation_id
      and observation.brand_id = brand_id
      and observation.archived_at is null
      and private.can_access_brand_pharmacy(observation.brand_pharmacy_id)
  )
);

create policy pharmacy_price_observation_attachments_insert
on public.pharmacy_price_observation_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.pharmacy_price_observations observation
    where observation.id = observation_id
      and observation.brand_id = brand_id
      and observation.created_by = (select auth.uid())
      and observation.archived_at is null
  )
);

create policy pharmacy_price_observation_attachments_update
on public.pharmacy_price_observation_attachments for update to authenticated
using (
  uploaded_by = (select auth.uid())
  or private.has_elevated_brand_access(brand_id)
)
with check (
  exists (
    select 1
    from public.pharmacy_price_observations observation
    where observation.id = observation_id
      and observation.brand_id = brand_id
      and observation.archived_at is null
      and private.can_access_brand_pharmacy(observation.brand_pharmacy_id)
  )
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'price-evidence',
  'price-evidence',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

create or replace function private.can_access_price_object(target_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  brand_text text := split_part(target_name, '/', 1);
  observation_text text := split_part(target_name, '/', 2);
begin
  if brand_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or observation_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.pharmacy_price_observations observation
    where observation.id = observation_text::uuid
      and observation.brand_id = brand_text::uuid
      and observation.archived_at is null
      and private.can_access_brand_pharmacy(observation.brand_pharmacy_id)
  );
end;
$$;

create or replace function private.can_write_price_object(target_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  brand_text text := split_part(target_name, '/', 1);
  observation_text text := split_part(target_name, '/', 2);
begin
  if brand_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or observation_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.pharmacy_price_observations observation
    where observation.id = observation_text::uuid
      and observation.brand_id = brand_text::uuid
      and observation.archived_at is null
      and observation.created_by = (select auth.uid())
  );
end;
$$;

create policy price_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'price-evidence'
  and private.can_access_price_object(name)
);

create policy price_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'price-evidence'
  and owner_id = (select auth.uid())::text
  and private.can_write_price_object(name)
);

create policy price_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'price-evidence'
  and owner_id = (select auth.uid())::text
  and private.can_write_price_object(name)
);

create or replace function private.field_data_payload_has_pii(target_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  payload_text text := lower(coalesce(target_payload::text, ''));
begin
  if target_payload is null then
    return false;
  end if;

  return payload_text ~ '"(patient|patient_name|nom_patient|prenom_patient|customer|customer_name|client_name|email|e-mail|phone|telephone|téléphone|mobile)"[[:space:]]*:'
    or payload_text ~ '[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+';
end;
$$;

create or replace function public.save_pharmacy_price_observation(
  target_observation_id uuid,
  target_brand_pharmacy_id uuid,
  target_field_visit_id uuid,
  target_product_id uuid,
  target_observed_ean text,
  target_price_ttc numeric,
  target_price_type text,
  target_bundle_quantity integer,
  target_capture_method text,
  target_confidence numeric,
  target_raw_extraction jsonb,
  target_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  relation record;
  target_visit public.field_visits%rowtype;
  organization_uuid uuid;
  observation_id uuid := coalesce(target_observation_id, gen_random_uuid());
  clean_price_type text := coalesce(nullif(target_price_type, ''), 'regular');
  clean_method text := coalesce(nullif(target_capture_method, ''), 'photo');
  final_unit_price numeric;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select bp.id, bp.brand_id, bp.pharmacy_id, b.organization_id
  into relation
  from public.brand_pharmacies bp
  join public.brands b on b.id = bp.brand_id
  where bp.id = target_brand_pharmacy_id
    and bp.archived_at is null;

  if relation.id is null
     or not private.can_access_brand_pharmacy(relation.id)
     or not (
       private.has_elevated_brand_access(relation.brand_id)
       or private.user_is_assigned_to_relation(actor, relation.id)
     ) then
    raise exception 'Price observation forbidden' using errcode = '42501';
  end if;

  if target_product_id is null or not exists (
    select 1
    from public.products product
    where product.id = target_product_id
      and product.brand_id = relation.brand_id
      and product.is_active
      and product.discontinued_at is null
  ) then
    raise exception 'Price product unavailable' using errcode = '23514';
  end if;

  if target_price_ttc is null or target_price_ttc <= 0 or target_price_ttc > 10000 then
    raise exception 'Invalid observed price' using errcode = '22023';
  end if;
  if clean_price_type not in ('regular','promotion','bundle','other') then
    raise exception 'Invalid price type' using errcode = '22023';
  end if;
  if clean_method not in ('photo','manual','import') then
    raise exception 'Invalid capture method' using errcode = '22023';
  end if;
  if clean_price_type = 'bundle' and (target_bundle_quantity is null or target_bundle_quantity < 2 or target_bundle_quantity > 100) then
    raise exception 'Bundle quantity is required' using errcode = '22023';
  end if;
  if clean_price_type <> 'bundle' then
    target_bundle_quantity := null;
  end if;
  if target_confidence is not null and (target_confidence < 0 or target_confidence > 1) then
    raise exception 'Invalid confidence value' using errcode = '22023';
  end if;
  if private.field_data_payload_has_pii(target_raw_extraction) then
    raise exception 'Price extraction must not contain patient or customer personal data' using errcode = '22023';
  end if;

  if target_field_visit_id is not null then
    select * into target_visit
    from public.field_visits
    where id = target_field_visit_id
      and archived_at is null;

    if target_visit.id is null
       or target_visit.pharmacy_id <> relation.pharmacy_id
       or not exists (
         select 1
         from public.field_visit_brands fvb
         where fvb.visit_id = target_field_visit_id
           and fvb.brand_pharmacy_id = relation.id
           and fvb.brand_id = relation.brand_id
       )
       or not (
         target_visit.owner_user_id = actor
         or private.has_elevated_brand_access(relation.brand_id)
       ) then
      raise exception 'Price observation visit unavailable' using errcode = '42501';
    end if;
  end if;

  if target_observation_id is not null and not exists (
    select 1
    from public.pharmacy_price_observations observation
    where observation.id = target_observation_id
      and observation.brand_pharmacy_id = relation.id
      and observation.brand_id = relation.brand_id
      and observation.archived_at is null
      and (
        observation.created_by = actor
        or private.has_elevated_brand_access(relation.brand_id)
      )
  ) then
    raise exception 'Price observation unavailable' using errcode = '42501';
  end if;

  final_unit_price := case
    when clean_price_type = 'bundle' then round(target_price_ttc / target_bundle_quantity, 4)
    else target_price_ttc
  end;

  insert into public.pharmacy_price_observations(
    id,
    organization_id,
    brand_id,
    brand_pharmacy_id,
    pharmacy_id,
    field_visit_id,
    product_id,
    observed_ean,
    observed_price_ttc,
    price_type,
    bundle_quantity,
    unit_price_ttc,
    capture_method,
    confidence,
    raw_extraction,
    notes,
    created_by,
    observed_at
  ) values (
    observation_id,
    relation.organization_id,
    relation.brand_id,
    relation.id,
    relation.pharmacy_id,
    target_field_visit_id,
    target_product_id,
    nullif(btrim(target_observed_ean), ''),
    target_price_ttc,
    clean_price_type,
    target_bundle_quantity,
    final_unit_price,
    clean_method,
    target_confidence,
    target_raw_extraction,
    nullif(btrim(target_notes), ''),
    actor,
    now()
  )
  on conflict (id) do update
  set
    field_visit_id = excluded.field_visit_id,
    product_id = excluded.product_id,
    observed_ean = excluded.observed_ean,
    observed_price_ttc = excluded.observed_price_ttc,
    price_type = excluded.price_type,
    bundle_quantity = excluded.bundle_quantity,
    unit_price_ttc = excluded.unit_price_ttc,
    capture_method = excluded.capture_method,
    confidence = excluded.confidence,
    raw_extraction = excluded.raw_extraction,
    notes = excluded.notes,
    updated_at = now();

  return observation_id;
end;
$$;

revoke all on function public.save_pharmacy_price_observation(
  uuid, uuid, uuid, uuid, text, numeric, text, integer, text, numeric, jsonb, text
) from public, anon;
grant execute on function public.save_pharmacy_price_observation(
  uuid, uuid, uuid, uuid, text, numeric, text, integer, text, numeric, jsonb, text
) to authenticated, service_role;

comment on table public.pharmacy_price_observations is
  'Dated pharmacy price observations collected from the field. Values are observations, not asserted permanent retail prices.';
