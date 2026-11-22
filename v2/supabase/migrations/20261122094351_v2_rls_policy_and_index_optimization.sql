-- V2: Foreign-key indexes and non-duplicated owner RLS policies.
create index if not exists activities_brand_id_idx on public.activities(brand_id);
create index if not exists activities_pharmacy_id_idx on public.activities(pharmacy_id);
create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists missions_brand_id_idx on public.missions(brand_id);
create index if not exists missions_pharmacy_id_idx on public.missions(pharmacy_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_requests_created_by_idx on public.order_requests(created_by);
create index if not exists pharmacy_brand_access_brand_id_idx on public.pharmacy_brand_access(brand_id);
create index if not exists pharmacy_memberships_user_id_idx on public.pharmacy_memberships(user_id);
create index if not exists price_rules_product_id_idx on public.price_rules(product_id);
drop policy brands_owner_write on public.brands;
create policy brands_owner_insert on public.brands for insert to authenticated
  with check (public.tr1_is_owner());
create policy brands_owner_update on public.brands for update to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy brands_owner_delete on public.brands for delete to authenticated
  using (public.tr1_is_owner());
drop policy pharmacy_owner_write on public.pharmacies;
create policy pharmacy_owner_insert on public.pharmacies for insert to authenticated
  with check (public.tr1_is_owner());
create policy pharmacy_owner_update on public.pharmacies for update to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy pharmacy_owner_delete on public.pharmacies for delete to authenticated
  using (public.tr1_is_owner());
drop policy member_owner_write on public.pharmacy_memberships;
create policy member_owner_insert on public.pharmacy_memberships for insert to authenticated
  with check (public.tr1_is_owner());
create policy member_owner_update on public.pharmacy_memberships for update to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy member_owner_delete on public.pharmacy_memberships for delete to authenticated
  using (public.tr1_is_owner());
drop policy access_owner_write on public.pharmacy_brand_access;
create policy access_owner_insert on public.pharmacy_brand_access for insert to authenticated
  with check (public.tr1_is_owner());
create policy access_owner_update on public.pharmacy_brand_access for update to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy access_owner_delete on public.pharmacy_brand_access for delete to authenticated
  using (public.tr1_is_owner());
drop policy products_owner_write on public.products;
create policy products_owner_insert on public.products for insert to authenticated
  with check (public.tr1_is_owner());
create policy products_owner_update on public.products for update to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy products_owner_delete on public.products for delete to authenticated
  using (public.tr1_is_owner());
drop policy prices_owner_write on public.price_rules;
create policy prices_owner_insert on public.price_rules for insert to authenticated
  with check (public.tr1_is_owner());
create policy prices_owner_update on public.price_rules for update to authenticated
  using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy prices_owner_delete on public.price_rules for delete to authenticated
  using (public.tr1_is_owner());
