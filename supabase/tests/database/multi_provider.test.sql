begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

select has_table('public','brand_field_providers','brand provider portfolio table exists');
select has_function(
  'public','save_brand_field_provider',
  array['uuid','uuid','text','text','text','field_provider_type','text[]','provider_contract_status','numeric','numeric','text','boolean','smallint','date','date','text'],
  'brand provider save RPC exists'
);
select has_function(
  'public','set_brand_field_provider_status',
  array['uuid','uuid','text'],
  'brand provider status RPC exists'
);
select has_function(
  'public','get_brand_field_provider_portfolio',
  array['uuid'],
  'brand provider portfolio RPC exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.save_brand_field_provider(
    '00000000-0000-0000-0000-000000000101',
    null,
    'Agence E2E Sud',
    'agence-e2e-sud@example.test',
    '0600000012',
    'agency'::public.field_provider_type,
    array['animation','training']::text[],
    'active'::public.provider_contract_status,
    420,
    260,
    'Forfait déplacement',
    true,
    10,
    '2026-01-01',
    '2026-12-31',
    'Prestataire de référence pour le Sud'
  )$$,
  'brand admin can add one provider to its brand portfolio'
);

select is(
  (select count(*) from public.brand_field_providers relation join public.field_providers provider on provider.id = relation.field_provider_id where relation.brand_id = '00000000-0000-0000-0000-000000000101' and provider.email = 'agence-e2e-sud@example.test'),
  1::bigint,
  'one brand-provider relation is created'
);

select is(
  (select relation.organization_id from public.brand_field_providers relation join public.field_providers provider on provider.id = relation.field_provider_id where provider.email = 'agence-e2e-sud@example.test'),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'relation organization is derived from the brand'
);

select ok(
  (select '00000000-0000-0000-0000-000000000101'::uuid = any(provider.brands_authorized) from public.field_providers provider where provider.email = 'agence-e2e-sud@example.test'),
  'legacy brand authorization remains synchronized'
);

select is(
  (select count(*) from public.field_providers where organization_id = '00000000-0000-0000-0000-000000000002' and email = 'agence-e2e-sud@example.test'),
  1::bigint,
  'one canonical provider identity exists per organization and email'
);

select lives_ok(
  $$select * from public.get_brand_field_provider_portfolio('00000000-0000-0000-0000-000000000101')$$,
  'brand admin can read its provider portfolio'
);

select is(
  (select count(*) from public.get_brand_field_provider_portfolio('00000000-0000-0000-0000-000000000101') where email = 'agence-e2e-sud@example.test'),
  1::bigint,
  'portfolio returns the newly linked provider'
);

select ok(
  (select preferred from public.get_brand_field_provider_portfolio('00000000-0000-0000-0000-000000000101') where email = 'agence-e2e-sud@example.test'),
  'brand-specific preferred flag is exposed'
);

select is(
  (select daily_rate_ht from public.get_brand_field_provider_portfolio('00000000-0000-0000-0000-000000000101') where email = 'agence-e2e-sud@example.test'),
  420::numeric,
  'brand-specific daily rate is exposed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_brand_field_provider(
    '00000000-0000-0000-0000-000000000101', null, 'Agent forbidden', 'agent-provider@example.test', null,
    'freelancer'::public.field_provider_type, array['animation']::text[], 'pending'::public.provider_contract_status,
    null, null, null, false, 100, null, null, null
  )$$,
  '42501',
  'Brand provider administration access is required',
  'agent cannot administer provider portfolio'
);

select throws_ok(
  $$select * from public.get_brand_field_provider_portfolio('00000000-0000-0000-0000-000000000101')$$,
  '42501',
  'Brand provider administration access is required',
  'agent cannot read provider commercial terms'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_brand_field_provider(
    '00000000-0000-0000-0000-000000000101', null, 'Other brand forbidden', 'other-brand@example.test', null,
    'agency'::public.field_provider_type, array['training']::text[], 'pending'::public.provider_contract_status,
    null, null, null, false, 100, null, null, null
  )$$,
  '42501',
  'Brand provider administration access is required',
  'administrator from another brand cannot mutate Dermavita providers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.set_brand_field_provider_status(
    '00000000-0000-0000-0000-000000000101',
    (select relation.id from public.brand_field_providers relation join public.field_providers provider on provider.id = relation.field_provider_id where provider.email = 'agence-e2e-sud@example.test'),
    'paused'
  )$$,
  'brand admin can pause a provider relation'
);

select is(
  (select relation.status from public.brand_field_providers relation join public.field_providers provider on provider.id = relation.field_provider_id where provider.email = 'agence-e2e-sud@example.test'),
  'paused',
  'provider relation is paused without deleting its identity'
);

select lives_ok(
  $$select public.set_brand_field_provider_status(
    '00000000-0000-0000-0000-000000000101',
    (select relation.id from public.brand_field_providers relation join public.field_providers provider on provider.id = relation.field_provider_id where provider.email = 'agence-e2e-sud@example.test'),
    'active'
  )$$,
  'brand admin can reactivate a provider relation'
);

select is(
  (select relation.status from public.brand_field_providers relation join public.field_providers provider on provider.id = relation.field_provider_id where provider.email = 'agence-e2e-sud@example.test'),
  'active',
  'provider relation returns active'
);

select lives_ok(
  $$select public.set_brand_field_provider_status(
    '00000000-0000-0000-0000-000000000101',
    (select relation.id from public.brand_field_providers relation join public.field_providers provider on provider.id = relation.field_provider_id where provider.email = 'agence-e2e-sud@example.test'),
    'archived'
  )$$,
  'brand admin can remove a provider from its portfolio'
);

select is(
  (select relation.status from public.brand_field_providers relation join public.field_providers provider on provider.id = relation.field_provider_id where provider.email = 'agence-e2e-sud@example.test'),
  'archived',
  'brand-provider relation is archived'
);

select ok(
  (select not ('00000000-0000-0000-0000-000000000101'::uuid = any(provider.brands_authorized)) from public.field_providers provider where provider.email = 'agence-e2e-sud@example.test'),
  'legacy brand authorization is removed when the relation is archived'
);

select is(
  (select count(*) from public.get_brand_field_provider_portfolio('00000000-0000-0000-0000-000000000101') where email = 'agence-e2e-sud@example.test'),
  0::bigint,
  'archived providers disappear from the active portfolio'
);

select * from finish();
rollback;
