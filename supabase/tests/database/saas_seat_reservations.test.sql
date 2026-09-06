begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'saas.reserved.one@test.local', '', now(), '{}', '{"full_name":"SaaS Reserved One"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 'saas.reserved.two@test.local', '', now(), '{}', '{"full_name":"SaaS Reserved Two"}', now(), now(), '', '', '', '');

select plan(22);

select has_table('private','brand_seat_reservations','private seat reservation ledger exists');
select has_function('public','reserve_brand_saas_seat',array['uuid','text','smallint','uuid'],'seat reservation RPC exists');
select has_function('public','consume_brand_saas_seat',array['uuid','uuid'],'seat reservation consumption RPC exists');
select has_function('public','release_brand_saas_seat',array['uuid'],'seat reservation release RPC exists');

select ok(
  not has_function_privilege('authenticated','public.reserve_brand_saas_seat(uuid,text,smallint,uuid)','EXECUTE'),
  'authenticated users cannot reserve seats directly'
);
select ok(
  not has_function_privilege('authenticated','public.consume_brand_saas_seat(uuid,uuid)','EXECUTE'),
  'authenticated users cannot consume seat reservations directly'
);
select ok(
  not has_function_privilege('authenticated','public.release_brand_saas_seat(uuid)','EXECUTE'),
  'authenticated users cannot release seat reservations directly'
);
select ok(
  has_function_privilege('service_role','public.reserve_brand_saas_seat(uuid,text,smallint,uuid)','EXECUTE'),
  'service role can reserve seats'
);
select ok(
  has_function_privilege('service_role','public.consume_brand_saas_seat(uuid,uuid)','EXECUTE'),
  'service role can consume seat reservations'
);
select ok(
  has_function_privilege('service_role','public.release_brand_saas_seat(uuid)','EXECUTE'),
  'service role can release seat reservations'
);

select is(
  (select count(distinct user_id) from public.memberships where brand_id='00000000-0000-0000-0000-000000000101' and status in ('invited','active')),
  6::bigint,
  'Dermavita starts with six occupied seats in the deterministic seed'
);

update public.brand_saas_entitlements
set seat_limit=7
where brand_id='00000000-0000-0000-0000-000000000101';

select lives_ok(
  $$select public.reserve_brand_saas_seat(
    '00000000-0000-0000-0000-000000000101',
    'saas.reserved.one@test.local',
    (select id from public.roles where key='brand_user'),
    '00000000-0000-0000-0000-0000000000a1'
  )$$,
  'the final available seat can be reserved before the Auth invitation'
);
select is(
  (select count(*) from private.brand_seat_reservations where brand_id='00000000-0000-0000-0000-000000000101' and expires_at > now()),
  1::bigint,
  'the live reservation is persisted while the external invitation is pending'
);
select throws_ok(
  $$update public.brand_saas_entitlements
    set seat_limit=6
    where brand_id='00000000-0000-0000-0000-000000000101'$$,
  '23514',
  'Seat limit cannot be below current seat usage (7)',
  'an administrator cannot shrink capacity underneath a live reservation'
);
select throws_ok(
  $$insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
    values(
      '00000000-0000-0000-0000-0000000000f2',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000101',
      (select id from public.roles where key='brand_user'),
      'invited'
    )$$,
  '23514',
  'SaaS seat limit reached for this brand',
  'a direct membership cannot steal a seat already reserved for another invitation'
);

select lives_ok(
  format(
    'select public.release_brand_saas_seat(%L::uuid)',
    (select id::text from private.brand_seat_reservations where brand_id='00000000-0000-0000-0000-000000000101' and email='saas.reserved.one@test.local' order by created_at desc limit 1)
  ),
  'a failed external invitation can release only its own reservation'
);
select is(
  (select count(*) from private.brand_seat_reservations where brand_id='00000000-0000-0000-0000-000000000101' and expires_at > now()),
  0::bigint,
  'released reservations stop consuming capacity immediately'
);

select lives_ok(
  $$select public.reserve_brand_saas_seat(
    '00000000-0000-0000-0000-000000000101',
    'saas.reserved.one@test.local',
    (select id from public.roles where key='brand_user'),
    '00000000-0000-0000-0000-0000000000a1'
  )$$,
  'the freed seat can be reserved again for a retry'
);
select lives_ok(
  format(
    'select public.consume_brand_saas_seat(%L::uuid,%L::uuid)',
    (select id::text from private.brand_seat_reservations where brand_id='00000000-0000-0000-0000-000000000101' and email='saas.reserved.one@test.local' order by created_at desc limit 1),
    '00000000-0000-0000-0000-0000000000f1'
  ),
  'a successful Auth invitation atomically converts its reservation into a membership'
);
select is(
  (select count(*) from public.memberships where brand_id='00000000-0000-0000-0000-000000000101' and user_id='00000000-0000-0000-0000-0000000000f1' and status='invited'),
  1::bigint,
  'consuming the reservation creates the invited membership'
);
select is(
  (select count(*) from private.brand_seat_reservations where brand_id='00000000-0000-0000-0000-000000000101' and expires_at > now()),
  0::bigint,
  'the consumed reservation is removed in the same transaction'
);
select throws_ok(
  $$insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
    values(
      '00000000-0000-0000-0000-0000000000f2',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000101',
      (select id from public.roles where key='brand_user'),
      'invited'
    )$$,
  '23514',
  'SaaS seat limit reached for this brand',
  'the consumed seat remains protected after the reservation becomes a membership'
);

select * from finish();
rollback;
