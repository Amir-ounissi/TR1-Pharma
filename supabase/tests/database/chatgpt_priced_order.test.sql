-- Scoped priced order preview and draft, rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(9);

INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled)
VALUES ('00000000-0000-0000-0000-00000000cab0',
        'https://test.tr1.invalid/api/connectors/chatgpt/mcp',true);

-- Simulate trusted server-side commercial overrides and catalog source of truth.
INSERT INTO public.brand_pharmacy_commercial_terms
  (brand_pharmacy_id,brand_id,discount_rate,ug_paid_quantity,ug_free_quantity)
VALUES
  ('00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000101',35,12,2)
ON CONFLICT (brand_pharmacy_id) DO UPDATE
SET discount_rate=35,ug_paid_quantity=12,ug_free_quantity=2;

SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader','public.order_items','UPDATE'),
  'OAuth role cannot directly edit order lines');
SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader','public.brand_pharmacy_commercial_terms','UPDATE'),
  'OAuth role cannot change trusted terms');

SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000cab0","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}',true);

DO $verify$
DECLARE
  p jsonb;
  created jsonb;
  replay jsonb;
  denied boolean;
BEGIN
  p := public.tr1_chatgpt_priced_order_preview(
    '00000000-0000-0000-0000-000000000411',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12}]'::jsonb);
  IF (p->>'total_ht')::numeric <> 144.30 OR (p->'items'->0->>'free_quantity')::integer <> 2
     OR (p->'items'->0->>'discount_rate')::numeric <> 35
     OR (p->'items'->0->>'unit_price_ht')::numeric <> 18.50 THEN
    RAISE EXCEPTION 'Trusted pricing calculation incorrect: %', p;
  END IF;
  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_priced_order_preview(
      '00000000-0000-0000-0000-000000000411',
      '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12,"discount_rate":100}]'::jsonb);
  EXCEPTION WHEN others THEN denied := true;
  END;
  -- API schema rejects pricing injection; RPC itself ignores extra fields and
  -- re-derives commercial data from protected catalog/terms.
  IF denied THEN RAISE EXCEPTION 'RPC preview should ignore untrusted pricing metadata'; END IF;
  created := public.tr1_chatgpt_create_priced_order_draft(
    '00000000-0000-0000-0000-000000000411',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12}]'::jsonb,
    'reorder','00000000-0000-0000-0000-00000000cab1',true);
  IF created->>'status' <> 'draft' OR created->>'transmitted' <> 'false'
     OR created->>'pricing_applied' <> 'true' THEN
    RAISE EXCEPTION 'Priced order draft status incorrect: %',created;
  END IF;
  replay := public.tr1_chatgpt_create_priced_order_draft(
    '00000000-0000-0000-0000-000000000411',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12}]'::jsonb,
    'reorder','00000000-0000-0000-0000-00000000cab1',true);
  IF replay->>'order_id' IS DISTINCT FROM created->>'order_id'
     OR replay->>'created' <> 'false' THEN
    RAISE EXCEPTION 'Priced retry not idempotent';
  END IF;
  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_priced_order_preview(
      '00000000-0000-0000-0000-000000000413',
      '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12}]'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unassigned pharmacy preview allowed'; END IF;
END;
$verify$;
RESET ROLE;
SELECT is((SELECT count(*) FROM public.orders WHERE external_order_id=
  'chatgpt:00000000-0000-0000-0000-00000000cab1'),1::bigint,
  'Priced draft persists once');
SELECT is((SELECT count(*) FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cab1'
  AND oi.quantity=12 AND oi.free_quantity=2 AND oi.discount_rate=35
  AND oi.unit_price_ht=18.50 AND oi.discount_amount_ht=77.70),1::bigint,
  'Priced draft stores discount/free units as structured fields');
SELECT is((SELECT count(*) FROM public.orders WHERE external_order_id=
  'chatgpt:00000000-0000-0000-0000-00000000cab1' AND order_status='draft'),1::bigint,
  'Priced draft not transmitted');
SELECT is((SELECT count(*) FROM public.orders WHERE external_order_id=
  'chatgpt:00000000-0000-0000-0000-00000000cab1' AND notes IS NULL),1::bigint,
  'No commercial conditions are stored in notes');
SELECT is((SELECT count(*) FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cab1'
    AND oi.discount_rate=100),0::bigint,
  'No client-supplied discount overrides');
SELECT is((SELECT count(*) FROM public.orders o
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cab1'
    AND o.created_by='00000000-0000-0000-0000-0000000000a3'),1::bigint,
  'Priced draft assigned to authenticated user');
SELECT is((SELECT count(*) FROM public.orders o
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cab1'
    AND o.source='manual'),1::bigint,
  'Priced draft has clear provenance');
SELECT * FROM finish();
ROLLBACK;
