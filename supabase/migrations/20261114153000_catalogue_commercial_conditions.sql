-- TR1 PHARMA: conditions de distribution sans seuils commerciaux inventes.
-- Les fournisseurs restent non rattaches jusqu'a validation de l'operateur.
create table public.private_catalog_suppliers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 2 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.private_catalog_supplier_brands (
  brand_id uuid primary key references public.private_catalog_brands(id) on delete cascade,
  supplier_id uuid not null references public.private_catalog_suppliers(id) on delete cascade
);
create index private_catalog_supplier_brands_supplier_idx
  on public.private_catalog_supplier_brands(supplier_id);

create table public.private_catalog_supplier_terms (
  supplier_id uuid primary key references public.private_catalog_suppliers(id) on delete cascade,
  active boolean not null default false,
  verified_at timestamptz,
  minimum_order_units integer check (minimum_order_units is null or minimum_order_units between 1 and 100000),
  minimum_order_ht numeric(12,2) check (minimum_order_ht is null or minimum_order_ht >= 0),
  shipping_fee_ht numeric(12,2) check (shipping_fee_ht is null or shipping_fee_ht >= 0),
  free_shipping_from_ht numeric(12,2) check (free_shipping_from_ht is null or free_shipping_from_ht >= 0),
  gift_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(gift_rules)='array' and jsonb_array_length(gift_rules)<=20),
  source_note text not null default '' check (length(source_note)<=1000),
  updated_at timestamptz not null default now(),
  constraint terms_active_must_be_verified check (not active or verified_at is not null)
);

create table public.private_catalog_quantity_groups (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.private_catalog_brands(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 150),
  minimum_total_units integer not null check (minimum_total_units between 1 and 100000),
  quantity_multiple integer not null default 1 check (quantity_multiple between 1 and 10000),
  active boolean not null default false,
  source_note text not null default ''
);
create index private_catalog_quantity_groups_brand_idx on public.private_catalog_quantity_groups(brand_id);

create table public.private_catalog_quantity_group_products (
  group_id uuid not null references public.private_catalog_quantity_groups(id) on delete cascade,
  product_id uuid not null unique references public.private_catalog_products(id) on delete cascade,
  primary key(group_id,product_id)
);

-- Donnees commercialement sensibles accessibles seulement par RPC controle
-- ou aux administrateurs globaux dans l'outil interne.
alter table public.private_catalog_suppliers enable row level security;
alter table public.private_catalog_supplier_brands enable row level security;
alter table public.private_catalog_supplier_terms enable row level security;
alter table public.private_catalog_quantity_groups enable row level security;
alter table public.private_catalog_quantity_group_products enable row level security;
revoke all on public.private_catalog_suppliers,public.private_catalog_supplier_brands,
  public.private_catalog_supplier_terms,public.private_catalog_quantity_groups,
  public.private_catalog_quantity_group_products from public, anon, authenticated;
grant select,insert,update,delete on public.private_catalog_suppliers,public.private_catalog_supplier_brands,
  public.private_catalog_supplier_terms,public.private_catalog_quantity_groups,
  public.private_catalog_quantity_group_products to authenticated,service_role;
create policy platform_superadmin_only on public.private_catalog_suppliers for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));
create policy platform_superadmin_only on public.private_catalog_supplier_brands for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));
create policy platform_superadmin_only on public.private_catalog_supplier_terms for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));
create policy platform_superadmin_only on public.private_catalog_quantity_groups for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));
create policy platform_superadmin_only on public.private_catalog_quantity_group_products for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));

-- Biodance, source AMALFI Biodance 2026: les 5 masques s'additionnent
-- pour les paliers 12/24/40/96/200 et la commande totale est multiple de 4.
-- L'ancien minimum par reference de 12 etait contraire au document.
with g as (
  insert into public.private_catalog_quantity_groups
    (brand_id,name,minimum_total_units,quantity_multiple,active,source_note)
  select b.id,'Masques hydrogel Biodance',12,4,true,
    'Biodance2026.pdf, page 1: multiples de 4 sur le total de masques, paliers sur le nombre total commande'
  from public.private_catalog_brands b where b.slug='biodance'
  returning id
), updated_products as (
  update public.private_catalog_products p
     set min_quantity=1,quantity_step=1
  from public.private_catalog_brands b
  where p.brand_id=b.id and b.slug='biodance'
    and p.ean in ('8809937361718','8809937361725','8809891184583','8809891184569','8809891184613')
  returning p.id
)
insert into public.private_catalog_quantity_group_products(group_id,product_id)
select g.id, u.id from g cross join updated_products u;

-- Vue metier pour les pharmaciens avec controle d'appartenance officine.
create or replace function public.catalogue_commercial_context()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_groups jsonb;
  v_suppliers jsonb;
begin
  if (select auth.uid()) is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'brand_slug',b.slug,'name',g.name,
    'minimum_total_units',g.minimum_total_units,
    'quantity_multiple',g.quantity_multiple,
    'product_ids',(
      select coalesce(jsonb_agg(gp.product_id),'[]'::jsonb)
      from public.private_catalog_quantity_group_products gp
      join public.private_catalog_products p on p.id=gp.product_id and p.active
      where gp.group_id=g.id
    )
  ) order by b.slug,g.name),'[]'::jsonb)
  into v_groups
  from public.private_catalog_quantity_groups g
  join public.private_catalog_brands b on b.id=g.brand_id and b.active
  join public.private_catalog_access a on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
  where g.active;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.display_name,
    'brand_slugs',(
      select coalesce(jsonb_agg(b.slug order by b.name),'[]'::jsonb)
      from public.private_catalog_supplier_brands sb
      join public.private_catalog_brands b on b.id=sb.brand_id and b.active
      join public.private_catalog_access a on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
      where sb.supplier_id=s.id
    ),
    'minimum_order_units',t.minimum_order_units,
    'minimum_order_ht',t.minimum_order_ht,
    'shipping_fee_ht',t.shipping_fee_ht,
    'free_shipping_from_ht',t.free_shipping_from_ht,
    'gift_rules',coalesce(t.gift_rules,'[]'::jsonb),
    'conditions_verified',coalesce(t.active and t.verified_at is not null,false)
  ) order by s.display_name),'[]'::jsonb)
  into v_suppliers
  from public.private_catalog_suppliers s
  left join public.private_catalog_supplier_terms t on t.supplier_id=s.id
  where s.active and exists (
    select 1 from public.private_catalog_supplier_brands sb
    join public.private_catalog_brands b on b.id=sb.brand_id and b.active
    join public.private_catalog_access a on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
    where sb.supplier_id=s.id
  );

  return jsonb_build_object('quantity_groups',v_groups,'suppliers',v_suppliers);
end $$;
revoke all on function public.catalogue_commercial_context() from public,anon,authenticated;
grant execute on function public.catalogue_commercial_context() to authenticated;
