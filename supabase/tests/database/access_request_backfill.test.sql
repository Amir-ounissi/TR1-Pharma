begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', 'legacy.valid@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated', 'legacy.invalid@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000e3', 'authenticated', 'authenticated', 'legacy.active@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', '');

update auth.users
set raw_user_meta_data = '{"requested_profile_type":"agent","requested_access":{"type":"agent","organization":"VK Swiss","territory":"Suisse romande"}}'::jsonb
where id = '00000000-0000-0000-0000-0000000000e1';
update auth.users
set raw_user_meta_data = '{"requested_profile_type":"unsupported","requested_access":{"type":"agent"}}'::jsonb
where id = '00000000-0000-0000-0000-0000000000e2';
update auth.users
set raw_user_meta_data = '{"requested_profile_type":"brand","requested_access":{"type":"brand","organization":"Already Active"}}'::jsonb
where id = '00000000-0000-0000-0000-0000000000e3';

insert into public.memberships (user_id, organization_id, brand_id, role_id, status)
values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'brand_admin'), 'active');

select plan(7);

select is(private.backfill_historical_access_requests(), 1, 'legacy valid metadata creates one declarative request');
select is(
  (select requested_profile_type from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000e1' and status = 'pending'),
  'agent',
  'backfilled request retains the requested profile type'
);
select is(
  (select requested_access ->> 'territory' from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000e1' and status = 'pending'),
  'Suisse romande',
  'backfilled request retains declarative access details only'
);
select is(
  (select count(*) from public.memberships where user_id = '00000000-0000-0000-0000-0000000000e1' and status = 'active'),
  0::bigint,
  'backfill never creates an active membership'
);
select is(private.backfill_historical_access_requests(), 0, 'backfill is idempotent');
select is(
  (select count(*) from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000e2'),
  0::bigint,
  'invalid historical metadata creates no request'
);
select is(
  (select count(*) from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000e3'),
  0::bigint,
  'a user with active tenant access receives no duplicate request'
);

select * from finish();
rollback;
