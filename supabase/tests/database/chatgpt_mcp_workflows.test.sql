-- Positive and negative OAuth integration scenarios, entirely rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(8);

INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled)
VALUES ('00000000-0000-0000-0000-00000000caae',
  'https://test.tr1.invalid/api/connectors/chatgpt/mcp', true);

SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000caae","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}', true);

DO $verify$
DECLARE
  first_order jsonb;
  replay_order jsonb;
  first_visit uuid;
  replay_visit uuid;
  denied boolean;
BEGIN
  first_order := public.tr1_chatgpt_create_order_draft(
    '00000000-0000-0000-0000-000000000411',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":2}]'::jsonb,
    'reorder','QA draft','00000000-0000-0000-0000-00000000ca01',true
  );
  IF first_order->>'status' IS DISTINCT FROM 'draft'
     OR first_order->>'transmitted' IS DISTINCT FROM 'false'
     OR first_order->>'created' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'First write did not produce an unsent draft';
  END IF;
  replay_order := public.tr1_chatgpt_create_order_draft(
    '00000000-0000-0000-0000-000000000411',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":2}]'::jsonb,
    'reorder','QA draft','00000000-0000-0000-0000-00000000ca01',true
  );
  IF replay_order->>'order_id' IS DISTINCT FROM first_order->>'order_id'
     OR replay_order->>'created' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'Replay created a duplicate order';
  END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_order_draft(
      '00000000-0000-0000-0000-000000000411',
      '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":4}]'::jsonb,
      'reorder','Modified retry','00000000-0000-0000-0000-00000000ca01',true
    );
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Changed order replay not rejected'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_order_draft(
      '00000000-0000-0000-0000-000000000413',
      '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":2}]'::jsonb,
      'reorder','','00000000-0000-0000-0000-00000000ca02',true
    );
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unassigned pharmacy order accepted'; END IF;

  first_visit := public.tr1_chatgpt_create_planned_visit(
    '00000000-0000-0000-0000-000000000401',
    ARRAY['00000000-0000-0000-0000-000000000411']::uuid[],
    'client_visit','RDV ChatGPT QA','suivi',
    now()+interval '7 days', now()+interval '7 days 45 minutes',true
  );
  replay_visit := public.tr1_chatgpt_create_planned_visit(
    '00000000-0000-0000-0000-000000000401',
    ARRAY['00000000-0000-0000-0000-000000000411']::uuid[],
    'client_visit','RDV ChatGPT QA','suivi',
    now()+interval '7 days', now()+interval '7 days 45 minutes',true
  );
  IF replay_visit IS DISTINCT FROM first_visit THEN
    RAISE EXCEPTION 'Visit replay created a duplicate';
  END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_planned_visit(
      '00000000-0000-0000-0000-000000000401',
      ARRAY['00000000-0000-0000-0000-000000000411']::uuid[],
      'client_visit','Conflicting appointment','suivi',
      now()+interval '7 days 15 minutes',now()+interval '7 days 50 minutes',true
    );
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Overlapping visit accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_planned_visit(
      '00000000-0000-0000-0000-000000000403',
      ARRAY['00000000-0000-0000-0000-000000000413']::uuid[],
      'client_visit','Out-of-scope visit','suivi',
      now()+interval '8 days',now()+interval '8 days 1 hour',true
    );
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Foreign pharmacy visit accepted'; END IF;
END;
$verify$;
RESET ROLE;

SELECT is((SELECT count(*) FROM public.orders
  WHERE external_order_id='chatgpt:00000000-0000-0000-0000-00000000ca01'), 1::bigint,
  'One saved order only');
SELECT is((SELECT count(*) FROM public.orders
  WHERE external_order_id='chatgpt:00000000-0000-0000-0000-00000000ca01'
    AND order_status='draft'), 1::bigint, 'Order remains draft');
SELECT is((SELECT count(*) FROM public.order_items oi
  JOIN public.orders o ON o.id=oi.order_id
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000ca01'
    AND oi.quantity=2 AND oi.unit_price_ht=18.50), 1::bigint,
  'Draft line uses trusted catalog price and requested quantity');
SELECT is((SELECT count(*) FROM public.field_visits
  WHERE title='RDV ChatGPT QA'), 1::bigint, 'Visit replay is idempotent');
SELECT is((SELECT count(*) FROM public.orders
  WHERE external_order_id='chatgpt:00000000-0000-0000-0000-00000000ca02'), 0::bigint,
  'Foreign pharmacy order was not saved');
SELECT is((SELECT count(*) FROM public.field_visits
  WHERE title='Conflicting appointment'), 0::bigint, 'Visit conflict did not persist');
SELECT is((SELECT count(*) FROM public.field_visits
  WHERE title='Out-of-scope visit'), 0::bigint, 'Foreign visit did not persist');
SELECT is((SELECT count(*) FROM public.order_items oi
  JOIN public.orders o ON o.id=oi.order_id
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000ca01'
    AND oi.free_quantity=0), 1::bigint, 'No UG silently granted');

SELECT * FROM finish();
ROLLBACK;
