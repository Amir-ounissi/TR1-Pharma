-- TR1 PHARMA: catalogue prive, volontairement isole des commandes et du CRM existants.
-- Aucun acces direct depuis le navigateur : les lectures/ecritures passent par
-- des actions serveur apres authentification et autorisation explicite.
create table public.private_catalog_pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 180),
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  city text,
  contact_email text,
  created_at timestamptz not null default now()
);

create table public.private_catalog_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  invited_email text not null,
  role text not null default 'pharmacien' check (role in ('pharmacien','collaborateur')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index private_catalog_memberships_pharmacy_idx on public.private_catalog_memberships(pharmacy_id);

create table public.private_catalog_brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '',
  logo_url text,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.private_catalog_access (
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  brand_id uuid not null references public.private_catalog_brands(id) on delete cascade,
  active boolean not null default true,
  primary key (pharmacy_id,brand_id)
);

create table public.private_catalog_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.private_catalog_brands(id) on delete cascade,
  sku text not null,
  ean text check (ean is null or ean ~ '^[0-9]{8,14}$'),
  name text not null check (length(trim(name)) between 2 and 180),
  description text not null default '',
  format text not null default '',
  image_url text,
  price_ht numeric(12,2) not null check (price_ht >= 0),
  vat_rate numeric(5,2) not null check (vat_rate between 0 and 100),
  min_quantity integer not null default 1 check (min_quantity > 0),
  quantity_step integer not null default 1 check (quantity_step > 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(brand_id,sku)
);
create index private_catalog_products_brand_idx on public.private_catalog_products(brand_id,active);

create table public.private_catalog_prices (
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  product_id uuid not null references public.private_catalog_products(id) on delete cascade,
  price_ht numeric(12,2) not null check (price_ht >= 0),
  primary key (pharmacy_id,product_id)
);

create table public.private_catalog_requests (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id),
  brand_id uuid not null references public.private_catalog_brands(id),
  created_by uuid not null references auth.users(id),
  status text not null default 'received'
    check (status in ('received','verifying','forwarded','confirmed','closed','declined')),
  total_ht numeric(14,2) not null check (total_ht >= 0),
  created_at timestamptz not null default now()
);
create index private_catalog_requests_pharmacy_idx on public.private_catalog_requests(pharmacy_id,created_at desc);

create table public.private_catalog_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.private_catalog_requests(id) on delete cascade,
  product_id uuid references public.private_catalog_products(id) on delete set null,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price_ht numeric(12,2) not null check (unit_price_ht >= 0),
  vat_rate numeric(5,2) not null check (vat_rate between 0 and 100),
  line_total_ht numeric(14,2) not null check (line_total_ht >= 0)
);

-- Defense en profondeur : les tables sont inaccessibles via la cle publique.
-- Toutes les autorisations sont verifiees cote serveur AVANT toute operation admin.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'private_catalog_pharmacies','private_catalog_memberships','private_catalog_brands',
    'private_catalog_access','private_catalog_products','private_catalog_prices',
    'private_catalog_requests','private_catalog_request_items'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from anon, authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
  end loop;
end $$;
