begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select has_function(
  'public',
  'get_pharma_360',
  array['uuid','uuid'],
  'Pharma 360 RPC exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.get_pharma_360(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411'
  )$$,
  'brand admin can open a Pharma 360 account'
);

create temp table _pharma360 as
select public.get_pharma_360(
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411'
) as payload;

select is(
  jsonb_typeof((select payload from _pharma360)),
  'object',
  'Pharma 360 returns one consolidated object'
);

select is(
  (select payload #>> '{account,brand_pharmacy_id}' from _pharma360),
  '00000000-0000-0000-0000-000000000411',
  'snapshot stays on the requested brand pharmacy'
);

select ok(
  (select payload ?& array['account','business','assortment','field','trade','sell_out','opportunities','capabilities'] from _pharma360),
  'snapshot exposes every Pharma 360 layer'
);

select ok(
  (select jsonb_typeof(payload #> '{assortment,products}') = 'array'
      and jsonb_typeof(payload #> '{field,interactions}') = 'array'
      and jsonb_typeof(payload #> '{opportunities}') = 'array'
   from _pharma360),
  'consolidated collections keep explicit array shapes'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.get_pharma_360(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411'
  )$$,
  '42501',
  'Pharma 360 forbidden',
  'agent cannot read the consolidated manager snapshot'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.get_pharma_360(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411'
  )$$,
  '42501',
  'Pharma 360 forbidden',
  'another brand admin cannot read Dermavita Pharma 360'
);

select * from finish();
rollback;
