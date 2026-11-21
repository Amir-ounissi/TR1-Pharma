-- TR1 PHARMA V2 — schéma autonome. À exécuter uniquement sur une NOUVELLE base V2.
-- Aucune migration existante de production ou de staging n'est réutilisée.
create extension if not exists pgcrypto;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','pharmacy')),
  display_name text,
  created_at timestamptz not null default now()
);
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  siret text unique check (siret is null or siret ~ '^[0-9]{14}$'),
  created_at timestamptz not null default now()
);
create table public.pharmacy_memberships (
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (pharmacy_id,user_id)
);
create table public.pharmacy_brand_access (
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (pharmacy_id,brand_id)
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  sku text not null,
  name text not null,
  description text,
  format text,
  ean text check (ean is null or ean ~ '^[0-9]{8,14}$'),
  image_url text,
  price_ht numeric(12,2) not null check (price_ht >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate >= 0 and vat_rate <= 100),
  min_qty integer not null default 6 check (min_qty > 0),
  qty_step integer not null default 6 check (qty_step > 0),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (brand_id,sku)
);
create table public.price_rules (
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty integer not null check (min_qty > 0),
  price_ht numeric(12,2) not null check (price_ht >= 0),
  primary key (pharmacy_id,product_id,min_qty)
);
create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  origin text not null default 'catalogue' check (origin in ('catalogue','cockpit')),
  status text not null default 'received' check (status in ('received','verifying','forwarded','confirmed','closed','declined')),
  total_ht numeric(12,2) not null default 0 check (total_ht >= 0),
  created_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.order_requests(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price_ht numeric(12,2) not null check (unit_price_ht >= 0),
  line_total_ht numeric(12,2) not null check (line_total_ht >= 0)
);
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid references public.pharmacies(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  kind text not null check (kind in ('visit','call','email','followup','other')),
  note text,
  occurred_at timestamptz not null default now()
);
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid references public.pharmacies(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  kind text not null check (kind in ('animation','formation','merchandising')),
  status text not null default 'planned' check (status in ('planned','confirmed','completed','closed','cancelled')),
  scheduled_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('brand','pharmacy')),
  full_name text not null,
  email text not null,
  company_name text not null,
  website_url text,
  city text,
  note text,
  fingerprint text not null unique,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  event_name text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.products(brand_id,published);
create index on public.order_requests(pharmacy_id,created_at desc);
create index on public.order_requests(brand_id,created_at desc);
create index on public.order_items(request_id);
create index on public.leads(ip_hash,created_at desc);

-- Le profil est visible par son propriétaire uniquement. Aucun utilisateur
-- ne peut changer son rôle : cette opération passe par l'administration Auth.
alter table public.profiles enable row level security;
create policy profile_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Invoker : cette vérification ne lit que le profil autorisé par la RLS.
create function public.tr1_is_owner() returns boolean language sql stable security invoker
set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'owner'
  );
$$;
revoke all on function public.tr1_is_owner() from public;
grant execute on function public.tr1_is_owner() to authenticated;

alter table public.brands enable row level security;
create policy brands_read on public.brands for select to authenticated
  using (public.tr1_is_owner() or exists (
    select 1 from public.pharmacy_brand_access a
    join public.pharmacy_memberships m on m.pharmacy_id=a.pharmacy_id
    where a.brand_id=brands.id and a.active and m.active and m.user_id=(select auth.uid())
  ));
create policy brands_owner_write on public.brands for all to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());

alter table public.pharmacies enable row level security;
create policy pharmacy_read on public.pharmacies for select to authenticated
  using (public.tr1_is_owner() or exists (
    select 1 from public.pharmacy_memberships m
    where m.pharmacy_id=pharmacies.id and m.active and m.user_id=(select auth.uid())
  ));
create policy pharmacy_owner_write on public.pharmacies for all to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());

alter table public.pharmacy_memberships enable row level security;
create policy member_read on public.pharmacy_memberships for select to authenticated
  using (public.tr1_is_owner() or user_id=(select auth.uid()));
create policy member_owner_write on public.pharmacy_memberships for all to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());

alter table public.pharmacy_brand_access enable row level security;
create policy access_read on public.pharmacy_brand_access for select to authenticated
  using (public.tr1_is_owner() or exists (
    select 1 from public.pharmacy_memberships m
    where m.pharmacy_id=pharmacy_brand_access.pharmacy_id and m.user_id=(select auth.uid()) and m.active
  ));
create policy access_owner_write on public.pharmacy_brand_access for all to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());

alter table public.products enable row level security;
create policy products_read on public.products for select to authenticated
  using (public.tr1_is_owner() or (
    published and exists (
      select 1 from public.pharmacy_brand_access a
      join public.pharmacy_memberships m on m.pharmacy_id=a.pharmacy_id
      where a.brand_id=products.brand_id and a.active and m.active and m.user_id=(select auth.uid())
    )
  ));
