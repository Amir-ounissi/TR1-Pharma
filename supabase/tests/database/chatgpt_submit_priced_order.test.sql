-- Real MCP order confirmation: structured prices, EAN and idempotence, fully rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(8);
INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled)
VALUES ('00000000-0000-0000-0000-00000000cac0',
  'https://test.tr1.invalid/api/connectors/chatgpt/mcp',true);
INSERT INTO public.brand_pharmacy_commercial_terms
 (brand_pharmacy_id,brand_id,discount_rate,ug_paid_quantity,ug_free_quantity)
VALUES ('00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000101',35,12,2)
ON CONFLICT (brand_pharmacy_id) DO UPDATE
SET discount_rate=35,ug_paid_quantity=12,ug_free_quantity=2;
SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000cac0","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}',true);
DO $verify$
DECLARE
  order_result jsonb;
  replay jsonb;
  payload jsonb := '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12,"source_ean":"3400000000001"}]'::jsonb;
  denied boolean;
BEGIN
  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_submit_priced_order(
      '00000000-0000-0000-0000-000000000411',payload,'MCP-REAL-001',
      '00000000-0000-0000-0000-00000000cac1',144.30,false);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unconfirmed real order accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_submit_priced_order(
      '00000000-0000-0000-0000-000000000411',
      '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12,"source_ean":"3400000000002"}]'::jsonb,
      'MCP-REAL-001','00000000-0000-0000-0000-00000000cac1',144.30,true);
  EXCEPTION WHEN invalid_parameter_value THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Wrong EAN accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_submit_priced_order(
      '00000000-0000-0000-0000-000000000411',payload,'MCP-REAL-001',
      '00000000-0000-0000-0000-00000000cac1',222.00,true);
  EXCEPTION WHEN invalid_parameter_value THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Outdated reviewed total accepted'; END IF;

  order_result := public.tr1_chatgpt_submit_priced_order(
      '00000000-0000-0000-0000-000000000411',payload,'MCP-REAL-001',
      '00000000-0000-0000-0000-00000000cac1',144.30,true);
  IF order_result->>'created' <> 'true' OR order_result->>'status' <> 'pending'
     OR order_result->>'hubspot_sync_required' <> 'true' THEN
    RAISE EXCEPTION 'Real order not persisted in pending status: %',order_result;
  END IF;

  replay := public.tr1_chatgpt_submit_priced_order(
      '00000000-0000-0000-0000-000000000411',payload,'MCP-REAL-001',
      '00000000-0000-0000-0000-00000000cac1',144.30,true);
  IF replay->>'order_id' IS DISTINCT FROM order_result->>'order_id'
     OR replay->>'created' <> 'false' THEN
    RAISE EXCEPTION 'Retry created duplicate order';
  END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_submit_priced_order(
      '00000000-0000-0000-0000-000000000411',payload,'MCP-REAL-001',
      '00000000-0000-0000-0000-00000000cac2',144.30,true);
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Same document number accepted under new request ID'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_submit_priced_order(
      '00000000-0000-0000-0000-000000000413',payload,'MCP-REAL-002',
      '00000000-0000-0000-0000-00000000cac3',144.30,true);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unassigned pharmacy real order accepted'; END IF;
END;
$verify$;
RESET ROLE;
SELECT is((SELECT count(*) FROM public.orders
  WHERE order_number='MCP-REAL-001' AND external_order_id=
    'chatgpt:00000000-0000-0000-0000-00000000cac1'),1::bigint,
  'One real order persisted with document number and idempotency key');
SELECT is((SELECT count(*) FROM public.orders WHERE order_number='MCP-REAL-001'
    AND order_status='pending' AND source='import'),1::bigint,
  'Real agent order is pending and import-sourced');
SELECT is((SELECT count(*) FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
  WHERE o.order_number='MCP-REAL-001'
    AND oi.quantity=12 AND oi.free_quantity=2 AND oi.discount_rate=35
    AND oi.unit_price_ht=18.50),1::bigint,
  'Real order persists trusted catalog price, discount and UG');
SELECT is((SELECT count(*) FROM public.orders WHERE order_number='MCP-REAL-002'),0::bigint,
  'Unassigned relation never persists');
SELECT is((SELECT count(*) FROM public.orders WHERE order_number='MCP-REAL-001'
    AND net_amount_ht=144.30),1::bigint,
  'Real order persisted with exact reviewed HT amount');
SELECT is((SELECT count(*) FROM public.orders WHERE order_number='MCP-REAL-001'
    AND order_type='initial'),1::bigint,
  'First real order is automatically classified as initial');
SELECT is((SELECT count(*) FROM public.orders WHERE order_number='MCP-REAL-001'
    AND notes IS NULL),1::bigint,
  'Real order does not misuse notes for commercial terms');
SELECT is((SELECT count(*) FROM public.orders WHERE order_number='MCP-REAL-001'
    AND created_by='00000000-0000-0000-0000-0000000000a3'),1::bigint,
  'Real order attributed to authenticated agent');
SELECT * FROM finish();
ROLLBACK;
