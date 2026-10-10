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

-- The reader is not allowed USAGE on extensions.pgtap. Execute actual security
-- assertions as the restricted role and only report pgTAP after RESET ROLE.
DO $verify$
DECLARE
  result jsonb;
  denied boolean := false;
BEGIN
  result := public.tr1_chatgpt_catalog('00000000-0000-0000-0000-000000000101', null);
  IF jsonb_typeof(result) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Authorized brand catalog failed';
  END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_catalog('00000000-0000-0000-0000-000000000999', null);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-brand catalog exposed'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_agenda(current_date,current_date+40);
  EXCEPTION WHEN invalid_parameter_value THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Oversized agenda allowed'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_order_draft(
      '00000000-0000-0000-0000-00000000caba',
      '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1}]'::jsonb,
      'reorder','', '00000000-0000-0000-0000-00000000cabb',false
    );
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unconfirmed order draft created'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_planned_visit(
      '00000000-0000-0000-0000-00000000caba',
      ARRAY['00000000-0000-0000-0000-00000000cabb']::uuid[],
      'client_visit','Test visite','',
      now()+interval '2 days',now()+interval '2 days 1 hour',false
    );
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unconfirmed visit created'; END IF;

  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000cccc","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}', true);
  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_catalog('00000000-0000-0000-0000-000000000101', null);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unknown OAuth client accepted'; END IF;
END;
$verify$;
RESET ROLE;

SELECT ok(true,'Enabled OAuth client reads its own brand catalog');
SELECT ok(true,'Cross-brand catalog reads are forbidden');
SELECT ok(true,'Oversized agenda windows are forbidden');
SELECT ok(true,'Unconfirmed order drafts are forbidden');
SELECT ok(true,'Unconfirmed visits are forbidden');
SELECT ok(true,'Unknown OAuth clients are forbidden');

SELECT * FROM finish();
ROLLBACK;
