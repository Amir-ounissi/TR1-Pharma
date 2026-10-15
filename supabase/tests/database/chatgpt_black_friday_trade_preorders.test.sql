-- End-to-end Black Friday trade preorder tests, transaction rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(8);

INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled)
VALUES ('00000000-0000-0000-0000-00000000cf80',
  'https://test.tr1.invalid/api/connectors/chatgpt/mcp',true);
UPDATE public.brands SET slug='naali'
WHERE id='00000000-0000-0000-0000-000000000101';
INSERT INTO public.brand_pharmacy_commercial_terms
  (brand_pharmacy_id,brand_id,discount_rate,hubspot_synced_at)
VALUES ('00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000101',40,now())
ON CONFLICT (brand_pharmacy_id) DO UPDATE
SET discount_rate=40,hubspot_synced_at=now();

SELECT ok(has_function_privilege('tr1_chatgpt_reader',
  'public.tr1_chatgpt_create_trade_preorder_draft(uuid,jsonb,text,uuid,boolean)','EXECUTE'),
  'Scoped OAuth user can create a confirmed trade draft');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.tr1_chatgpt_create_trade_preorder_draft(uuid,jsonb,text,uuid,boolean)','EXECUTE'),
  'Ordinary authenticated sessions cannot call trade draft');
SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader',
  'public.tr1_chatgpt_trade_preorders','INSERT'),
  'OAuth cannot bypass guarded trade RPC');

SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3",
  "role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000cf80",
  "aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}',true);
DO $verify$
DECLARE
  draft jsonb; replay jsonb; preview jsonb; reviewed jsonb;
  rejected boolean;
  order_uuid uuid;
  basket jsonb:='[{"product_id":"00000000-0000-0000-0000-000000000601",
    "quantity":24,"free_quantity":4}]'::jsonb;
BEGIN
  preview:=public.tr1_chatgpt_trade_preorder_preview(
    '00000000-0000-0000-0000-000000000411',basket);
  IF (preview->>'paid_quantity')::int<>24 OR (preview->>'ug_quantity')::int<>4
    OR (preview->>'gift_antistress_quantity')::int<>14
    OR (preview->>'gift_dream_quantity')::int<>14
    OR (preview->>'total_ht')::numeric<>266.40 THEN
    RAISE EXCEPTION 'Trade preview corrupted: %',preview;
  END IF;

  rejected:=false;
  BEGIN
    PERFORM public.tr1_chatgpt_trade_preorder_preview(
      '00000000-0000-0000-0000-000000000411',
      '[{"product_id":"00000000-0000-0000-0000-000000000601",
        "quantity":24,"free_quantity":3}]'::jsonb);
  EXCEPTION WHEN invalid_parameter_value THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Odd Black Friday gift total was accepted'; END IF;

  rejected:=false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_trade_preorder_draft(
      '00000000-0000-0000-0000-000000000411',basket,
      'BF-QA-100','00000000-0000-0000-0000-00000000cf81',false);
  EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unconfirmed preorder was accepted'; END IF;

  draft:=public.tr1_chatgpt_create_trade_preorder_draft(
    '00000000-0000-0000-0000-000000000411',basket,
    'BF-QA-100','00000000-0000-0000-0000-00000000cf81',true);
  order_uuid:=(draft->>'order_id')::uuid;
  IF (draft->>'created')::boolean IS DISTINCT FROM true
    OR draft->>'status'<>'draft' OR draft->>'review_token' IS NULL THEN
    RAISE EXCEPTION 'Draft and reviewed token not persisted: %',draft;
  END IF;
  replay:=public.tr1_chatgpt_create_trade_preorder_draft(
    '00000000-0000-0000-0000-000000000411',basket,
    'BF-QA-100','00000000-0000-0000-0000-00000000cf81',true);
  IF replay->>'order_id' IS DISTINCT FROM draft->>'order_id'
    OR (replay->>'created')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Trade draft replay duplicated order';
  END IF;

  rejected:=false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_trade_preorder_draft(
      '00000000-0000-0000-0000-000000000411',basket,
      'BF-QA-100','00000000-0000-0000-0000-00000000cf82',true);
  EXCEPTION WHEN unique_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Duplicate source reference accepted'; END IF;

  reviewed:=public.tr1_chatgpt_review_trade_preorder(
    order_uuid,'00000000-0000-0000-0000-00000000cf81');
  IF reviewed->>'review_token' IS DISTINCT FROM draft->>'review_token' THEN
    RAISE EXCEPTION 'Review fingerprint unstable';
  END IF;
END;
$verify$;
RESET ROLE;

SELECT is((SELECT count(*) FROM public.tr1_chatgpt_trade_preorders
  WHERE source_order_number='BF-QA-100'),1::bigint,'Source preorder unique');
SELECT is((SELECT gift_antistress_quantity FROM public.tr1_chatgpt_trade_preorders
  WHERE source_order_number='BF-QA-100'),14,'Consumer Anti-Stress gift count stored');
SELECT is((SELECT gift_dream_quantity FROM public.tr1_chatgpt_trade_preorders
  WHERE source_order_number='BF-QA-100'),14,'Consumer Dream gift count stored');
SELECT is((SELECT count(*) FROM public.order_item_free_unit_allocations a
  JOIN public.order_items oi ON oi.id=a.order_item_id
  JOIN public.orders o ON o.id=oi.order_id
  WHERE o.order_number='BF-QA-100' AND a.quantity=4
    AND a.classification='conditions commerciales client'),
    1::bigint,'UG classification persists at reference level');
SELECT is((SELECT count(*) FROM public.orders
  WHERE order_number='BF-QA-100' AND order_status='draft'),1::bigint,
  'Preorder remains draft, never delivered by tests');

SELECT * FROM finish();
ROLLBACK;
