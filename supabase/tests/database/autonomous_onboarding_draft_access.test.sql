begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select has_function('private','can_read_self_service_setup',array['uuid'],'draft brand setup access helper exists');
select has_function('private','can_read_self_service_organization',array['uuid'],'draft organization setup access helper exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-0000000000c1',
  'authenticated',
  'authenticated',
  'draft-owner@tr1.test',
  extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Owner Brouillon","requested_profile_type":"brand","requested_access":{"type":"brand","company_name":"Draft Lab","job_title":"Direction"}}',
  now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-0000000000c2',
  'authenticated',
  'authenticated',
  'other-user@tr1.test',
  extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Autre Utilisateur"}',
  now(), now(), '', '', '', ''
);

update public.user_profiles
set onboarding_completed_at = now()
where user_id = '00000000-0000-4000-8000-0000000000c1';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}',true);

select lives_ok(
  $$select * from public.start_self_service_onboarding(
    '{"legal_name":"Draft Lab SAS","trade_name":"Draft Lab","country_code":"FR","currency_code":"EUR","timezone":"Europe/Paris","locale":"fr-FR"}'::jsonb,
    '{"name":"Draft Santé","code":"DRAFT_SANTE","country_code":"FR","currency_code":"EUR"}'::jsonb,
    'growth'
  )$$,
  'owner can create a draft tenant'
);

select is(
  (select count(*) from public.brands
   where id = (select brand_id from public.get_my_self_service_onboarding() limit 1)),
  1::bigint,
  'owner can read the draft brand needed by setup'
);

select is(
  (select count(*) from public.organizations
   where id = (select organization_id from public.get_my_self_service_onboarding() limit 1)),
  1::bigint,
  'owner can read the draft organization needed by setup'
);

select is(
  (select count(*) from public.brand_settings
   where brand_id = (select brand_id from public.get_my_self_service_onboarding() limit 1)),
  1::bigint,
  'owner can read the guaranteed brand settings row needed by setup'
);

reset role;
create temporary table self_service_scope(brand_id uuid, organization_id uuid) on commit drop;
insert into self_service_scope(brand_id, organization_id)
select brand_id, organization_id
from public.brand_onboarding_sessions
where owner_user_id = '00000000-0000-4000-8000-0000000000c1';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}',true);

select is(
  (select count(*) from public.brands where id = (select brand_id from self_service_scope)),
  0::bigint,
  'another authenticated user cannot read the draft brand'
);

select ok(
  (select count(*) from public.organizations where id = (select organization_id from self_service_scope)) = 0
  and (select count(*) from public.brand_settings where brand_id = (select brand_id from self_service_scope)) = 0,
  'another authenticated user cannot read draft organization or settings'
);

reset role;
select * from finish();
rollback;
