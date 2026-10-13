-- Confirm a trusted MCP order with the same pending/HubSpot flow as web PDF import.
-- HubSpot sync is triggered by the authenticated MCP server *after* this transaction commits.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_submit_priced_order(
  target_brand_pharmacy_id uuid,
  submitted_items jsonb,
  document_order_number text,
  request_id uuid,
  expected_total_ht numeric,
  confirmed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  rel record;
  preview jsonb;
  item jsonb;
  checked_items jsonb := '[]'::jsonb;
  trusted_items jsonb := '[]'::jsonb;
  line jsonb;
  submitted_ean text;
  product_ean text;
  prior record;
  created_order_id uuid;
  requested_number text;
  external_key text;
  inferred_type text;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit order confirmation required' USING ERRCODE = '42501';
  END IF;
  IF target_brand_pharmacy_id IS NULL OR request_id IS NULL
     OR expected_total_ht IS NULL OR expected_total_ht < 0
     OR jsonb_typeof(submitted_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(submitted_items) NOT BETWEEN 1 AND 30
     OR document_order_number IS NULL
     OR length(btrim(document_order_number)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Incomplete order confirmation' USING ERRCODE = '22023';
  END IF;

  SELECT bp.id,bp.brand_id,bp.pharmacy_id INTO rel
  FROM public.brand_pharmacies bp
  WHERE bp.id=target_brand_pharmacy_id AND bp.archived_at IS NULL;
  IF rel.id IS NULL
     OR private.has_brand_role(rel.brand_id, ARRAY['agent']) IS DISTINCT FROM true
     OR private.user_is_assigned_to_relation(auth.uid(), rel.id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Brand pharmacy forbidden' USING ERRCODE = '42501';
  END IF;

  requested_number := btrim(document_order_number);
  external_key := 'chatgpt:' || request_id::text;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'chatgpt-confirm|' || rel.brand_id::text || '|' || rel.pharmacy_id::text || '|' || requested_number,0));

  -- Fail closed on a different request identifier for an already imported
  -- purchase order (from the website or ChatGPT) for this pharmacy.
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.brand_id=rel.brand_id AND o.pharmacy_id=rel.pharmacy_id
      AND o.order_number=requested_number AND o.archived_at IS NULL
      AND o.external_order_id IS DISTINCT FROM external_key
  ) THEN
    RAISE EXCEPTION 'Purchase order number already recorded for this pharmacy' USING ERRCODE = '23505';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(submitted_items) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(item)) <> 3
      OR NOT (item ? 'product_id' AND item ? 'quantity' AND item ? 'source_ean')
      OR jsonb_typeof(item->'source_ean') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Every order item requires product, paid quantity and document EAN' USING ERRCODE='22023';
    END IF;
    submitted_ean := btrim(item->>'source_ean');
    IF submitted_ean !~ '^[0-9]{8,14}$' THEN
      RAISE EXCEPTION 'Document EAN missing or malformed' USING ERRCODE='22023';
    END IF;
    SELECT p.ean INTO product_ean FROM public.products p
      WHERE p.id=(item->>'product_id')::uuid AND p.brand_id=rel.brand_id;
    IF product_ean IS NULL OR submitted_ean <> product_ean THEN
      RAISE EXCEPTION 'Document EAN does not match TR1 catalog product' USING ERRCODE='22023';
    END IF;
    checked_items := checked_items || jsonb_build_array(
      jsonb_build_object('product_id',item->'product_id','quantity',item->'quantity'));
  END LOOP;

  -- Recompute all prices and UG inside the same transaction; client monetary
  -- fields are never persisted and any changed total aborts submission.
  preview := public.tr1_chatgpt_priced_order_preview(target_brand_pharmacy_id,checked_items);
  IF (preview->>'total_ht')::numeric IS DISTINCT FROM expected_total_ht THEN
    RAISE EXCEPTION 'Commercial conditions changed; new preview required' USING ERRCODE='22023';
  END IF;

  -- An exact retry returns the same pending order only if its line basket and
  -- money still match: never create a duplicate or silently mutate it.
  SELECT o.id,o.order_status,o.order_number,o.net_amount_ht
  INTO prior FROM public.orders o
  WHERE o.brand_id=rel.brand_id AND o.external_order_id=external_key
    AND o.created_by=auth.uid() AND o.brand_pharmacy_id=rel.id AND o.archived_at IS NULL
  LIMIT 1;
  IF prior.id IS NOT NULL THEN
    IF prior.order_number IS DISTINCT FROM requested_number
       OR prior.order_status::text NOT IN ('pending','confirmed')
       OR prior.net_amount_ht IS DISTINCT FROM expected_total_ht
       OR (SELECT count(*) FROM public.order_items oi WHERE oi.order_id=prior.id) <> jsonb_array_length(checked_items)
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(preview->'items') line
         WHERE NOT EXISTS (
           SELECT 1 FROM public.order_items oi WHERE oi.order_id=prior.id
             AND oi.product_id=(line->>'product_id')::uuid
             AND oi.quantity=(line->>'quantity')::integer
             AND oi.free_quantity=(line->>'free_quantity')::integer
             AND oi.unit_price_ht=(line->>'unit_price_ht')::numeric
             AND oi.discount_rate=(line->>'discount_rate')::numeric))
    THEN
      RAISE EXCEPTION 'Request ID belongs to a changed order' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('order_id',prior.id,'brand_id',rel.brand_id,
      'status',prior.order_status::text,'created',false,'hubspot_sync_required',true);
  END IF;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.brand_id=rel.brand_id AND o.pharmacy_id=rel.pharmacy_id
      AND o.archived_at IS NULL
      AND o.order_status::text IN
        ('pending','needs_correction','confirmed','invoiced','partially_delivered','delivered')
  ) THEN 'reorder' ELSE 'initial' END INTO inferred_type;

  FOR line IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
    trusted_items := trusted_items || jsonb_build_array(jsonb_build_object(
      'product_id',line->'product_id','quantity',line->'quantity',
      'free_quantity',line->'free_quantity','unit_price_ht',line->'unit_price_ht',
      'discount_rate',line->'discount_rate','tax_rate',line->'tax_rate'));
  END LOOP;
  SELECT order_id INTO created_order_id
  FROM public.create_order_with_pharmacy_resolution(
    rel.brand_id,rel.id,NULL,NULL,
    jsonb_build_object(
      'external_order_id',external_key,'order_number',requested_number,
      'order_type',inferred_type,'order_status','pending',
      'order_date',now(),'source','import','shipping_amount_ht',0,
      'payment_status','not_applicable'),
    trusted_items
  );
  IF created_order_id IS NULL THEN
    RAISE EXCEPTION 'Order persistence did not return an ID' USING ERRCODE='23514';
  END IF;
  RETURN jsonb_build_object('order_id',created_order_id,'brand_id',rel.brand_id,
    'status','pending','created',true,'hubspot_sync_required',true,
    'total_ht',preview->'total_ht','vat',preview->'vat',
    'total_ttc',preview->'total_ttc');
END;
$fn$;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_submit_priced_order(uuid,jsonb,text,uuid,numeric,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_submit_priced_order(uuid,jsonb,text,uuid,numeric,boolean)
  TO tr1_chatgpt_reader;
