begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

select has_table('public','data_mapping_profiles','mapping profiles table exists');
select has_function('public','save_data_mapping_profile',array['uuid','uuid','text','import_entity_type','text','jsonb','jsonb','boolean'],'mapping profile save RPC exists');
select has_function('public','archive_data_mapping_profile',array['uuid','uuid'],'mapping profile archive RPC exists');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);

select lives_ok(
  $$select public.save_data_mapping_profile(
    '00000000-0000-0000-0000-000000000101',
    null,
    'HubSpot pharmacies',
    'pharmacies'::public.import_entity_type,
    'hubspot',
    '{"Nom officine":"legal_name","CP":"postal_code","Ville":"city"}'::jsonb,
    '{}'::jsonb,
    true
  )$$,
  'brand admin can create a mapping profile'
);

select is(
  (select count(*) from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000101'),
  1::bigint,
  'profile is stored in the active tenant'
);
select is(
  (select organization_id from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000101' limit 1),
  (select organization_id from public.brands where id='00000000-0000-0000-0000-000000000101'),
  'organization is derived from the brand'
);
select is(
  (select version from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000101' limit 1),
  1,
  'new profile starts at version one'
);
select ok(
  (select is_default from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000101' limit 1),
  'profile can be the default for its entity type'
);

select lives_ok(
  $$select public.save_data_mapping_profile(
    '00000000-0000-0000-0000-000000000101',
    (select id from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000101' limit 1),
    'HubSpot pharmacies',
    'pharmacies'::public.import_entity_type,
    'hubspot',
    '{"Nom officine":"legal_name","CP":"postal_code","Ville":"city","CIP":"cip_code"}'::jsonb,
    '{}'::jsonb,
    true
  )$$,
  'brand admin can update an existing profile'
);
select is(
  (select version from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000101' limit 1),
  2,
  'mapping changes increment the profile version'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select throws_ok(
  $$select public.save_data_mapping_profile(
    '00000000-0000-0000-0000-000000000101',null,'Agent override','products'::public.import_entity_type,'csv',
    '{"Produit":"name","ACL":"sku"}'::jsonb,'{}'::jsonb,false
  )$$,
  '42501',
  'Brand administration access is required',
  'agent cannot create mapping profiles'
);
select is(
  (select count(*) from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000102'),
  0::bigint,
  'agent cannot read mapping profiles from another brand'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select lives_ok(
  $$select public.archive_data_mapping_profile(
    '00000000-0000-0000-0000-000000000101',
    (select id from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000101' limit 1)
  )$$,
  'brand admin can archive its mapping profile'
);
select is(
  (select count(*) from public.data_mapping_profiles where brand_id='00000000-0000-0000-0000-000000000101' and is_active),
  0::bigint,
  'archived mapping profile is no longer active'
);

reset role;
select * from finish();
rollback;