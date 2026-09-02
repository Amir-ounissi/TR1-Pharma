begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 'invite.current@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', 'invite.retry@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.memberships (user_id, organization_id, brand_id, role_id, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'agent'), 'invited'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000002', null, (select id from public.roles where key = 'super_admin'), 'invited'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'brand_admin'), 'active');

select plan(9);

select has_function('public', 'accept_my_invited_memberships', array[]::text[], 'legacy invitation activation RPC remains discoverable for migration compatibility');
select is(
  (select count(*) from pg_trigger where tgrelid = 'public.user_profiles'::regclass and tgname = 'activate_memberships_after_onboarding' and not tgisinternal),
  0::bigint,
  'profile completion no longer has a membership activation trigger'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok(
  $$update public.user_profiles set full_name = 'Invité Direct', onboarding_completed_at = now() where user_id = '00000000-0000-0000-0000-0000000000d1'$$,
  'an invited user may update its own profile without activating access'
);
select is(
  (select status from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1' and brand_id = '00000000-0000-0000-0000-000000000101'),
  'invited'::public.membership_status,
  'direct profile completion does not activate a tenant membership'
);
select is(
  (select status from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1' and brand_id is null),
  'invited'::public.membership_status,
  'direct profile completion never activates a platform membership'
);
select is(
  (select count(*) from public.brand_pharmacies where brand_id = '00000000-0000-0000-0000-000000000101'),
  0::bigint,
  'an invited agent receives no tenant data before controlled activation'
);
select throws_ok(
  $$select public.accept_my_invited_memberships()$$,
  '42501', 'permission denied for function accept_my_invited_memberships',
  'an authenticated user cannot call the retired activation RPC'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select lives_ok(
  $$update public.user_profiles set full_name = 'Invitation Retry', onboarding_completed_at = now() where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  'an already active tenant invitation can finish an incomplete profile on retry'
);
select is(
  (select status from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d2' and brand_id = '00000000-0000-0000-0000-000000000101'),
  'active'::public.membership_status,
  'retry leaves an already active tenant membership active'
);

reset role;
select * from finish();
rollback;
