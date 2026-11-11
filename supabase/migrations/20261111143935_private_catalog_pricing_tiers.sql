-- TR1 PHARMA : fourchettes commerciales indicatives et accords contractuels.
-- Les prix internes du catalogue et les tarifs negocies ne sont pas exposables
-- via la cle publique : seul le serveur controle l'acces pour chaque officine.
alter table public.private_catalog_access
  add column pricing_mode text not null default 'indicative'
  check (pricing_mode in ('indicative','contractual'));

create table public.private_catalog_indicative_tiers (
  product_id uuid not null references public.private_catalog_products(id) on delete cascade,
  min_quantity integer not null check (min_quantity between 1 and 5000),
  price_min_ht numeric(12,2) not null check (price_min_ht >= 0),
  price_max_ht numeric(12,2) not null check (price_max_ht >= 0),
  primary key (product_id, min_quantity),
  constraint private_catalog_indicative_tiers_range check (price_min_ht <= price_max_ht)
);

create table public.private_catalog_contract_tiers (
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  product_id uuid not null references public.private_catalog_products(id) on delete cascade,
  min_quantity integer not null check (min_quantity between 1 and 5000),
  price_ht numeric(12,2) not null check (price_ht >= 0),
  primary key (pharmacy_id, product_id, min_quantity)
);
create index private_catalog_contract_tiers_product_idx
  on public.private_catalog_contract_tiers(product_id);

alter table public.private_catalog_requests
  add column request_kind text not null default 'order'
  check (request_kind in ('quote','order'));
alter table public.private_catalog_requests
  alter column total_ht drop not null;
alter table public.private_catalog_requests
  add constraint private_catalog_requests_amount_by_kind
  check ((request_kind='quote' and total_ht is null)
      or (request_kind='order' and total_ht is not null));

alter table public.private_catalog_request_items
  alter column unit_price_ht drop not null,
  alter column line_total_ht drop not null;
alter table public.private_catalog_request_items
  add constraint private_catalog_items_price_pair
  check ((unit_price_ht is null and line_total_ht is null)
      or (unit_price_ht is not null and line_total_ht is not null));

alter table public.private_catalog_indicative_tiers enable row level security;
alter table public.private_catalog_contract_tiers enable row level security;
revoke all on public.private_catalog_indicative_tiers from anon, authenticated;
revoke all on public.private_catalog_contract_tiers from anon, authenticated;
grant all on public.private_catalog_indicative_tiers to service_role;
grant all on public.private_catalog_contract_tiers to service_role;