create policy products_owner_write on public.products for all to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());

alter table public.price_rules enable row level security;
create policy prices_read on public.price_rules for select to authenticated
  using (public.tr1_is_owner() or exists (
    select 1 from public.pharmacy_memberships m
    where m.pharmacy_id=price_rules.pharmacy_id and m.active and m.user_id=(select auth.uid())
  ));
create policy prices_owner_write on public.price_rules for all to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());

alter table public.order_requests enable row level security;
create policy orders_read on public.order_requests for select to authenticated
  using (public.tr1_is_owner() or exists (
    select 1 from public.pharmacy_memberships m
    where m.pharmacy_id=order_requests.pharmacy_id and m.active and m.user_id=(select auth.uid())
  ));
create policy orders_owner_update on public.order_requests for update to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
-- Aucune insertion directe par le client : seule la fonction métier atomique ci-dessous écrit une demande.

alter table public.order_items enable row level security;
create policy items_read on public.order_items for select to authenticated
  using (public.tr1_is_owner() or exists (
    select 1 from public.order_requests r
    join public.pharmacy_memberships m on m.pharmacy_id=r.pharmacy_id
    where r.id=order_items.request_id and m.active and m.user_id=(select auth.uid())
  ));

alter table public.activities enable row level security;
create policy activities_owner on public.activities for all to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
alter table public.missions enable row level security;
create policy missions_owner on public.missions for all to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
alter table public.leads enable row level security;
create policy leads_owner_read on public.leads for select to authenticated
  using (public.tr1_is_owner());
alter table public.audit_events enable row level security;
create policy audit_owner_read on public.audit_events for select to authenticated
  using (public.tr1_is_owner());

-- Le rôle connecté ne peut pas inventer de prix ou de totaux.
revoke insert,delete on public.order_requests,public.order_items from authenticated,anon;
revoke update on public.order_items from authenticated,anon;
revoke insert,update,delete on public.leads,public.audit_events from authenticated,anon;
revoke insert,update,delete on public.profiles from authenticated,anon;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.place_catalogue_request(
  p_pharmacy_id uuid, p_product_id uuid, p_quantity integer
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_brand uuid;
  v_name text;
  v_sku text;
  v_price numeric(12,2);
  v_min integer;
  v_step integer;
  v_request uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles where id=v_actor and role='pharmacy'
  ) then raise exception 'Compte professionnel non autorisé'; end if;
  if not exists (
    select 1 from public.pharmacy_memberships
    where pharmacy_id=p_pharmacy_id and user_id=v_actor and active
  ) then raise exception 'Pharmacie non autorisée'; end if;
  select brand_id,name,sku,price_ht,min_qty,qty_step
    into v_brand,v_name,v_sku,v_price,v_min,v_step
    from public.products where id=p_product_id and published;
  if v_brand is null then raise exception 'Produit indisponible'; end if;
  if not exists (
    select 1 from public.pharmacy_brand_access a
    join public.brands b on b.id=a.brand_id
    where a.pharmacy_id=p_pharmacy_id and a.brand_id=v_brand and a.active and b.active
  ) then raise exception 'Marque non autorisée'; end if;
  if p_quantity is null or p_quantity < v_min or p_quantity > 5000
     or mod(p_quantity-v_min,v_step)<>0
  then raise exception 'Quantité invalide'; end if;
  select price_ht into v_price from public.price_rules
    where pharmacy_id=p_pharmacy_id and product_id=p_product_id
      and min_qty<=p_quantity order by min_qty desc limit 1;
  if v_price is null then
    select price_ht into v_price from public.products where id=p_product_id;
  end if;
  insert into public.order_requests(pharmacy_id,brand_id,created_by,origin,status,total_ht)
    values(p_pharmacy_id,v_brand,v_actor,'catalogue','received',v_price*p_quantity)
    returning id into v_request;
  insert into public.order_items(request_id,product_id,product_name,sku,quantity,unit_price_ht,line_total_ht)
    values(v_request,p_product_id,v_name,v_sku,p_quantity,v_price,v_price*p_quantity);
  insert into public.audit_events(actor_id,entity_type,entity_id,event_name,details)
    values(v_actor,'order_request',v_request,'catalogue_request_created',jsonb_build_object('pharmacy_id',p_pharmacy_id));
  return v_request;
end;
$$;
revoke all on function private.place_catalogue_request(uuid,uuid,integer) from public,anon;
grant execute on function private.place_catalogue_request(uuid,uuid,integer) to authenticated;
create function public.submit_catalogue_request(
  p_pharmacy_id uuid, p_product_id uuid, p_quantity integer
) returns uuid
language sql security invoker set search_path = '' as $$
  select private.place_catalogue_request(p_pharmacy_id,p_product_id,p_quantity);
$$;
revoke all on function public.submit_catalogue_request(uuid,uuid,integer) from public,anon;
grant execute on function public.submit_catalogue_request(uuid,uuid,integer) to authenticated;
