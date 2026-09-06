begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select has_function(
  'public',
  'get_kam_group_overview',
  array['uuid','date','date'],
  'KAM group overview RPC exists'
);

select has_function(
  'public',
  'get_kam_group_pharmacies',
  array['uuid','uuid','date','date'],
  'KAM group pharmacy RPC exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select * from public.get_kam_group_overview(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31'
  )$$,
  'brand admin can read KAM group overview'
);

select ok(
  exists (
    select 1
    from public.get_kam_group_overview(
      '00000000-0000-0000-0000-000000000101',
      '2026-01-01',
      '2026-12-31'
    )
    where group_id = '00000000-0000-0000-0000-000000000301'
      and group_name = 'Santé Plus'
      and park_pharmacies > 0
  ),
  'Santé Plus is exposed as a KAM network'
);

select ok(
  not exists (
    select 1
    from public.get_kam_group_overview(
      '00000000-0000-0000-0000-000000000101',
      '2026-01-01',
      '2026-12-31'
    )
    where non_customer_pharmacies <> park_pharmacies - customer_pharmacies
       or penetration_rate < 0
       or penetration_rate > 100
  ),
  'KAM penetration and remaining potential stay internally consistent'
);

select lives_ok(
  $$select * from public.get_kam_group_pharmacies(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301',
    '2026-01-01',
    '2026-12-31'
  )$$,
  'brand admin can drill down into a group park'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_kam_group_overview(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31'
  )$$,
  '42501',
  'KAM group access forbidden',
  'agent cannot read KAM group analytics'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_kam_group_overview(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31'
  )$$,
  '42501',
  'KAM group access forbidden',
  'another brand admin cannot read Dermavita KAM analytics'
);

select * from finish();
rollback;
