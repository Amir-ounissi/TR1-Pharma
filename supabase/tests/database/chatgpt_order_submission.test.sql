-- All writes in this test roll back. Nothing reaches a real pharmacy or HubSpot.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(7);

INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled)
VALUES ('00000000-0000-0000-0000-00000000cb90',
  'https://test.tr1.invalid/api/connectors/chatgpt/mcp',true);

INSERT INTO public.brand_pharmacy_commercial_terms
  (brand_pharmacy_id,brand_id,discount_rate,ug_paid_quantity,ug_free_quantity)
VALUES ('00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000101',35,12,2)
ON CONFLICT (brand_pharmacy_id) DO UPDATE
SET discount_rate=35,ug_paid_quantity=12,ug_free_quantity=2;

SELECT ok(NOT has_function_privilege('authenticated',
  'public.tr1_chatgpt_submit_priced_order(uuid,uuid,text,boolean)','EXECUTE'),
  'Normal TR1 sessions cannot call the OAuth submit function');
SELECT ok(has_function_privilege('tr1_chatgpt_reader',
  'public.tr1_chatgpt_submit_priced_order(uuid,uuid,text,boolean)','EXECUTE'),
  'Authorized ChatGPT OAuth role may submit through dedicated RPC');

SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000cb90","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}',true);

DO $verify$
DECLARE
  draft jsonb;
  review jsonb;
  first_submit jsonb;
  repeated jsonb;
  denied boolean;
BEGIN
  draft:=public.tr1_chatgpt_create_priced_order_draft(
    '00000000-0000-0000-0000-000000000411',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12}]'::jsonb,
    'reorder','00000000-0000-0000-0000-00000000cb91',true);
  review:=public.tr1_chatgpt_review_priced_order(
    (draft->>'order_id')::uuid,'00000000-0000-0000-0000-00000000cb91');
  IF review->>'status' <> 'draft' OR review->>'review_token' IS NULL
     OR (review->>'total_ht')::numeric <> 144.30 THEN
    RAISE EXCEPTION 'Order review not validated: %',review;
  END IF;

  denied:=false;
  BEGIN
    PERFORM public.tr1_chatgpt_submit_priced_order(
      (draft->>'order_id')::uuid,'00000000-0000-0000-0000-00000000cb91',
      review->>'review_token',false);
  EXCEPTION WHEN others THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unconfirmed order was submitted'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tr1_chatgpt_submit_priced_order(
      (draft->>'order_id')::uuid,'00000000-0000-0000-0000-00000000cb91',
      repeat('0',32),true);
  EXCEPTION WHEN others THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Order accepted an incorrect review token'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tr1_chatgpt_submit_priced_order(
      (draft->>'order_id')::uuid,'00000000-0000-0000-0000-00000000cb92',
      review->>'review_token',true);
  EXCEPTION WHEN others THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Different request ID was accepted'; END IF;

  first_submit:=public.tr1_chatgpt_submit_priced_order(
    (draft->>'order_id')::uuid,'00000000-0000-0000-0000-00000000cb91',
    review->>'review_token',true);
  repeated:=public.tr1_chatgpt_submit_priced_order(
    (draft->>'order_id')::uuid,'00000000-0000-0000-0000-00000000cb91',
    review->>'review_token',true);
  IF first_submit->>'status' <> 'pending' OR first_submit->>'already_submitted' <> 'false'
    OR repeated->>'already_submitted' <> 'true' THEN
    RAISE EXCEPTION 'Submission / idempotent retry failed: %, %',first_submit,repeated;
  END IF;
END;
$verify$;
RESET ROLE;

SELECT is((SELECT count(*) FROM public.orders WHERE external_order_id=
  'chatgpt:00000000-0000-0000-0000-00000000cb91'),1::bigint,
  'One order created for idempotent request key');
SELECT is((SELECT count(*) FROM public.orders WHERE external_order_id=
  'chatgpt:00000000-0000-0000-0000-00000000cb91' AND order_status='pending'),
  1::bigint,'Reviewed Naali order is submitted for brand approval');
SELECT is((SELECT count(*) FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
  WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cb91'
  AND oi.quantity=12 AND oi.free_quantity=2 AND oi.discount_rate=35),
  1::bigint,'Submission preserves trusted discounts and free quantities');
SELECT is((SELECT count(*) FROM public.orders WHERE external_order_id=
  'chatgpt:00000000-0000-0000-0000-00000000cb91' AND source='manual'),
  1::bigint,'Submission preserves its ChatGPT order provenance');
SELECT is((SELECT count(*) FROM public.orders WHERE external_order_id=
  'chatgpt:00000000-0000-0000-0000-00000000cb91' AND order_type='reorder'),
  1::bigint,'HubSpot-compatible order type is preserved');
SELECT * FROM finish();
ROLLBACK;
