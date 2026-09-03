begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);

insert into public.pharmacies (id, legal_name, trade_name, siret, cip_code, finess_code, postal_code, city, address_line_1)
values
  ('00000000-0000-0000-0000-00000000f501','Pharmacie Globale Commande','Pharmacie Globale Commande','12345678900999','CIP-GLOBAL-ORDER','FINESS-GLOBAL-ORDER','69001','Lyon','1 rue des Tests'),
  ('00000000-0000-0000-0000-00000000f502','Pharmacie Rollback','Pharmacie Rollback','12345678900998','CIP-ROLLBACK','FINESS-ROLLBACK','69002','Lyon','2 rue des Tests');

select is(
  (select relation_status from public.search_pharmacy_directory_for_order('00000000-0000-0000-0000-000000000101', null, null, 'CIP-GLOBAL-ORDER', null, null, null, 12)),
  'global_only',
  'directory lookup exposes a global-only pharmacy without changing RLS'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);

select lives_ok($$select * from public.create_order_with_pharmacy_resolution(
  '00000000-0000-0000-0000-000000000101', null, '00000000-0000-0000-0000-00000000f501', null,
  '{"external_order_id":"GLOBAL-FIRST","source":"agent","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]'
)$$, 'first order creates the brand relation atomically for an agent');

select is(
  (select count(*) from public.brand_pharmacies where brand_id='00000000-0000-0000-0000-000000000101' and pharmacy_id='00000000-0000-0000-0000-00000000f501' and archived_at is null),
  1::bigint,
  'first order creates exactly one brand pharmacy relation'
);
select is(
  (select count(*) from public.pharmacy_assignments assignment join public.brand_pharmacies relation on relation.id=assignment.brand_pharmacy_id where relation.pharmacy_id='00000000-0000-0000-0000-00000000f501' and assignment.user_id='00000000-0000-0000-0000-0000000000a3' and assignment.archived_at is null),
  1::bigint,
  'agent receives an assignment for the newly attached pharmacy'
);
select is(
  (select count(*) from public.pharmacies where siret='12345678900999'),
  1::bigint,
  'the global directory pharmacy is never duplicated'
);

select lives_ok($$select * from public.create_order_with_pharmacy_resolution(
  '00000000-0000-0000-0000-000000000101', null, '00000000-0000-0000-0000-00000000f501', null,
  '{"external_order_id":"GLOBAL-SECOND","source":"agent","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]'
)$$, 'second order reuses the existing relation');
select is(
  (select count(*) from public.brand_pharmacies where brand_id='00000000-0000-0000-0000-000000000101' and pharmacy_id='00000000-0000-0000-0000-00000000f501' and archived_at is null),
  1::bigint,
  'second order does not create another relation'
);

select throws_ok($$select * from public.create_order_with_pharmacy_resolution(
  '00000000-0000-0000-0000-000000000101', null, '00000000-0000-0000-0000-00000000f502', null,
  '{"external_order_id":"GLOBAL-ROLLBACK","source":"agent","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-999999999999","quantity":1,"unit_price_ht":10}]'
)$$, '23514', 'Order item product is unavailable for this brand', 'order failure rolls back the newly created brand relation');
select is(
  (select count(*) from public.brand_pharmacies where brand_id='00000000-0000-0000-0000-000000000101' and pharmacy_id='00000000-0000-0000-0000-00000000f502' and archived_at is null),
  0::bigint,
  'failed order leaves no orphan brand relation'
);

select throws_ok($$select * from public.create_order_with_pharmacy_resolution(
  '00000000-0000-0000-0000-000000000102', null, '00000000-0000-0000-0000-00000000f501', null,
  '{"external_order_id":"GLOBAL-CROSS-BRAND","source":"agent","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]'
)$$, '42501', 'Brand access is required', 'agent cannot attach a pharmacy to another brand');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select lives_ok($$select * from public.create_order_with_pharmacy_resolution(
  '00000000-0000-0000-0000-000000000101', null, null,
  '{"legal_name":"Pharmacie Création Explicite","siret":"12345678900997","postal_code":"69003","city":"Lyon"}',
  '{"external_order_id":"GLOBAL-EXPLICIT","order_status":"draft"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]'
)$$, 'explicit missing directory creation is supported');
select is(
  (select count(*) from public.pharmacies where siret='12345678900997'),
  1::bigint,
  'explicit creation adds one global directory pharmacy'
);

select * from finish();
rollback;
