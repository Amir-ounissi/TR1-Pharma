begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

select has_column(
  'public',
  'territories',
  'department_codes',
  'territories support multiple departments'
);

select is(
  private.department_code_from_postal_code('13008'),
  '13',
  'metropolitan postal code resolves to its department'
);

select is(
  private.department_code_from_postal_code('97110'),
  '971',
  'overseas postal code resolves to a three digit department'
);

select is(
  private.department_code_from_postal_code('20100'),
  '2A',
  'southern Corsica postal code resolves to 2A'
);

select is(
  private.department_code_from_postal_code('20200'),
  '2B',
  'northern Corsica postal code resolves to 2B'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000f8',
  'authenticated',
  'authenticated',
  'department.agent@test.local',
  '',
  now(),
  '{}',
  '{"full_name":"Agent Départements","requested_profile_type":"agent","requested_access":{"type":"agent"}}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000f9',
  'authenticated',
  'authenticated',
  'department.overlap@test.local',
  '',
  now(),
  '{}',
  '{"full_name":"Agent Chevauchement","requested_profile_type":"agent","requested_access":{"type":"agent"}}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

insert into public.pharmacies (
  id,
  legal_name,
  trade_name,
  postal_code,
  city,
  created_by
)
values
(
  '00000000-0000-0000-0000-000000000fa1',
  'Pharmacie Gard Test',
  'Pharmacie Gard Test',
  '30000',
  'Nîmes',
  '00000000-0000-0000-0000-0000000000a1'
),
(
  '00000000-0000-0000-0000-000000000fa2',
  'Pharmacie Hérault Test',
  'Pharmacie Hérault Test',
  '34000',
  'Montpellier',
  '00000000-0000-0000-0000-0000000000a1'
);

insert into public.brand_pharmacies (
  id,
  brand_id,
  pharmacy_id,
  source,
  created_by
)
values
(
  '00000000-0000-0000-0000-000000000fb1',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000fa1',
  'import',
  '00000000-0000-0000-0000-0000000000a1'
),
(
  '00000000-0000-0000-0000-000000000fb2',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000fa2',
  'import',
  '00000000-0000-0000-0000-0000000000a1'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.approve_access_request_with_departments(
    (select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f8'),
    '00000000-0000-0000-0000-000000000101',
    array['30','34'],
    'Secteur Gard Hérault validé'
  )$$,
  'super admin approves an agent from explicit departments'
);

select is(
  (
    select territory.department_codes
    from public.memberships membership
    join public.territories territory
      on territory.id = membership.territory_id
    where membership.user_id = '00000000-0000-0000-0000-0000000000f8'
      and membership.status = 'active'
  ),
  array['30','34']::text[],
  'agent territory stores every selected department'
);

select is(
  (
    select count(*)
    from public.brand_pharmacies pharmacy
    where pharmacy.id in (
      '00000000-0000-0000-0000-000000000fb1',
      '00000000-0000-0000-0000-000000000fb2'
    )
      and pharmacy.current_agent_user_id =
        '00000000-0000-0000-0000-0000000000f8'
      and pharmacy.territory_id = (
        select membership.territory_id
        from public.memberships membership
        where membership.user_id =
          '00000000-0000-0000-0000-0000000000f8'
          and membership.status = 'active'
      )
  ),
  2::bigint,
  'existing pharmacies in selected departments enter the agent portfolio'
);

select is(
  (
    select count(*)
    from public.pharmacy_assignments assignment
    where assignment.user_id =
      '00000000-0000-0000-0000-0000000000f8'
      and assignment.is_primary
      and assignment.ends_at is null
      and assignment.archived_at is null
      and assignment.brand_pharmacy_id in (
        '00000000-0000-0000-0000-000000000fb1',
        '00000000-0000-0000-0000-000000000fb2'
      )
  ),
  2::bigint,
  'existing pharmacies receive primary commercial assignments'
);

insert into public.pharmacies (
  id,
  legal_name,
  trade_name,
  postal_code,
  city,
  created_by
)
values (
  '00000000-0000-0000-0000-000000000fa3',
  'Pharmacie Future Hérault',
  'Pharmacie Future Hérault',
  '34070',
  'Montpellier',
  '00000000-0000-0000-0000-0000000000a1'
);

insert into public.brand_pharmacies (
  id,
  brand_id,
  pharmacy_id,
  source,
  created_by
)
values (
  '00000000-0000-0000-0000-000000000fb3',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000fa3',
  'import',
  '00000000-0000-0000-0000-0000000000a1'
);

select is(
  (
    select territory_id
    from public.brand_pharmacies
    where id = '00000000-0000-0000-0000-000000000fb3'
  ),
  (
    select territory_id
    from public.memberships
    where user_id = '00000000-0000-0000-0000-0000000000f8'
      and status = 'active'
  ),
  'future pharmacy automatically inherits the matching agent territory'
);

select is(
  (
    select current_agent_user_id
    from public.brand_pharmacies
    where id = '00000000-0000-0000-0000-000000000fb3'
  ),
  '00000000-0000-0000-0000-0000000000f8'::uuid,
  'future pharmacy automatically inherits the territory agent'
);

select is(
  (
    select count(*)
    from public.pharmacy_assignments
    where brand_pharmacy_id =
      '00000000-0000-0000-0000-000000000fb3'
      and user_id =
        '00000000-0000-0000-0000-0000000000f8'
      and is_primary
      and ends_at is null
      and archived_at is null
  ),
  1::bigint,
  'future pharmacy receives one primary assignment'
);

select throws_ok(
  $$select public.approve_access_request_with_departments(
    (select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f9'),
    '00000000-0000-0000-0000-000000000101',
    array['99'],
    null
  )$$,
  '22023',
  'Invalid French department code',
  'invalid department codes are rejected'
);

select throws_ok(
  $$select public.approve_access_request_with_departments(
    (select id from public.access_requests where user_id = '00000000-0000-0000-0000-0000000000f9'),
    '00000000-0000-0000-0000-000000000101',
    array['34'],
    null
  )$$,
  '23514',
  'One or more departments are already covered by an active agent',
  'another primary agent cannot claim an already covered department'
);

select is(
  (
    select count(*)
    from public.memberships
    where user_id = '00000000-0000-0000-0000-0000000000f9'
  ),
  0::bigint,
  'failed overlap approval creates no membership'
);

select * from finish();

rollback;
