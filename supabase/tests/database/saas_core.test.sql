begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

select has_table('public','saas_capabilities','SaaS capabilities catalog exists');
select has_table('public','saas_plans','SaaS plans catalog exists');
select has_table('public','brand_saas_entitlements','brand entitlements exist');
select has_table('public','brand_capability_overrides','brand overrides exist');
select has_table('public','brand_saas_settings','brand SaaS settings exist');
select is((select count(*) from public.saas_plans),4::bigint,'four foundation plans are seeded');
select ok((select count(*) from public.saas_capabilities) >= 25,'roadmap capabilities are seeded');
select is(
  (select plan.key from public.brand_saas_entitlements entitlement join public.saas_plans plan on plan.id=entitlement.plan_id where entitlement.brand_id='00000000-0000-0000-0000-000000000101'),
  'legacy_full',
  'existing/demo brands start in compatibility mode'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok(
  $$select public.set_brand_saas_plan('00000000-0000-0000-0000-000000000101','core','active',12)$$,
  'platform admin can assign a SaaS plan'
);
select is(
  (select plan.key from public.brand_saas_entitlements entitlement join public.saas_plans plan on plan.id=entitlement.plan_id where entitlement.brand_id='00000000-0000-0000-0000-000000000101'),
  'core',
  'explicit plan assignment replaces compatibility mode'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select ok(public.has_brand_capability('00000000-0000-0000-0000-000000000101','core_crm'),'agent receives a Core capability');
select ok(not public.has_brand_capability('00000000-0000-0000-0000-000000000101','sell_out'),'Core does not include sell-out');
select ok(not public.has_brand_capability('00000000-0000-0000-0000-000000000102','core_crm'),'cross-brand capability probing returns false');
select is((select count(*) from public.brand_saas_entitlements),1::bigint,'agent reads only its own brand entitlement');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select throws_ok(
  $$select public.set_brand_saas_plan('00000000-0000-0000-0000-000000000101','enterprise','active',null)$$,
  '42501',
  'Platform administrator access is required',
  'brand admin cannot upgrade its own SaaS plan'
);
select lives_ok(
  $$select public.update_brand_saas_settings('00000000-0000-0000-0000-000000000101','{"field_rep_singular":"Délégué pharmaceutique","field_rep_plural":"Délégués pharmaceutiques"}'::jsonb,'{"pilot_mode":true}'::jsonb)$$,
  'brand admin can customize brand terminology and configuration'
);
select is(
  (select terminology->>'field_rep_singular' from public.brand_saas_settings where brand_id='00000000-0000-0000-0000-000000000101'),
  'Délégué pharmaceutique',
  'custom terminology is persisted'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok(
  $$select public.set_brand_capability_override('00000000-0000-0000-0000-000000000101','sell_out',true,'Pilote terrain',null)$$,
  'platform admin can enable one capability outside the plan'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select ok(public.has_brand_capability('00000000-0000-0000-0000-000000000101','sell_out'),'live override wins over the plan');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok(
  $$select public.set_brand_saas_plan('00000000-0000-0000-0000-000000000101','enterprise','suspended',12)$$,
  'platform admin can suspend an entitlement'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select ok(not public.has_brand_capability('00000000-0000-0000-0000-000000000101','core_crm'),'suspension disables plan capabilities');
select ok(not public.has_brand_capability('00000000-0000-0000-0000-000000000101','sell_out'),'suspension also disables a positive override');
select is(
  (select count(*) from public.get_my_brand_capabilities('00000000-0000-0000-0000-000000000101')),
  (select count(*) from public.saas_capabilities where is_active),
  'capability API returns a complete explainable matrix for an accessible brand'
);

reset role;
select * from finish();
rollback;
