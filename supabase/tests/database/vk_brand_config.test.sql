begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

select has_column('public', 'brands', 'commercial_email', 'brands expose commercial email');
select has_column('public', 'brands', 'order_email', 'brands expose order email');
select has_column('public', 'brands', 'address_line_1', 'brands expose an operational address');
select has_column('public', 'products', 'tax_rate', 'products expose VAT');
select has_column('public', 'products', 'units_per_case', 'products expose packaging');
select has_column('public', 'products', 'minimum_order_quantity', 'products expose MOQ');

select throws_ok(
  $$insert into public.products (brand_id, name, sku, tax_rate) values ('00000000-0000-0000-0000-000000000101', 'Produit TVA invalide', 'VAT-ERR', 120)$$,
  '23514',
  null,
  'product VAT is constrained between 0 and 100'
);
select throws_ok(
  $$insert into public.products (brand_id, name, sku, units_per_case) values ('00000000-0000-0000-0000-000000000101', 'Produit colisage invalide', 'CASE-ERR', 0)$$,
  '23514',
  null,
  'product packaging must remain strictly positive'
);
select throws_ok(
  $$insert into public.products (brand_id, name, sku, minimum_order_quantity) values ('00000000-0000-0000-0000-000000000101', 'Produit MOQ invalide', 'MOQ-ERR', 0)$$,
  '23514',
  null,
  'product MOQ must remain strictly positive'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$select public.update_onboarding_settings(
    '00000000-0000-0000-0000-000000000101',
    '{
      "name":"Dermavita",
      "code":"DERMAVITA",
      "slug":"dermavita",
      "country_code":"FR",
      "currency_code":"EUR",
      "commercial_email":"ops@dermavita.local",
      "order_email":"orders@dermavita.local",
      "phone":"+33142009999",
      "address_line_1":"99 avenue des Tests",
      "postal_code":"75009",
      "city":"Paris",
      "default_reorder_interval_days":30,
      "first_reorder_target_days":45,
      "reorder_due_soon_days":7,
      "at_risk_multiplier":1.5,
      "dormant_multiplier":2,
      "reorder_eligibility_days":10,
      "post_mission_followup_days":14,
      "timezone":"Europe/Paris"
    }'::jsonb
  )$$,
  'platform administrator can configure operational brand settings through the canonical RPC'
);
select is(
  (select commercial_email from public.brands where id = '00000000-0000-0000-0000-000000000101'),
  'ops@dermavita.local',
  'brand commercial email is persisted'
);
select is(
  (select order_email from public.brands where id = '00000000-0000-0000-0000-000000000101'),
  'orders@dermavita.local',
  'brand order recipient email is persisted'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*) from public.products), 1::bigint, 'brand admin reads only its own catalog');
select is((select count(*) from public.products where brand_id = '00000000-0000-0000-0000-000000000102'), 0::bigint, 'brand admin reads no cross-brand product');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select is((select count(*) from public.products), 1::bigint, 'agent can read the catalog of its own brand');
select throws_ok(
  $$insert into public.products (brand_id, name, sku) values ('00000000-0000-0000-0000-000000000101', 'Création agent interdite', 'AGENT-ERR')$$,
  '42501',
  null,
  'agent cannot modify the catalog'
);
select throws_ok(
  $$select public.update_onboarding_settings(
    '00000000-0000-0000-0000-000000000101',
    '{"name":"Dermavita","code":"DERMAVITA","slug":"dermavita","country_code":"FR","currency_code":"EUR","default_reorder_interval_days":30,"first_reorder_target_days":45,"reorder_due_soon_days":7,"at_risk_multiplier":1.5,"dormant_multiplier":2,"reorder_eligibility_days":10,"post_mission_followup_days":14,"timezone":"Europe/Paris"}'::jsonb
  )$$,
  '42501',
  'Settings update forbidden',
  'agent cannot update sensitive brand configuration'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
select is((select count(*) from public.products), 1::bigint, 'other brand admin reads only its own catalog');
select is((select count(*) from public.products where brand_id = '00000000-0000-0000-0000-000000000101'), 0::bigint, 'other brand admin cannot access Dermavita catalog');

reset role;
select * from finish();
rollback;
