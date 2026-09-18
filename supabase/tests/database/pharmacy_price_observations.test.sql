begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

select has_table('public', 'pharmacy_price_observations', 'price observations table exists');
select has_table('public', 'pharmacy_price_observation_attachments', 'price evidence table exists');
select has_function(
  'public',
  'save_pharmacy_price_observation',
  array['uuid','uuid','uuid','uuid','text','numeric','text','integer','text','numeric','jsonb','text'],
  'price observation RPC exists'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.save_pharmacy_price_observation(uuid,uuid,uuid,uuid,text,numeric,text,integer,text,numeric,jsonb,text)'::regprocedure),
  'price observation RPC is security-definer'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_pharmacy_price_observation(uuid,uuid,uuid,uuid,text,numeric,text,integer,text,numeric,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated users can call price observation RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.save_pharmacy_price_observation(uuid,uuid,uuid,uuid,text,numeric,text,integer,text,numeric,jsonb,text)',
    'EXECUTE'
  ),
  'anonymous users cannot call price observation RPC'
);

insert into public.field_visits(
  id, owner_user_id, pharmacy_id, visit_kind, status, title, objective,
  scheduled_start_at, scheduled_end_at, source, created_by
) values (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-000000000401',
  'client_visit',
  'planned',
  'Prix terrain test',
  'Collecter un prix',
  now() + interval '1 day',
  now() + interval '1 day 45 minutes',
  'manual',
  '00000000-0000-0000-0000-0000000000a3'
);

insert into public.field_visit_brands(visit_id,brand_id,brand_pharmacy_id,objective,is_primary)
values(
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'Collecter un prix',
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

create temp table _regular_observation as
select public.save_pharmacy_price_observation(
  null,
  '00000000-0000-0000-0000-000000000411',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000601',
  '3400000000001',
  31.90,
  'regular',
  null,
  'photo',
  0.95,
  '{"ean":"3400000000001","price":31.90}'::jsonb,
  'Étiquette linéaire'
) as id;

select is(
  (select count(*)::bigint from public.pharmacy_price_observations where id=(select id from _regular_observation)),
  1::bigint,
  'assigned agent records a price observation'
);

select is(
  (select unit_price_ttc from public.pharmacy_price_observations where id=(select id from _regular_observation)),
  31.90::numeric,
  'regular observation keeps its unit price'
);

select is(
  (select field_visit_id from public.pharmacy_price_observations where id=(select id from _regular_observation)),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'observation is linked to the source visit'
);

create temp table _bundle_observation as
select public.save_pharmacy_price_observation(
  null,
  '00000000-0000-0000-0000-000000000411',
  null,
  '00000000-0000-0000-0000-000000000601',
  '3400000000001',
  49.80,
  'bundle',
  2,
  'manual',
  null,
  null,
  'Lot de deux'
) as id;

select is(
  (select unit_price_ttc from public.pharmacy_price_observations where id=(select id from _bundle_observation)),
  24.9000::numeric,
  'bundle observation stores the calculated unit price'
);

select throws_ok(
  $$select public.save_pharmacy_price_observation(
    null,
    '00000000-0000-0000-0000-000000000411',
    null,
    '00000000-0000-0000-0000-000000000602',
    null,
    24.90,
    'regular',
    null,
    'manual',
    null,
    null,
    null
  )$$,
  '23514',
  'Price product unavailable',
  'product from another brand is rejected'
);

select throws_ok(
  $$select public.save_pharmacy_price_observation(
    null,
    '00000000-0000-0000-0000-000000000411',
    null,
    '00000000-0000-0000-0000-000000000601',
    null,
    29.90,
    'regular',
    null,
    'photo',
    0.90,
    '{"customer_name":"Jean Dupont","price":29.9}'::jsonb,
    null
  )$$,
  '22023',
  'Price extraction must not contain patient or customer personal data',
  'PII-like extraction payload is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_pharmacy_price_observation(
    null,
    '00000000-0000-0000-0000-000000000411',
    null,
    '00000000-0000-0000-0000-000000000601',
    null,
    29.90,
    'regular',
    null,
    'manual',
    null,
    null,
    null
  )$$,
  '42501',
  'Price observation forbidden',
  'user outside the brand scope cannot collect a price'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_pharmacy_price_observation(
    null,
    '00000000-0000-0000-0000-000000000411',
    null,
    '00000000-0000-0000-0000-000000000601',
    null,
    20,
    'bundle',
    1,
    'manual',
    null,
    null,
    null
  )$$,
  '22023',
  'Bundle quantity is required',
  'invalid bundle quantity is rejected'
);

select is(
  (select capture_method from public.pharmacy_price_observations where id=(select id from _regular_observation)),
  'photo',
  'photo provenance is preserved'
);

select * from finish();
rollback;
