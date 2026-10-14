-- Fully transactional verification with the seeded demonstration Naali brand.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(9);

INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled)
VALUES ('00000000-0000-0000-0000-00000000cc90',
  'https://test.tr1.invalid/api/connectors/chatgpt/mcp',true);

UPDATE public.brands SET slug='naali'
WHERE id='00000000-0000-0000-0000-000000000101';
INSERT INTO public.brand_pharmacy_commercial_terms
  (brand_pharmacy_id,brand_id,discount_rate,ug_paid_quantity,ug_free_quantity)
VALUES ('00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000101',35,12,2)
ON CONFLICT (brand_pharmacy_id) DO UPDATE
SET discount_rate=35,ug_paid_quantity=12,ug_free_quantity=2;

SELECT ok(has_function_privilege('tr1_chatgpt_reader',
  'public.tr1_chatgpt_set_draft_ug_adjustments(uuid,uuid,jsonb,boolean)','EXECUTE'),
  'Dedicated OAuth connector may apply confirmed draft exceptions');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.tr1_chatgpt_set_draft_ug_adjustments(uuid,uuid,jsonb,boolean)','EXECUTE'),
  'Normal authenticated users cannot call OAuth-only UG edit');
SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader',
  'public.tr1_chatgpt_order_ug_overrides','INSERT'),
  'OAuth role cannot bypass audited RPC with direct table insert');

SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000cc90","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}',true);

DO $test$
DECLARE
  draft jsonb;
  altered jsonb;
  preview jsonb;
  reviewed jsonb;
  denied boolean;
  id uuid;
BEGIN
  preview:=public.tr1_chatgpt_ug_adjusted_preview(
    '00000000-0000-0000-0000-000000000411',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":24}]'::jsonb,
    '[{"product_id":"00000000-0000-0000-0000-000000000601","mode":"replace","quantity":24,"classification":"offre exceptionnelle sell-in"}]'::jsonb
  );
  IF (preview->'items'->0->>'free_quantity')::integer<>24
    OR (preview->'items'->0->>'standard_free_quantity')::integer<>4
    OR (preview->'items'->0->>'commercial_free_quantity')::integer<>0 THEN
    RAISE EXCEPTION 'Replacement 1+1 must override 12+2: %',preview;
  END IF;

  denied:=false;
  BEGIN
    PERFORM public.tr1_chatgpt_ug_adjusted_preview(
      '00000000-0000-0000-0000-000000000411',
      '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":24}]'::jsonb,
      '[{"product_id":"00000000-0000-0000-0000-000000000601","mode":"add","quantity":17,"classification":"unknown"}]'::jsonb
    );
  EXCEPTION WHEN others THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unclassified exception was accepted'; END IF;

  draft:=public.tr1_chatgpt_create_priced_order_draft(
    '00000000-0000-0000-0000-000000000411',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":24}]'::jsonb,
    'reorder','00000000-0000-0000-0000-00000000cc91',true);
  id:=(draft->>'order_id')::uuid;
  denied:=false;
  BEGIN
    PERFORM public.tr1_chatgpt_set_draft_ug_adjustments(id,
      '00000000-0000-0000-0000-00000000cc91',
      '[{"product_id":"00000000-0000-0000-0000-000000000601","mode":"add","quantity":17,"classification":"compensation opé promo"}]'::jsonb,false);
  EXCEPTION WHEN others THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unconfirmed edit succeeded'; END IF;

  altered:=public.tr1_chatgpt_set_draft_ug_adjustments(id,
    '00000000-0000-0000-0000-00000000cc91',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","mode":"add","quantity":17,"classification":"compensation opé promo"}]'::jsonb,true);
  IF (altered->'items'->0->>'free_quantity')::integer <>21
     OR (altered->'items'->0->>'commercial_free_quantity')::integer<>4
     OR (altered->'items'->0->>'manual_free_quantity')::integer<>17 THEN
    RAISE EXCEPTION 'Compensation plus commercial UG mismatch %',altered;
  END IF;
  reviewed:=public.tr1_chatgpt_review_priced_order(id,
    '00000000-0000-0000-0000-00000000cc91');
  IF (reviewed->'items'->0->>'free_quantity')::integer<>21
    OR reviewed->>'review_token' IS NULL THEN
    RAISE EXCEPTION 'Audited review failed %',reviewed;
  END IF;

  altered:=public.tr1_chatgpt_set_draft_ug_adjustments(id,
    '00000000-0000-0000-0000-00000000cc91',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","mode":"replace","quantity":24,"classification":"offre exceptionnelle sell-in"}]'::jsonb,true);
  IF (altered->'items'->0->>'free_quantity')::integer<>24 THEN
    RAISE EXCEPTION 'Override must be replacement, not cumulative';
  END IF;
  altered:=public.tr1_chatgpt_set_draft_ug_adjustments(id,
    '00000000-0000-0000-0000-00000000cc91','[]'::jsonb,true);
  IF (altered->'items'->0->>'free_quantity')::integer<>4 THEN
    RAISE EXCEPTION 'Reset to commercial terms failed';
  END IF;
END;
$test$;
RESET ROLE;

SELECT is((
  SELECT count(*) FROM public.tr1_chatgpt_order_ug_overrides ov
  JOIN public.order_items oi ON oi.id=ov.order_item_id
  JOIN public.orders o ON o.id=oi.order_id
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cc91'
),0::bigint,'Reset removes exceptional overrides');
SELECT is((
  SELECT count(*) FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cc91'
    AND oi.quantity=24 AND oi.free_quantity=4 AND oi.discount_rate=35
),1::bigint,'Reset preserves trusted pricing and standard UG');
SELECT is((
  SELECT count(*) FROM public.orders
  WHERE external_order_id='chatgpt:00000000-0000-0000-0000-00000000cc91'
    AND order_status='draft'
),1::bigint,'Exception edits never submit a draft');
SELECT is((
  SELECT count(*) FROM public.order_item_free_unit_allocations a
  JOIN public.order_items oi ON oi.id=a.order_item_id
  JOIN public.orders o ON o.id=oi.order_id
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cc91'
    AND a.source='commercial_terms' AND a.quantity=4
),1::bigint,'Reset re-establishes standard commercial UG allocation');
SELECT ok((SELECT count(*) FROM public.brand_pharmacy_commercial_terms
  WHERE brand_pharmacy_id='00000000-0000-0000-0000-000000000411'
    AND ug_paid_quantity=12 AND ug_free_quantity=2)>0,
  'Per-order exception does not mutate pharmacy commercial conditions');
SELECT is((
  SELECT count(*) FROM public.orders
  WHERE external_order_id='chatgpt:00000000-0000-0000-0000-00000000cc91'
),1::bigint,'Only one draft exists for the idempotent request');
SELECT * FROM finish();
ROLLBACK;
