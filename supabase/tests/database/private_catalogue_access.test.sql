begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,email_change_token_new,recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'f6e20000-0000-4000-8000-000000000001',
  'authenticated','authenticated','private-catalogue-test@example.invalid','',null,
  '{}','{}',now(),now(),'','','',''
);

insert into public.private_catalog_pharmacies(id,name,city)
values ('f6e20000-0000-4000-8000-000000000010','Officine fictive','Istres');
insert into public.private_catalog_brands(id,slug,name,active)
values ('f6e20000-0000-4000-8000-000000000020','test-private-catalogue','Marque de test',true);
insert into public.private_catalog_products(id,brand_id,sku,name,price_ht,vat_rate,min_quantity,quantity_step,active)
values ('f6e20000-0000-4000-8000-000000000030',
 'f6e20000-0000-4000-8000-000000000020','TEST-001','Sérum fictif',999.99,5.5,12,12,true);
insert into public.private_catalog_access(pharmacy_id,brand_id,active,pricing_mode)
values ('f6e20000-0000-4000-8000-000000000010',
 'f6e20000-0000-4000-8000-000000000020',true,'indicative');
insert into public.private_catalog_indicative_tiers(product_id,min_quantity,price_min_ht,price_max_ht)
values ('f6e20000-0000-4000-8000-000000000030',12,9,13);
insert into public.private_catalog_contract_tiers(pharmacy_id,product_id,min_quantity,price_ht)
values ('f6e20000-0000-4000-8000-000000000010',
 'f6e20000-0000-4000-8000-000000000030',12,8.99);
insert into public.private_catalog_invitations(pharmacy_id,email,invited_by)
values ('f6e20000-0000-4000-8000-000000000010',
 'private-catalogue-test@example.invalid','f6e20000-0000-4000-8000-000000000001');

select plan(15);
select ok(not has_function_privilege('anon','public.catalogue_claim_invitation()','execute'),
 'anonymous clients cannot claim invitations');
select ok(not has_function_privilege('anon','public.catalogue_my_data(text)','execute'),
 'anonymous clients cannot read private catalogue');
select ok(not has_function_privilege('anon','public.catalogue_submit_request(text,jsonb)','execute'),
 'anonymous clients cannot order');
select ok(has_function_privilege('authenticated','public.catalogue_my_data(text)','execute'),
 'authenticated client can invoke guarded catalogue function');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f6e20000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','f6e20000-0000-4000-8000-000000000001',true);
select is(public.catalogue_claim_invitation(),false,'unconfirmed email cannot claim invitation');
select is(public.catalogue_my_data('test-private-catalogue'),null::jsonb,'unconfirmed email cannot read prices');
reset role;

update auth.users set email_confirmed_at=now()
where id='f6e20000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f6e20000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','f6e20000-0000-4000-8000-000000000001',true);
select is(public.catalogue_claim_invitation(),true,'verified invited pharmacist can claim');
select throws_ok(
  'select public.catalogue_submit_request(''test-private-catalogue'',
    ''[{"product_id":"f6e20000-0000-4000-8000-000000000030","quantity":11}]''::jsonb)',
  '22023',
  'Minimum de commande non respecte: 12 unites minimum',
  'the minimum remains enforced');
select is(
  public.catalogue_my_data('test-private-catalogue')->'products'->0->'pricing'->>'mode',
  'indicative','default display is indicative');
select ok(public.catalogue_my_data('test-private-catalogue')::text not like '%999.99%',
 'internal reference price never escapes to the pharmacy');
select is(
  public.catalogue_submit_request('test-private-catalogue',
  '[{"product_id":"f6e20000-0000-4000-8000-000000000030","quantity":13}]'::jsonb)
  ->>'request_kind',
  'quote','a unit increment above the minimum is accepted without a contract');
reset role;

update public.private_catalog_access set pricing_mode='contractual'
where pharmacy_id='f6e20000-0000-4000-8000-000000000010';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f6e20000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','f6e20000-0000-4000-8000-000000000001',true);
select is(
  (public.catalogue_my_data('test-private-catalogue')->'products'->0->'pricing'->'tiers'->0->>'price_ht')::numeric,
  8.99::numeric, 'the authorised client sees only its contract price');
select is(
  public.catalogue_submit_request('test-private-catalogue',
  '[{"product_id":"f6e20000-0000-4000-8000-000000000030","quantity":12}]'::jsonb)
  ->>'request_kind',
  'order','with agreement, request is an order');
select is(
  (public.catalogue_my_data()->'requests'->0->>'total_ht')::numeric,
  107.88::numeric, 'server recalculates the total exactly');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000000","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
select is(public.catalogue_my_data('test-private-catalogue'),null::jsonb,
 'another authenticated user cannot read this pharmacy');
reset role;

select * from finish();
rollback;
