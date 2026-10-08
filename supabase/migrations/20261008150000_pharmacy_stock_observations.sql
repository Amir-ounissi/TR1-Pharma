-- TR1 AI Vision: immutable per-product shelf/backroom stock and facing observations.
-- Photos are optional evidence attached only after commercial validation.
create table public.pharmacy_stock_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null,
  pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
  field_visit_id uuid references public.field_visits(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  observed_ean text,
  stock_shelf integer,
  stock_backroom integer,
  stock_total integer generated always as (
    case when stock_shelf is not null and stock_backroom is not null
      then stock_shelf + stock_backroom else null end
  ) stored,
  facings integer,
  capture_method text not null check (capture_method in ('photo','manual')),
  label_layout text check (label_layout is null or char_length(label_layout) <= 120),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  raw_extraction jsonb,
  notes text,
  observed_at timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (brand_pharmacy_id, brand_id)
    references public.brand_pharmacies(id, brand_id) on delete restrict,
  check (stock_shelf is null or stock_shelf between 0 and 100000),
  check (stock_backroom is null or stock_backroom between 0 and 100000),
  check (facings is null or facings between 0 and 1000),
  check (stock_shelf is not null or stock_backroom is not null or facings is not null),
  check (observed_ean is null or char_length(observed_ean) <= 32),
  check (notes is null or char_length(notes) <= 2000),
  check (raw_extraction is null or octet_length(raw_extraction::text) <= 32768),
  check (not private.field_data_payload_has_pii(raw_extraction))
);
create index pharmacy_stock_relation_history_idx
  on public.pharmacy_stock_observations (brand_pharmacy_id, observed_at desc);
create index pharmacy_stock_product_history_idx
  on public.pharmacy_stock_observations (brand_id, product_id, observed_at desc);

alter table public.pharmacy_stock_observations enable row level security;
revoke all on public.pharmacy_stock_observations from public, anon;
grant select, insert on public.pharmacy_stock_observations to authenticated;
grant all on public.pharmacy_stock_observations to service_role;
create policy pharmacy_stock_read on public.pharmacy_stock_observations
  for select to authenticated
  using (private.can_access_brand_pharmacy(brand_pharmacy_id));
create policy pharmacy_stock_insert on public.pharmacy_stock_observations
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and private.can_access_brand_pharmacy(brand_pharmacy_id)
    and (private.has_elevated_brand_access(brand_id)
      or private.user_is_assigned_to_relation((select auth.uid()), brand_pharmacy_id))
    and exists (
      select 1 from public.brand_pharmacies bp
      join public.brands b on b.id = bp.brand_id
      where bp.id = brand_pharmacy_id
        and bp.brand_id = brand_id
        and bp.pharmacy_id = pharmacy_id
        and b.organization_id = organization_id
        and bp.archived_at is null
    )
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.brand_id = brand_id
        and p.is_active and p.discontinued_at is null
    )
    and (
      field_visit_id is null
      or exists (
        select 1 from public.field_visits fv
        join public.field_visit_brands fvb on fvb.visit_id = fv.id
        where fv.id = field_visit_id
          and fvb.brand_pharmacy_id = brand_pharmacy_id
          and fvb.brand_id = brand_id
          and fv.pharmacy_id = pharmacy_id
          and fv.archived_at is null
          and (fv.owner_user_id = (select auth.uid())
            or private.has_elevated_brand_access(brand_id))
      )
    )
  );

create table public.pharmacy_stock_observation_attachments (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.pharmacy_stock_observations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  bucket_id text not null default 'stock-evidence' check (bucket_id = 'stock-evidence'),
  object_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (object_path = brand_id::text || '/' || observation_id::text || '/' || split_part(object_path, '/', 3))
);
create index pharmacy_stock_evidence_observation_idx
  on public.pharmacy_stock_observation_attachments(observation_id, created_at desc);
alter table public.pharmacy_stock_observation_attachments enable row level security;
revoke all on public.pharmacy_stock_observation_attachments from public, anon;
grant select, insert on public.pharmacy_stock_observation_attachments to authenticated;
grant all on public.pharmacy_stock_observation_attachments to service_role;
create policy pharmacy_stock_evidence_read on public.pharmacy_stock_observation_attachments
  for select to authenticated using (
    exists (
      select 1 from public.pharmacy_stock_observations o
      where o.id = observation_id and o.brand_id = brand_id
        and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
    )
  );
create policy pharmacy_stock_evidence_insert on public.pharmacy_stock_observation_attachments
  for insert to authenticated with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.pharmacy_stock_observations o
      where o.id = observation_id and o.brand_id = brand_id
        and o.created_by = (select auth.uid())
        and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
    )
  );

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('stock-evidence','stock-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create function private.can_access_stock_object(target_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  brand_text text := split_part(target_name, '/', 1);
  observation_text text := split_part(target_name, '/', 2);
begin
  if brand_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or observation_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return false;
  end if;
  return exists (
    select 1 from public.pharmacy_stock_observations o
    where o.id = observation_text::uuid and o.brand_id = brand_text::uuid
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
  );
end;
$$;
create function private.can_write_stock_object(target_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  brand_text text := split_part(target_name, '/', 1);
  observation_text text := split_part(target_name, '/', 2);
begin
  if brand_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or observation_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return false;
  end if;
  return exists (
    select 1 from public.pharmacy_stock_observations o
    where o.id = observation_text::uuid and o.brand_id = brand_text::uuid
      and o.created_by = (select auth.uid())
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
  );
end;
$$;
create policy pharmacy_stock_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'stock-evidence' and private.can_access_stock_object(name));
create policy pharmacy_stock_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stock-evidence'
    and owner_id = (select auth.uid())::text
    and private.can_write_stock_object(name));
create policy pharmacy_stock_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'stock-evidence'
    and owner_id = (select auth.uid())::text
    and private.can_write_stock_object(name));

comment on table public.pharmacy_stock_observations is
  'Immutable, product-specific stock and facings snapshots: stock_total only when both quantities were explicitly observed; not proof of sell-out.';
