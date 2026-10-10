BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

SELECT ok(
  NOT has_table_privilege('tr1_chatgpt_reader','public.orders','INSERT'),
  'OAuth role has no direct order INSERT'
);
SELECT ok(
  NOT has_table_privilege('tr1_chatgpt_reader','public.field_visits','INSERT'),
  'OAuth role has no direct visit INSERT'
);
SELECT ok(
  NOT has_function_privilege('anon','public.tr1_chatgpt_create_order_draft(uuid,jsonb,text,text,uuid,boolean)','EXECUTE'),
  'Anonymous users cannot execute ChatGPT order writes'
);
SELECT ok(
  NOT has_function_privilege('authenticated','public.tr1_chatgpt_create_planned_visit(uuid,uuid[],text,text,text,timestamptz,timestamptz,boolean)','EXECUTE'),
  'Normal signed-in TR1 sessions cannot execute ChatGPT visit writes'
);

-- Entire registry change is in this transaction and is rolled back.
INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled)
VALUES (
  '00000000-0000-0000-0000-00000000caaa',
  'https://test.tr1.invalid/api/connectors/chatgpt/mcp', true
) ON CONFLICT(client_id) DO UPDATE SET enabled=EXCLUDED.enabled;

SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000caaa","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}', true);

SELECT lives_ok(
  $$SELECT public.tr1_chatgpt_catalog('00000000-0000-0000-0000-000000000101', null)$$,
  'Enabled OAuth client can read authorized brand catalog'
);
SELECT throws_ok(
  $$SELECT public.tr1_chatgpt_catalog('00000000-0000-0000-0000-000000000999', null)$$,
  '42501', 'Brand forbidden', 'Cross-brand catalog reading rejected'
);
SELECT throws_ok(
  $$SELECT public.tr1_chatgpt_agenda(current_date,current_date+40)$$,
  '22023', 'Agenda range must be 1 to 15 calendar days',
  'Oversized agenda period rejected'
);
SELECT throws_ok(
  $$SELECT public.tr1_chatgpt_create_order_draft(
    '00000000-0000-0000-0000-00000000caba',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1}]'::jsonb,
    'reorder','', '00000000-0000-0000-0000-00000000cabb',false
  )$$,
  '42501', 'Explicit confirmation required',
  'An unconfirmed order draft cannot write'
);
SELECT throws_ok(
  $$SELECT public.tr1_chatgpt_create_planned_visit(
    '00000000-0000-0000-0000-00000000caba',
    ARRAY['00000000-0000-0000-0000-00000000cabb']::uuid[],
    'client_visit','Test visite','',
    now()+interval '2 days',now()+interval '2 days 1 hour',false
  )$$,
  '42501', 'Explicit confirmation required',
  'An unconfirmed visit cannot write'
);

SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000cccc","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}', true);
SELECT throws_ok(
  $$SELECT public.tr1_chatgpt_catalog('00000000-0000-0000-0000-000000000101', null)$$,
  '42501', 'ChatGPT OAuth authorization required',
  'Unregistered OAuth clients cannot read'
);

SELECT * FROM finish();
ROLLBACK;
