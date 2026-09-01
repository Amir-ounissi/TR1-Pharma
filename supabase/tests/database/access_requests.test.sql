begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000f1',
  'authenticated', 'authenticated', 'access.request@test.local', '', now(),
  '{}',
  '{"full_name":"Access Request","requested_profile_type":"agent","requested_access":{"type":"agent","organization":"VK Swiss"}}',
  now(), now(), '', '', '', ''
);

select has_table('public', 'access_requests', 'access request table exists');
select is(
  (select requested_profile_type from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'),
  'agent',
  'new auth user creates the requested access record'
);
select is(
  (select requested_access ->> 'organization' from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'),
  'VK Swiss',
  'requested access details are retained for review'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is(
  (select count(*) from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'),
  1::bigint,
  'requesting user can read only its own request'
);
select throws_ok(
  $$select public.approve_access_request((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-000000000101', array[]::uuid[], null)$$,
  '42501',
  'Platform administrator access is required',
  'non-platform user cannot approve an access request'
);

reset role;
select * from finish();
rollback;
