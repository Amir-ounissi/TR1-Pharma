-- V2: Imported catalogue entries remain unpublished and require verification.
alter table public.products add column if not exists category text;
alter table public.products add column if not exists source_catalog text;
alter table public.products add column if not exists source_product_id uuid;
alter table public.products add column if not exists source_document text;
alter table public.products add column if not exists source_active boolean;
alter table public.products add column if not exists requires_review boolean not null default true;
alter table public.products add column if not exists price_verified boolean not null default false;
alter table public.products add constraint products_publication_guard
  check (not published or (price_verified and not requires_review));
create unique index if not exists products_source_catalog_product_idx
  on public.products(source_catalog,source_product_id)
  where source_catalog is not null and source_product_id is not null;

create table public.product_quantity_tiers (
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty integer not null check (min_qty >= 1),
  price_ht numeric(12,2) not null check (price_ht >= 0),
  verified boolean not null default false,
  source_note text,
  created_at timestamptz not null default now(),
  primary key (product_id,min_qty)
);
alter table public.product_quantity_tiers enable row level security;
create policy tiers_owner_select on public.product_quantity_tiers for select to authenticated
 using (public.tr1_is_owner());
create policy tiers_owner_insert on public.product_quantity_tiers for insert to authenticated
 with check (public.tr1_is_owner());
create policy tiers_owner_update on public.product_quantity_tiers for update to authenticated
 using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy tiers_owner_delete on public.product_quantity_tiers for delete to authenticated
 using (public.tr1_is_owner());
revoke all on public.product_quantity_tiers from anon;
grant select,insert,update,delete on public.product_quantity_tiers to authenticated;
