begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000f8',
  'authenticated',
  'authenticated',
  'access.facilitator.multiskill@test.local',
  '',
  now(),
  '{}',
  '{"full_name":"Sabrina Multiskill","requested_profile_type":"facilitator","requested_access":{"type":"facilitator","activities":["animation","training"],"facilitator_kind":"mixte"}}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

select plan(7);

select is(
  (select requested_profile_type from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f8'),
  'facilitator',
  'facilitator signup metadata creates a facilitator access request'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$select public.approve_facilitator_access_request(
    (select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f8'),
    '00000000-0000-0000-0000-000000000101',
    'Double compétence validée'
  )$$,
  'super admin approves one multiskill facilitator account'
);

select is(
  (
    select count(*)
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.user_id = '00000000-0000-0000-0000-0000000000f8'
      and membership.brand_id = '00000000-0000-0000-0000-000000000101'
      and membership.status = 'active'
      and role.key = 'facilitator'
  ),
  1::bigint,
  'approval creates exactly one active facilitator membership'
);

select is(
  (select count(*) from public.field_providers where user_id = '00000000-0000-0000-0000-0000000000f8'),
  1::bigint,
  'approval creates exactly one field provider profile'
);

select is(
  (select skills from public.field_providers where user_id = '00000000-0000-0000-0000-0000000000f8'),
  array['animation','training']::text[],
  'field provider retains animation and training skills on one profile'
);

select is(
  (select provider_type::text from public.field_providers where user_id = '00000000-0000-0000-0000-0000000000f8'),
  'other',
  'mixed facilitator uses the compatibility provider type without splitting the account'
);

select is(
  (select status::text from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f8'),
  'approved',
  'facilitator request is marked approved'
);

reset role;
select * from finish();
rollback;
