-- Scoped ChatGPT draft source-reference contract; all fixture writes rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(7);

INSERT INTO private.tr1_chatgpt_oauth_clients(client_id,resource_url,enabled)
VALUES ('00000000-0000-0000-0000-00000000cad0',
  'https://test.tr1.invalid/api/connectors/chatgpt/mcp',true);

INSERT INTO public.brand_pharmacy_commercial_terms
  (brand_pharmacy_id,brand_id,discount_rate,ug_paid_quantity,ug_free_quantity)
VALUES ('00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000101',35,12,2)
ON CONFLICT (brand_pharmacy_id) DO UPDATE
SET discount_rate=35,ug_paid_quantity=12,ug_free_quantity=2;

SELECT ok(has_function_privilege('tr1_chatgpt_reader',
 'public.tr1_chatgpt_create_priced_order_draft_with_reference(uuid,jsonb,text,uuid,boolean,text)','EXECUTE'),
 'Scoped ChatGPT OAuth role can save a source reference');
SELECT ok(NOT has_function_privilege('anon',
 'public.tr1_chatgpt_create_priced_order_draft_with_reference(uuid,jsonb,text,uuid,boolean,text)','EXECUTE'),
 'Anonymous users cannot save a source reference');
SELECT ok(NOT has_function_privilege('authenticated',
 'public.tr1_chatgpt_create_priced_order_draft_with_reference(uuid,jsonb,text,uuid,boolean,text)','EXECUTE'),
 'Normal browser users cannot invoke the ChatGPT RPC');
SELECT ok(NOT has_table_privilege('tr1_chatgpt_reader','public.orders','UPDATE'),
 'ChatGPT OAuth role still cannot update orders directly');

SET LOCAL ROLE tr1_chatgpt_reader;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"tr1_chatgpt_reader","client_id":"00000000-0000-0000-0000-00000000cad0","aud":"https://test.tr1.invalid/api/connectors/chatgpt/mcp"}',true);

DO $verify$
DECLARE
  created jsonb;
  replay jsonb;
  denied boolean;
  items jsonb := '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":12}]'::jsonb;
  rel uuid := '00000000-0000-0000-0000-000000000411'::uuid;
  key1 uuid := '00000000-0000-0000-0000-00000000cad1'::uuid;
BEGIN
  created := public.tr1_chatgpt_create_priced_order_draft_with_reference(
    rel,items,'reorder',key1,true,' 156589 ');
  IF created->>'source_order_number' <> '156589'
     OR created->>'pricing_applied' <> 'true'
     OR created->>'transmitted' <> 'false'
     OR created->>'status' <> 'draft' THEN
    RAISE EXCEPTION 'Source-ref draft incorrectly created: %',created;
  END IF;
  replay := public.tr1_chatgpt_create_priced_order_draft_with_reference(
    rel,items,'reorder',key1,true,'156589');
  IF replay->>'order_id' IS DISTINCT FROM created->>'order_id'
     OR replay->>'created' <> 'false' THEN
    RAISE EXCEPTION 'Source reference retry duplicated the order';
  END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_priced_order_draft_with_reference(
      rel,items,'reorder',key1,true,'different');
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Changed reference on replay accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_priced_order_draft_with_reference(
      rel,items,'reorder','00000000-0000-0000-0000-00000000cad2',true,'156589');
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Duplicate pharmacy reference accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_priced_order_draft_with_reference(
      rel,items,'reorder','00000000-0000-0000-0000-00000000cad3',false,'XX');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unconfirmed source-ref write accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_priced_order_draft_with_reference(
      '00000000-0000-0000-0000-000000000413',items,'reorder',
      '00000000-0000-0000-0000-00000000cad4',true,'XX');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unassigned source-ref write accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.tr1_chatgpt_create_priced_order_draft_with_reference(
      rel,items,'reorder','00000000-0000-0000-0000-00000000cad5',true,E'AB\nCD');
  EXCEPTION WHEN invalid_parameter_value THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Control characters accepted'; END IF;
END;
$verify$;
RESET ROLE;

SELECT is((SELECT count(*) FROM public.orders
  WHERE external_order_id='chatgpt:00000000-0000-0000-0000-00000000cad1'
    AND order_number='156589' AND order_status='draft' AND submitted_at IS NULL),
  1::bigint, 'Original pharmacy number saved only on an unsent draft');
SELECT is((SELECT count(*) FROM public.order_items oi
 JOIN public.orders o ON o.id=oi.order_id
 WHERE o.external_order_id='chatgpt:00000000-0000-0000-0000-00000000cad1'
  AND oi.quantity=12 AND oi.free_quantity=2 AND oi.discount_rate=35),
 1::bigint, 'Trusted pricing and free units preserved');
SELECT is((SELECT count(*) FROM public.orders WHERE order_number='156589'
   AND brand_id='00000000-0000-0000-0000-000000000101'),1::bigint,
 'Different request ID cannot duplicate the source document');
SELECT * FROM finish();
ROLLBACK;
