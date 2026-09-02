begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'access.agent@test.local', '', now(), '{}', '{"full_name":"Access Agent","requested_profile_type":"agent","requested_access":{"type":"agent","organization":"VK Swiss"}}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 'access.cross-brand@test.local', '', now(), '{}', '{"full_name":"Cross Brand","requested_profile_type":"agent","requested_access":{"type":"agent"}}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f3', 'authenticated', 'authenticated', 'access.facilitator@test.local', '', now(), '{}', '{"full_name":"Access Facilitator","requested_profile_type":"facilitator","requested_access":{"type":"facilitator"}}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f4', 'authenticated', 'authenticated', 'access.retry@test.local', '', now(), '{}', '{"full_name":"Retry Request","requested_profile_type":"brand","requested_access":{"type":"brand"}}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f5', 'authenticated', 'authenticated', 'access.cancel@test.local', '', now(), '{}', '{"full_name":"Cancel Request","requested_profile_type":"agent","requested_access":{"type":"agent"}}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f6', 'authenticated', 'authenticated', 'access.territory@test.local', '', now(), '{}', '{"full_name":"Territory Agent","requested_profile_type":"agent","requested_access":{"type":"agent","territory":"Paris Centre"}}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f7', 'authenticated', 'authenticated', 'access.wrong-territory@test.local', '', now(), '{}', '{"full_name":"Wrong Territory","requested_profile_type":"agent","requested_access":{"type":"agent"}}', now(), now(), '', '', '', '');

select plan(29);

select has_table('public', 'access_requests', 'access request table exists');
select is((select requested_profile_type from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), 'agent', 'new auth user creates the requested access record');
select is((select requested_access ->> 'organization' from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), 'VK Swiss', 'requested access details are retained for review');
select is((select count(*) from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f1' and status = 'active'), 0::bigint, 'signup metadata creates no active membership');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*) from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), 1::bigint, 'requesting user can read only its own request');
select throws_ok(
  $$select public.approve_access_request((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-000000000101', array[]::uuid[], null)$$,
  '42501', 'Platform administrator access is required', 'normal user cannot approve an access request'
);
select throws_ok(
  $$select public.approve_access_request_with_territory((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', null)$$,
  '42501', 'Platform administrator access is required', 'normal user cannot approve an agent territory request'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok(
  $$select public.approve_access_request((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-000000000101', array['00000000-0000-0000-0000-000000000411']::uuid[], 'Périmètre initial validé')$$,
  'super admin approves the agent on the selected brand scope'
);
select is((select count(*) from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f1' and brand_id = '00000000-0000-0000-0000-000000000101' and status = 'active'), 1::bigint, 'approved request creates one active membership on the selected brand');
select is((select count(*) from public.pharmacy_assignments where user_id = '00000000-0000-0000-0000-0000000000f1' and brand_id = '00000000-0000-0000-0000-000000000101' and brand_pharmacy_id = '00000000-0000-0000-0000-000000000411'), 1::bigint, 'approved agent receives only the selected pharmacy assignment');
select throws_ok(
  $$select public.approve_access_request((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-000000000101', array[]::uuid[], null)$$,
  'P0001', 'Access request has already been reviewed', 'treated request cannot be approved twice'
);
select throws_ok(
  $$select public.approve_access_request((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f2'), '00000000-0000-0000-0000-000000000101', array['00000000-0000-0000-0000-000000000413']::uuid[], null)$$,
  '23514', 'A pharmacy assignment does not belong to the selected brand', 'agent cannot be assigned a pharmacy from another brand'
);
select is((select count(*) from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f2'), 0::bigint, 'cross-brand approval failure creates no membership');
select lives_ok(
  $$select public.approve_access_request_with_territory((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f6'), '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'Territoire validé')$$,
  'super admin approves an agent with a valid territory'
);
select is((select territory_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f6' and status = 'active'), '00000000-0000-0000-0000-000000000201'::uuid, 'approved agent membership retains the selected territory');
select is((select count(*) from public.pharmacy_assignments where user_id = '00000000-0000-0000-0000-0000000000f6'), 2::bigint, 'approved agent receives every active pharmacy in the territory');
select is((select count(*) from public.pharmacy_assignments assignment join public.brand_pharmacies pharmacy on pharmacy.id = assignment.brand_pharmacy_id where assignment.user_id = '00000000-0000-0000-0000-0000000000f6' and pharmacy.territory_id <> '00000000-0000-0000-0000-000000000201'), 0::bigint, 'territory approval never assigns pharmacies outside the selected territory');
select is((select brand_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f6' and status = 'active'), '00000000-0000-0000-0000-000000000101'::uuid, 'approved agent membership belongs to the selected brand');
select is((select count(*) from public.memberships membership join public.roles role on role.id = membership.role_id where membership.user_id = '00000000-0000-0000-0000-0000000000f6' and role.key = 'agent'), 1::bigint, 'territory approval grants the agent role');
select throws_ok(
  $$select public.approve_access_request_with_territory((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f7'), '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', null)$$,
  '23514', 'Target territory must belong to the selected active brand', 'another brand territory is rejected atomically'
);
select is((select count(*) from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f7'), 0::bigint, 'wrong territory failure leaves no active membership');
select throws_ok(
  $$select public.approve_access_request_with_territory((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f4'), '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', null)$$,
  '23514', 'Territory approval is only available for agent requests', 'brand request cannot use the agent territory approval path'
);
select is((select count(*) from public.memberships where user_id = '00000000-0000-0000-0000-0000000000f4'), 0::bigint, 'brand request rejected by the agent path creates no membership');
select throws_ok(
  $$select public.approve_access_request((select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f3'), '00000000-0000-0000-0000-000000000101', array['00000000-0000-0000-0000-000000000411']::uuid[], null)$$,
  '23514', 'Only agents can receive pharmacy assignments at approval', 'non-agent cannot receive pharmacy assignments'
);

update public.access_requests
set status = 'rejected', reviewed_by = '00000000-0000-0000-0000-0000000000a1', reviewed_at = now(), reviewer_note = 'Demande à préciser'
where user_id = '00000000-0000-0000-0000-0000000000f4';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
select lives_ok($$select public.submit_my_access_request('brand', '{"type":"brand","company_name":"VK Swiss"}'::jsonb)$$, 'rejected user can submit a new pending request');
select is((select count(*) from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f4'), 2::bigint, 'rejected request history is retained');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select lives_ok($$select public.cancel_my_access_request()$$, 'requester can cancel its own pending request');
select lives_ok($$select public.submit_my_access_request('agent', '{"type":"agent","territory":"Suisse romande"}'::jsonb)$$, 'cancelled user can submit a new pending request');
select is((select count(*) from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f5' and status = 'pending'), 1::bigint, 'only one pending request is allowed per user');

reset role;
select * from finish();
rollback;
