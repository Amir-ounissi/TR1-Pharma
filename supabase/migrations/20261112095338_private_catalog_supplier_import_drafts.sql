
-- TR1 PHARMA / staging-only: supplier catalogue draft import metadata.
-- Supplier price breaks are confidential wholesale inputs; they are NOT
-- customer-facing indicative tiers and must never be exposed by catalogue_my_data.
alter table public.private_catalog_products
  add column if not exists category text not null default '',
  add column if not exists source_document text,
  add column if not exists source_row integer,
  add column if not exists source_ean_raw text,
  add column if not exists requires_review boolean not null default false;

-- VAT rates are not specified by either source catalogue.
-- Preserve the absence of tax information instead of inventing a 0% VAT rate.
alter table public.private_catalog_products
  alter column vat_rate drop not null;

-- Some genuine supplier unit prices have three decimals (e.g. 0.035 EUR).
-- Internal prices must retain the source precision.
alter table public.private_catalog_products
  alter column price_ht type numeric(12,4);

alter table public.private_catalog_products
  add constraint private_catalog_published_products_checked
  check (not active or (vat_rate is not null and not requires_review));

create table if not exists public.private_catalog_supplier_tiers (
  product_id uuid not null references public.private_catalog_products(id) on delete cascade,
  tier_number smallint not null check (tier_number between 1 and 8),
  quantity_label text not null check (length(quantity_label) between 1 and 32),
  min_quantity integer check (min_quantity is null or min_quantity > 0),
  unit_price_ht numeric(12,4) not null check (unit_price_ht > 0),
  source_document text not null,
  primary key (product_id,tier_number)
);
create index if not exists private_catalog_supplier_tiers_product_idx
 on public.private_catalog_supplier_tiers(product_id);

alter table public.private_catalog_supplier_tiers enable row level security;
revoke all on public.private_catalog_supplier_tiers from public,anon,authenticated;
grant all on public.private_catalog_supplier_tiers to service_role;
grant select,insert,update,delete on public.private_catalog_supplier_tiers to authenticated;
create policy platform_superadmin_only on public.private_catalog_supplier_tiers
 for all to authenticated
 using ((select private.has_global_role(array['super_admin']::text[])))
 with check ((select private.has_global_role(array['super_admin']::text[])));

comment on table public.private_catalog_supplier_tiers is
 'Confidential supplier purchasing price breaks; NEVER sent to pharmacy users.';
comment on column public.private_catalog_products.requires_review is
 'Blocks activation until source SKU/EAN/price/pack/VAT/rights have been validated.';
