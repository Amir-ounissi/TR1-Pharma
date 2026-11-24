
-- Isolated, non-commercial Vitalora demo. Never shares the real order tables.
create table public.demo_catalogue_access(
 pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
 brand_id uuid not null references public.brands(id) on delete cascade,
 active boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(pharmacy_id,brand_id)
);
create table public.demo_products(
 id uuid primary key default gen_random_uuid(),
 source_product_id uuid not null unique references public.products(id) on delete restrict,
 brand_id uuid not null references public.brands(id) on delete restrict,
 name text not null,
 sku text not null,
 ean text,
 format text,
 category text,
 description text,
 image_url text,
 demo_price_ht numeric(12,2) not null check (demo_price_ht>=0),
 min_qty integer not null default 3 check(min_qty>0),
 qty_step integer not null default 3 check(qty_step>0),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(brand_id,sku)
);
create table public.demo_price_tiers(
 product_id uuid not null references public.demo_products(id) on delete cascade,
 min_qty integer not null check(min_qty>0),
 price_ht numeric(12,2) not null check(price_ht>=0),
 primary key(product_id,min_qty)
);
create table public.demo_cart_items(
 user_id uuid not null references auth.users(id) on delete cascade,
 pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
 product_id uuid not null references public.demo_products(id) on delete cascade,
 quantity integer not null check(quantity>0 and quantity<=500),
 updated_at timestamptz not null default now(),
 primary key(user_id,pharmacy_id,product_id)
);
create table public.demo_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 pharmacy_id uuid not null references public.pharmacies(id),
 brand_id uuid not null references public.brands(id),
 status text not null default 'simulated' check(status='simulated'),
 total_ht numeric(14,2) not null default 0 check(total_ht>=0),
 created_at timestamptz not null default now()
);
create table public.demo_request_items(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.demo_requests(id) on delete cascade,
 product_id uuid not null references public.demo_products(id),
 product_name text not null,
 sku text not null,
 quantity integer not null check(quantity>0),
 unit_price_ht numeric(12,2) not null check(unit_price_ht>=0),
 total_ht numeric(14,2) not null check(total_ht>=0)
);
create index demo_catalogue_access_active_idx on public.demo_catalogue_access(brand_id,pharmacy_id) where active;
create index demo_requests_user_created_idx on public.demo_requests(user_id,created_at desc);
create index demo_requests_pharmacy_created_idx on public.demo_requests(pharmacy_id,created_at desc);
create index demo_request_items_request_idx on public.demo_request_items(request_id);

create or replace function private.demo_can_access(p_pharmacy_id uuid,p_brand_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
 and exists (
  select 1 from public.profiles p
  join public.pharmacy_memberships m on m.user_id=p.id
  join public.demo_catalogue_access a on a.pharmacy_id=m.pharmacy_id
  where p.id=(select auth.uid()) and p.role='pharmacy'
    and m.pharmacy_id=p_pharmacy_id and m.active
    and a.brand_id=p_brand_id and a.active
 );
$$;
revoke all on function private.demo_can_access(uuid,uuid) from public,anon;
grant execute on function private.demo_can_access(uuid,uuid) to authenticated;

alter table public.demo_catalogue_access enable row level security;
alter table public.demo_products enable row level security;
alter table public.demo_price_tiers enable row level security;
alter table public.demo_cart_items enable row level security;
alter table public.demo_requests enable row level security;
alter table public.demo_request_items enable row level security;

create policy demo_access_read on public.demo_catalogue_access for select to authenticated
using (public.tr1_is_owner() or private.demo_can_access(pharmacy_id,brand_id));
create policy demo_products_read on public.demo_products for select to authenticated
using (public.tr1_is_owner() or (active and exists (
 select 1 from public.demo_catalogue_access a
 where a.brand_id=demo_products.brand_id
 and private.demo_can_access(a.pharmacy_id,a.brand_id)
)));
create policy demo_tiers_read on public.demo_price_tiers for select to authenticated
using (public.tr1_is_owner() or exists (
 select 1 from public.demo_products p
 join public.demo_catalogue_access a on a.brand_id=p.brand_id
 where p.id=demo_price_tiers.product_id and p.active
 and private.demo_can_access(a.pharmacy_id,a.brand_id)
));
create policy demo_cart_read on public.demo_cart_items for select to authenticated
using (user_id=(select auth.uid()) and exists (
 select 1 from public.pharmacy_memberships m
 where m.user_id=(select auth.uid()) and m.pharmacy_id=demo_cart_items.pharmacy_id and m.active
));
create policy demo_requests_read on public.demo_requests for select to authenticated
using (public.tr1_is_owner() or (user_id=(select auth.uid()) and exists(
 select 1 from public.pharmacy_memberships m
 where m.pharmacy_id=demo_requests.pharmacy_id and m.user_id=(select auth.uid())
)));
create policy demo_request_items_read on public.demo_request_items for select to authenticated
using (public.tr1_is_owner() or exists (
 select 1 from public.demo_requests r
 where r.id=demo_request_items.request_id and r.user_id=(select auth.uid())
));
revoke all on public.demo_catalogue_access,public.demo_products,public.demo_price_tiers,
 public.demo_cart_items,public.demo_requests,public.demo_request_items from anon;
revoke all on public.demo_catalogue_access,public.demo_products,public.demo_price_tiers,
 public.demo_cart_items,public.demo_requests,public.demo_request_items from authenticated;
grant select on public.demo_catalogue_access,public.demo_products,public.demo_price_tiers,
 public.demo_cart_items,public.demo_requests,public.demo_request_items to authenticated;

create or replace function private.demo_set_cart_item(
 p_pharmacy_id uuid,p_product_id uuid,p_quantity integer
) returns void
language plpgsql security definer set search_path='' as $$
declare v_brand uuid;v_min integer;v_step integer;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='pharmacy'
 ) then raise exception 'Compte pharmacie requis'; end if;
 select brand_id,min_qty,qty_step into v_brand,v_min,v_step
 from public.demo_products where id=p_product_id and active;
 if v_brand is null or not private.demo_can_access(p_pharmacy_id,v_brand)
 then raise exception 'Accès démo indisponible'; end if;
 if p_quantity=0 then
   delete from public.demo_cart_items
   where user_id=(select auth.uid()) and pharmacy_id=p_pharmacy_id and product_id=p_product_id;
   return;
 end if;
 if p_quantity is null or p_quantity>500 or p_quantity<v_min
 or mod(p_quantity-v_min,v_step)<>0 then
  raise exception 'Quantité démo invalide';
 end if;
 insert into public.demo_cart_items(user_id,pharmacy_id,product_id,quantity,updated_at)
 values((select auth.uid()),p_pharmacy_id,p_product_id,p_quantity,now())
 on conflict(user_id,pharmacy_id,product_id)
 do update set quantity=excluded.quantity,updated_at=now();
