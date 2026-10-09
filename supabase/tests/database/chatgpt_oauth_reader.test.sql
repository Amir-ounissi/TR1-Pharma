BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(21);

SELECT ok(EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'tr1_chatgpt_reader'),
  'ChatGPT has an isolated PostgreSQL role');
SELECT ok(pg_has_role('authenticator','tr1_chatgpt_reader','MEMBER'),
  'PostgREST authenticator can assume the isolated role');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='private.tr1_chatgpt_oauth_clients'::regclass),
  'OAuth client registry has RLS');
SELECT is((SELECT count(*) FROM private.tr1_chatgpt_oauth_clients),0::bigint,
  'OAuth client registry starts empty');
SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader','public.orders','INSERT'),
  'MCP OAuth token cannot insert orders directly');
SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader','public.pharmacies','SELECT'),
  'MCP OAuth token cannot read pharmacy tables directly');
SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader','public.tasks','UPDATE'),
  'MCP OAuth token cannot change tasks');
SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader','storage.objects','INSERT'),
  'MCP OAuth token cannot upload storage objects');
SELECT ok(NOT has_function_privilege('tr1_chatgpt_reader',
  'public.create_assistant_draft(uuid,uuid,assistant_action_type,jsonb,numeric)','EXECUTE'),
  'MCP OAuth token cannot create assistant drafts');
SELECT is((
  SELECT count(*)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','storage') AND p.prosecdef AND p.provolatile='v'
    AND has_function_privilege('tr1_chatgpt_reader',p.oid,'EXECUTE')
),0::bigint,'MCP OAuth token cannot call any existing mutating SECURITY DEFINER RPC');
SELECT ok(NOT has_function_privilege('authenticated',
  'private.tr1_chatgpt_oauth_token_hook(jsonb)','EXECUTE'),
  'Browser sessions cannot invoke the OAuth signing hook');
SELECT ok(has_function_privilege('tr1_chatgpt_reader',
  'public.tr1_chatgpt_list_brands()','EXECUTE'),
  'Reader is allowed to list its authorized brands');
SELECT ok(has_function_privilege('tr1_chatgpt_reader',
  'public.tr1_chatgpt_search_pharmacies(uuid,text)','EXECUTE'),
  'Reader is allowed to search its authorized pharmacies');

SELECT ok(has_function_privilege('tr1_chatgpt_reader',
  'public.tr1_chatgpt_pharmacy_summary(uuid)','EXECUTE'),
  'Reader can retrieve only guarded, privacy-minimized commercial summaries');

SELECT throws_ok(
  $SELECT private.tr1_chatgpt_oauth_token_hook(
    '{"client_id":"22222222-2222-4222-8222-222222222222",
      "claims":{"role":"authenticated","aud":"authenticated"}}'::jsonb)$$,
  '42501', 'OAuth client not enabled for TR1',
  'Unknown OAuth client cannot receive a token');

INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'https://tr1.test/api/connectors/chatgpt/mcp', true
);
SELECT is(
  private.tr1_chatgpt_oauth_token_hook('{
    "client_id":"11111111-1111-4111-8111-111111111111",
    "claims":{"role":"authenticated","aud":"authenticated"}
  }'::jsonb)->'claims'->>'role',
  'tr1_chatgpt_reader',
  'Known OAuth client receives a restricted PostgreSQL role');
SELECT is(
  private.tr1_chatgpt_oauth_token_hook('{
    "client_id":"11111111-1111-4111-8111-111111111111",
    "claims":{"role":"authenticated","aud":"authenticated"}
  }'::jsonb)->'claims'->>'aud',
  'https://tr1.test/api/connectors/chatgpt/mcp',
  'Known OAuth client token is bound to the exact MCP resource');

SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2",
    "role":"tr1_chatgpt_reader",
    "aud":"https://tr1.test/api/connectors/chatgpt/mcp",
    "client_id":"11111111-1111-4111-8111-111111111111"}',true);

-- The MCP database role intentionally cannot USAGE the extensions schema,
-- so pgTAP assertions are performed after reverting the role.
DO $verify$
DECLARE
  brands jsonb;
  pharmacies jsonb;
  summary jsonb;
  foreign_brand_blocked boolean := false;
  direct_read_blocked boolean := false;
BEGIN
  brands := public.tr1_chatgpt_list_brands();
  IF jsonb_typeof(brands) <> 'array' OR jsonb_array_length(brands) < 1 THEN
    RAISE EXCEPTION 'Authorized brand discovery failed';
  END IF;

  pharmacies := public.tr1_chatgpt_search_pharmacies(
    '00000000-0000-0000-0000-000000000101','Pharmacie');
  IF jsonb_typeof(pharmacies) <> 'array' THEN
    RAISE EXCEPTION 'Authorized pharmacy lookup failed';
  END IF;
  -- The existing scoped summary RPC checks this user's active assignment.
  summary := public.tr1_chatgpt_pharmacy_summary(
    '00000000-0000-0000-0000-000000000411'::uuid);
  IF summary IS NULL OR jsonb_typeof(summary) <> 'object' THEN
    RAISE EXCEPTION 'Authorized summary not available';
  END IF;
  IF summary ? 'primary_contact' OR summary ? 'phone' THEN
    RAISE EXCEPTION 'Privacy breach: personal contact leaked';
  END IF;

  BEGIN
    PERFORM public.tr1_chatgpt_search_pharmacies(
      '00000000-0000-0000-0000-000000000102','Pharmacie');
  EXCEPTION WHEN insufficient_privilege THEN
    foreign_brand_blocked := true;
  END;
  IF NOT foreign_brand_blocked THEN RAISE EXCEPTION 'Cross-brand search succeeded'; END IF;

  BEGIN
    PERFORM 1 FROM public.pharmacies LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    direct_read_blocked := true;
  END;
  IF NOT direct_read_blocked THEN RAISE EXCEPTION 'Direct table read succeeded'; END IF;
END
$verify$;
RESET ROLE;

SELECT ok(true, 'Reader can call authorized-brand discovery with no table grant');
SELECT ok(true, 'Reader can search own brand without raw table access');
SELECT ok(true, 'Reader is rejected for other brands and direct table access');
SELECT ok(true, 'Pharmacy summary hides personal contacts under the read-only role');

SELECT * FROM finish();
ROLLBACK;
