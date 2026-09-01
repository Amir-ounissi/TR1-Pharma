begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 'invite.current@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', 'invite.other@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.memberships (user_id, organization_id, brand_id, role_id, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'brand_admin'), 'invited'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000002', null, (select id from public.roles where key = 'super_admin'), 'invited'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'brand_user'), 'suspended'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000102', (select id from public.roles where key = 'brand_admin'), 'invited');

select plan(8);

select has_function('public', 'accept_my_invited_memberships', array[]::text[], 'invited membership activation RPC exists');
select ok((select prosecdef from pg_proc where oid = 'public.accept_my_invited_memberships()'::regprocedure), 'invited membership activation runs as security definer');
select is((select proconfig[1] from pg_proc where oid = 'public.accept_my_invited_memberships()'::regprocedure), 'search_path=""', 'invited membership activation pins search_path');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is(public.accept_my_invited_memberships(), 1::bigint, 'current user activates only its legitimate tenant invitation');
reset role;
select is((select status from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1' and brand_id = '00000000-0000-0000-0000-000000000101' and role_id = (select id from public.roles where key = 'brand_admin')), 'active'::public.membership_status, 'current invited membership becomes active');
select is((select status from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d2'), 'invited'::public.membership_status, 'another user invitation is unchanged');
select is((select status from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1' and role_id = (select id from public.roles where key = 'brand_user')), 'suspended'::public.membership_status, 'suspended membership stays suspended');
select is((select status from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1' and brand_id is null and role_id = (select id from public.roles where key = 'super_admin')), 'invited'::public.membership_status, 'invited super admin membership is never auto-activated');

select * from finish();
rollback;
