begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

select has_column('public','access_requests','review_source','access requests record their review source');
select has_column('public','brand_onboarding_sessions','onboarding_mode','onboarding sessions record their mode');
select has_function('public','start_self_service_onboarding',array['jsonb','jsonb','text'],'self-service onboarding start RPC exists');
select has_function('public','mark_self_service_onboarding_step',array['uuid','text','text'],'self-service onboarding step RPC exists');
select has_function('public','activate_self_service_brand',array['uuid'],'self-service activation RPC exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000b1',
  'authenticated',
  'authenticated',
  'selfservice@tr1.test',
  extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Alice Autonome","requested_profile_type":"brand","requested_access":{"type":"brand","company_name":"Autolab","job_title":"Directrice commerciale"}}',
  now(), now(), '', '', '', ''
);

update public.user_profiles
set onboarding_completed_at = now()
where user_id = '00000000-0000-0000-0000-0000000000b1';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',true);

select lives_ok(
  $$select * from public.start_self_service_onboarding(
    '{"legal_name":"Autolab SAS","trade_name":"Autolab","country_code":"FR","currency_code":"EUR","timezone":"Europe/Paris","locale":"fr-FR"}'::jsonb,
    '{"name":"Autolab Santé","code":"AUTOLAB","country_code":"FR","currency_code":"EUR"}'::jsonb,
    'growth'
  )$$,
  'confirmed brand signup can start autonomous onboarding'
);

select is(
  (select count(*) from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1' and onboarding_mode='self_service'),
  1::bigint,
  'one self-service onboarding session is created'
);

select is(
  (select count(*) from public.memberships membership join public.roles role on role.id=membership.role_id
   where membership.user_id='00000000-0000-0000-0000-0000000000b1'
     and membership.brand_id=(select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1')
     and membership.status='active' and role.key='brand_admin'),
  1::bigint,
  'workspace owner receives only a brand admin membership on the draft tenant'
);

select is(
  (select plan.key from public.brand_saas_entitlements entitlement
   join public.saas_plans plan on plan.id=entitlement.plan_id
   where entitlement.brand_id=(select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1')),
  'growth',
  'selected public plan is assigned'
);

select is(
  (select entitlement.status from public.brand_saas_entitlements entitlement
   where entitlement.brand_id=(select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1')),
  'trialing',
  'self-service plan starts in trialing state'
);

select is(
  (select status::text from public.access_requests where user_id='00000000-0000-0000-0000-0000000000b1'),
  'approved',
  'brand access request is resolved by the self-service flow'
);

select is(
  (select review_source from public.access_requests where user_id='00000000-0000-0000-0000-0000000000b1'),
  'self_service',
  'access request records self-service approval source'
);

select lives_ok(
  $$select * from public.start_self_service_onboarding(
    '{"legal_name":"Autolab SAS","trade_name":"Autolab"}'::jsonb,
    '{"name":"Autolab Santé","code":"AUTOLAB"}'::jsonb,
    'growth'
  )$$,
  'starting again resumes the existing active onboarding instead of duplicating it'
);

select is(
  (select count(*) from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
  1::bigint,
  'resume remains idempotent'
);

select throws_ok(
  $$select public.activate_self_service_brand(
    (select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1')
  )$$,
  '23514',
  'Brand activation blocked: 3 required checks missing',
  'activation is blocked until the standard required checklist is complete'
);

select lives_ok(
  $$select public.mark_self_service_onboarding_step(
    (select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
    'users',
    'skipped'
  )$$,
  'optional team step can be skipped explicitly'
);

select is(
  (select step_statuses->>'users' from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
  'skipped',
  'skipped team step is persisted'
);

reset role;

insert into public.products(brand_id,name,sku,is_active)
values(
  (select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
  'Produit autonome',
  'AUTO-001',
  true
);

insert into public.brand_pharmacies(brand_id,pharmacy_id,source,created_by)
values(
  (select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
  '00000000-0000-0000-0000-000000000401',
  'import',
  '00000000-0000-0000-0000-0000000000b1'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',true);

select lives_ok(
  $$select public.update_onboarding_settings(
    (select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
    '{}'::jsonb
  )$$,
  'workspace owner can validate the standard business settings'
);

select lives_ok(
  $$select public.activate_self_service_brand(
    (select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1')
  )$$,
  'workspace owner can activate after all blocking checks pass'
);

select ok(
  (select is_active and status='active' from public.brands
   where id=(select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1')),
  'brand becomes active'
);

select is(
  (select entitlement.status from public.brand_saas_entitlements entitlement
   where entitlement.brand_id=(select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1')),
  'active',
  'SaaS entitlement becomes active with the workspace'
);

select is(
  (select status from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
  'completed',
  'self-service onboarding session is completed'
);

select ok(
  exists(
    select 1 from public.get_my_brand_contexts() context
    where context.brand_id=(select brand_id from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1')
  ),
  'activated workspace enters the normal brand selector'
);

select is(
  (select current_step from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
  'activation',
  'completed onboarding ends on activation step'
);

select is(
  (select step_statuses->>'activation' from public.brand_onboarding_sessions where owner_user_id='00000000-0000-0000-0000-0000000000b1'),
  'completed',
  'activation step is recorded as completed'
);

reset role;
select * from finish();
rollback;
