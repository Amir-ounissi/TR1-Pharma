
create table public.brand_trade_terms (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  minimum_order_units integer check (minimum_order_units > 0),
  minimum_order_ht numeric(12,2) check (minimum_order_ht >= 0),
  shipping_fee_ht numeric(12,2) check (shipping_fee_ht >= 0),
  free_shipping_from_ht numeric(12,2) check (free_shipping_from_ht >= 0),
  order_email text,
  notes text,
  verified boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.brand_trade_terms enable row level security;
create policy brand_terms_read on public.brand_trade_terms for select to authenticated using (public.tr1_is_owner());
create policy brand_terms_insert on public.brand_trade_terms for insert to authenticated with check (public.tr1_is_owner());
create policy brand_terms_update on public.brand_trade_terms for update to authenticated using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy brand_terms_delete on public.brand_trade_terms for delete to authenticated using (public.tr1_is_owner());
revoke all on public.brand_trade_terms from anon;
grant select,insert,update,delete on public.brand_trade_terms to authenticated;
drop policy tiers_owner_select on public.product_quantity_tiers;
create policy tiers_approved_read on public.product_quantity_tiers for select to authenticated
using (public.tr1_is_owner() or
  (verified and exists (
    select 1 from public.products p
    join public.brands b on b.id=p.brand_id
    join public.pharmacy_brand_access a on a.brand_id=b.id and a.active
    join public.pharmacy_memberships m on m.pharmacy_id=a.pharmacy_id and m.active
    where p.id=product_quantity_tiers.product_id and p.published and b.active
      and m.user_id=(select auth.uid())
  ))
);
create or replace function private.place_catalogue_request(
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
    from public.products where id=p_product_id and published and not requires_review and price_verified;
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
    select price_ht into v_price from public.product_quantity_tiers
    where product_id=p_product_id and min_qty<=p_quantity and verified
    order by min_qty desc limit 1;
  end if;
  if v_price is null then
    select price_ht into v_price from public.products where id=p_product_id;
  end if;
  insert into public.order_requests(pharmacy_id,brand_id,created_by,origin,status,total_ht)
    values(p_pharmacy_id,v_brand,v_actor,'catalogue','received',round(v_price*p_quantity,2))
    returning id into v_request;
  insert into public.order_items(request_id,product_id,product_name,sku,quantity,unit_price_ht,line_total_ht)
    values(v_request,p_product_id,v_name,v_sku,p_quantity,v_price,round(v_price*p_quantity,2));
  insert into public.audit_events(actor_id,entity_type,entity_id,event_name,details)
    values(v_actor,'order_request',v_request,'catalogue_request_created',jsonb_build_object('pharmacy_id',p_pharmacy_id));
  return v_request;
end;
$$;
revoke all on function private.place_catalogue_request(uuid,uuid,integer) from public,anon;
grant execute on function private.place_catalogue_request(uuid,uuid,integer) to authenticated;
