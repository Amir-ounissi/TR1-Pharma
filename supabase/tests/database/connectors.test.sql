begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

select has_table('public','connector_connections','connector connections table exists');
select has_table('public','connector_entity_mappings','connector entity mappings table exists');
select has_table('public','connector_external_links','connector external links table exists');
select has_table('public','connector_sync_runs','connector sync runs table exists');

select has_function(
  'public','save_connector_connection',
  array['uuid','uuid','text','text','text','text','text','jsonb'],
  'connector save RPC exists'
);
select has_function(
  'public','set_connector_connection_status',
  array['uuid','text'],
  'connector status RPC exists'
);
select has_function(
  'public','save_connector_entity_mapping',
  array['uuid','uuid','import_entity_type','text','text','uuid','text','text','boolean'],
  'connector mapping RPC exists'
);
select has_function(
  'public','register_connector_sync_run',
  array['uuid','import_entity_type','text','text'],
  'trusted sync registration RPC exists'
);
select has_function(
  'public','complete_connector_sync_run',
  array['uuid','text','integer','integer','integer','text','text'],
  'trusted sync completion RPC exists'
);
select has_function(
  'public','upsert_connector_external_link',
  array['uuid','import_entity_type','text','uuid','timestamptz','timestamptz','text'],
  'trusted identity link RPC exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.save_connector_connection(
    '00000000-0000-0000-0000-000000000101',
    null,
    'hubspot',
    'HubSpot France',
    'portal-dermavita',
    'https://api.hubapi.com',
    'oauth://hubspot/dermavita',
    '{"pipeline":"pharmacy"}'::jsonb
  )$$,
  'brand admin can create a connector without storing credentials'
);

select is(
  (select credential_status from public.connector_connections where name = 'HubSpot France'),
  'configured',
  'an opaque credential reference marks the connection configured'
);

select is(
  (select organization_id from public.connector_connections where name = 'HubSpot France'),
  (select organization_id from public.brands where id = '00000000-0000-0000-0000-000000000101'),
  'connector organization is derived from its brand'
);

select throws_ok(
  $$select public.save_connector_connection(
    '00000000-0000-0000-0000-000000000101',
    null,
    'generic_api',
    'Unsafe secret JSON',
    null,
    'https://example.test',
    'secret://runtime/generic-api',
    '{"api_key":"should-never-be-stored"}'::jsonb
  )$$,
  '22023',
  'Connector configuration cannot contain credentials or secrets',
  'database rejects secret-bearing connector configuration'
);

select throws_ok(
  $$select public.save_connector_connection(
    '00000000-0000-0000-0000-000000000101',
    null,
    'generic_api',
    'Unsafe raw credential',
    null,
    'https://example.test',
    'sk-live-raw-secret-value',
    '{}'::jsonb
  )$$,
  '23514',
  'new row for relation "connector_connections" violates check constraint "connector_connections_credential_reference_scheme_check"',
  'database rejects raw credentials in the credential reference field'
);

select lives_ok(
  $$select public.set_connector_connection_status(
    (select id from public.connector_connections where name = 'HubSpot France'),
    'active'
  )$$,
  'configured connector can be activated'
);

select lives_ok(
  $$select public.save_connector_entity_mapping(
    (select id from public.connector_connections where name = 'HubSpot France'),
    null,
    'pharmacies'::public.import_entity_type,
    'companies',
    'inbound',
    null,
    'manual',
    'updatedAt',
    true
  )$$,
  'brand admin can configure a canonical entity mapping'
);

select is(
  (select brand_id from public.connector_entity_mappings where external_object = 'companies'),
  '00000000-0000-0000-0000-000000000101'::uuid,
  'mapping brand is derived from its connection'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_connector_connection(
    '00000000-0000-0000-0000-000000000101',
    null,
    'hubspot',
    'Agent forbidden',
    null,
    null,
    'oauth://hubspot/agent',
    '{}'::jsonb
  )$$,
  '42501',
  'Connector administration access is required',
  'agent cannot administer connectors'
);

select is(
  (select count(*) from public.connector_connections),
  0::bigint,
  'connector RLS hides administration data from agents'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.register_connector_sync_run(uuid,public.import_entity_type,text,text)',
    'EXECUTE'
  ),
  'authenticated role cannot register trusted sync runs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_connector_sync_run(uuid,text,integer,integer,integer,text,text)',
    'EXECUTE'
  ),
  'authenticated role cannot complete trusted sync runs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.upsert_connector_external_link(uuid,public.import_entity_type,text,uuid,timestamptz,timestamptz,text)',
    'EXECUTE'
  ),
  'authenticated role cannot mutate external identity links'
);

reset role;
set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"service_role"}',
  true
);

select lives_ok(
  $$select public.register_connector_sync_run(
    (select id from public.connector_connections where name = 'HubSpot France'),
    'pharmacies'::public.import_entity_type,
    'inbound',
    'cursor-001'
  )$$,
  'trusted backend can register a sync run'
);

select is(
  (select status from public.connector_sync_runs order by created_at desc limit 1),
  'running',
  'registered sync starts in running state'
);

select lives_ok(
  $$select public.complete_connector_sync_run(
    (select id from public.connector_sync_runs order by created_at desc limit 1),
    'succeeded',
    12,
    12,
    0,
    'cursor-002',
    null
  )$$,
  'trusted backend can complete a sync run'
);

select is(
  (select status from public.connector_sync_runs order by created_at desc limit 1),
  'succeeded',
  'completed sync keeps its terminal status'
);

select is(
  (select records_succeeded from public.connector_sync_runs order by created_at desc limit 1),
  12,
  'sync counters are persisted'
);

select ok(
  (select last_synced_at is not null from public.connector_connections where name = 'HubSpot France'),
  'successful sync updates the connection last synced timestamp'
);

select lives_ok(
  $$select public.upsert_connector_external_link(
    (select id from public.connector_connections where name = 'HubSpot France'),
    'pharmacies'::public.import_entity_type,
    'hs-company-42',
    '00000000-0000-0000-0000-000000000411',
    '2026-09-06T07:30:00Z'::timestamptz,
    '2026-09-06T07:31:00Z'::timestamptz,
    repeat('a',64)
  )$$,
  'trusted backend can persist an external to TR1 identity link'
);

select is(
  (select brand_id from public.connector_external_links where external_id = 'hs-company-42'),
  '00000000-0000-0000-0000-000000000101'::uuid,
  'external identity link inherits the connector tenant'
);

select is(
  (select tr1_record_id from public.connector_external_links where external_id = 'hs-company-42'),
  '00000000-0000-0000-0000-000000000411'::uuid,
  'external identity link targets the expected canonical TR1 record'
);

select * from finish();
rollback;
