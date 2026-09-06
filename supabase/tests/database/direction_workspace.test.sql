begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select ok(
  exists (select 1 from public.roles where key = 'brand_direction'),
  'Direction role exists'
);

select is(
  (select rank from public.roles where key = 'brand_direction'),
  50::smallint,
  'Direction role sits below brand admin and above brand user'
);

select is(
  (select (permissions ->> 'operations.manage')::boolean from public.roles where key = 'brand_direction'),
  false,
  'Direction role has no operational write permission'
);

select is(
  (select (permissions ->> 'users.manage')::boolean from public.roles where key = 'brand_direction'),
  false,
  'Direction role cannot manage users'
);

select has_function(
  'public',
  'get_direction_workspace',
  array['uuid','date','date','date'],
  'Direction workspace RPC exists'
);

insert into public.memberships (user_id, organization_id, brand_id, role_id, status)
values (
  '00000000-0000-0000-0000-0000000000a4',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  (select id from public.roles where key = 'brand_direction'),
  'active'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.get_direction_workspace(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31',
    '2026-09-06'
  )$$,
  'Direction member can read its brand workspace'
);

create temp table _direction_workspace as
select public.get_direction_workspace(
  '00000000-0000-0000-0000-000000000101',
  '2026-01-01',
  '2026-12-31',
  '2026-09-06'
) as payload;

select is(
  jsonb_typeof((select payload from _direction_workspace)),
  'object',
  'Direction workspace returns one executive object'
);

select is(
  jsonb_typeof((select payload -> 'territories' from _direction_workspace)),
  'array',
  'Direction workspace exposes territory comparison as an array'
);

select is(
  private.has_elevated_brand_access('00000000-0000-0000-0000-000000000101'),
  false,
  'Direction role does not inherit elevated operational access'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.get_direction_workspace(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31',
    '2026-09-06'
  )$$,
  '42501',
  'Direction workspace forbidden',
  'Agent cannot read the Direction workspace'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.get_direction_workspace(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31',
    '2026-09-06'
  )$$,
  'Brand admin keeps access to the Direction workspace'
);

select * from finish();
rollback;