end;
$$;
revoke all on function private.demo_set_cart_item(uuid,uuid,integer) from public,anon;
grant execute on function private.demo_set_cart_item(uuid,uuid,integer) to authenticated;
create or replace function public.demo_set_cart_item(
 p_pharmacy_id uuid,p_product_id uuid,p_quantity integer
) returns void language sql security invoker set search_path='' as $$
 select private.demo_set_cart_item(p_pharmacy_id,p_product_id,p_quantity);
$$;
revoke all on function public.demo_set_cart_item(uuid,uuid,integer) from public,anon;
grant execute on function public.demo_set_cart_item(uuid,uuid,integer) to authenticated;

create or replace function private.demo_checkout(p_pharmacy_id uuid,p_brand_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_request uuid;v_total numeric(14,2);v_rows integer;
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.profiles where id=(select auth.uid()) and role='pharmacy'
 ) or not private.demo_can_access(p_pharmacy_id,p_brand_id)
 then raise exception 'Accès démo refusé'; end if;
 perform 1 from public.demo_cart_items c
 where c.user_id=(select auth.uid()) and c.pharmacy_id=p_pharmacy_id for update;
 if not found then raise exception 'Panier démo vide';end if;
 if exists (
  select 1 from public.demo_cart_items c
  left join public.demo_products p on p.id=c.product_id
  where c.user_id=(select auth.uid()) and c.pharmacy_id=p_pharmacy_id
   and (p.brand_id<>p_brand_id or not p.active
     or c.quantity<p.min_qty or mod(c.quantity-p.min_qty,p.qty_step)<>0)
 ) then raise exception 'Lignes du panier démo invalides';end if;
 insert into public.demo_requests(user_id,pharmacy_id,brand_id,status,total_ht)
 values((select auth.uid()),p_pharmacy_id,p_brand_id,'simulated',0)
 returning id into v_request;
 with lines as (
  select c.product_id,p.name,p.sku,c.quantity,
   coalesce((select t.price_ht from public.demo_price_tiers t
     where t.product_id=c.product_id and t.min_qty<=c.quantity
     order by t.min_qty desc limit 1),p.demo_price_ht)::numeric(12,2) as unit_price
  from public.demo_cart_items c join public.demo_products p on p.id=c.product_id
  where c.user_id=(select auth.uid()) and c.pharmacy_id=p_pharmacy_id
 ), inserted as (
  insert into public.demo_request_items(request_id,product_id,product_name,sku,quantity,unit_price_ht,total_ht)
  select v_request,product_id,name,sku,quantity,unit_price,round(quantity*unit_price,2)
  from lines returning total_ht
 )
 select count(*),coalesce(sum(total_ht),0) into v_rows,v_total from inserted;
 if v_rows=0 or v_rows>100 then raise exception 'Panier démo invalide';end if;
 update public.demo_requests set total_ht=v_total where id=v_request;
 delete from public.demo_cart_items
 where user_id=(select auth.uid()) and pharmacy_id=p_pharmacy_id;
 return v_request;
end;
$$;
revoke all on function private.demo_checkout(uuid,uuid) from public,anon;
grant execute on function private.demo_checkout(uuid,uuid) to authenticated;
create or replace function public.demo_checkout(p_pharmacy_id uuid,p_brand_id uuid)
returns uuid language sql security invoker set search_path='' as $$
 select private.demo_checkout(p_pharmacy_id,p_brand_id);
$$;
revoke all on function public.demo_checkout(uuid,uuid) from public,anon;
grant execute on function public.demo_checkout(uuid,uuid) to authenticated;
