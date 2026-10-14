-- Allow the OAuth-bound ChatGPT caller to review and submit only its own
-- priced, pharmacy-scoped Naali drafts. HubSpot delivery happens in the MCP
-- server after this atomic status transition, never inside a database trigger.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_review_priced_order(
  target_order_id uuid, request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  o record;
  basket jsonb;
  preview jsonb;
  item jsonb;
  stored record;
  item_count integer;
  review_fingerprint text;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF target_order_id IS NULL OR request_id IS NULL THEN
    RAISE EXCEPTION 'Order and request ID are required' USING ERRCODE = '22023';
  END IF;
  SELECT ord.id,ord.brand_id,ord.brand_pharmacy_id,ord.order_type,
         ord.order_status,ord.order_number,ord.net_amount_ht,
         br.slug AS brand_slug
  INTO o
  FROM public.orders ord
  JOIN public.brands br ON br.id=ord.brand_id
  JOIN public.brand_pharmacies bp ON bp.id=ord.brand_pharmacy_id
  WHERE ord.id=target_order_id
    AND ord.external_order_id='chatgpt:' || request_id::text
    AND ord.created_by=auth.uid()
    AND ord.archived_at IS NULL AND bp.archived_at IS NULL;

  IF o.id IS NULL OR o.brand_slug <> 'naali'
     OR private.has_brand_role(o.brand_id,ARRAY['agent']) IS DISTINCT FROM true
     OR private.user_is_assigned_to_relation(auth.uid(),o.brand_pharmacy_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Order access denied' USING ERRCODE = '42501';
  END IF;
  IF o.order_status::text NOT IN ('draft','pending')
     OR o.order_type::text NOT IN ('initial','reorder') THEN
    RAISE EXCEPTION 'Order status/type unsupported for Naali HubSpot submission'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*),coalesce(jsonb_agg(
    jsonb_build_object('product_id',oi.product_id,'quantity',oi.quantity)
    ORDER BY oi.product_id
  ),'[]'::jsonb)
  INTO item_count,basket FROM public.order_items oi WHERE oi.order_id=o.id;
  IF item_count NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Missing or excessive order lines' USING ERRCODE='22023';
  END IF;
  preview:=public.tr1_chatgpt_priced_order_preview(o.brand_pharmacy_id,basket);
  FOR item IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
    SELECT oi.product_id,oi.quantity,oi.free_quantity,oi.unit_price_ht,
           oi.discount_rate,oi.tax_rate
    INTO stored FROM public.order_items oi
    WHERE oi.order_id=o.id AND oi.product_id=(item->>'product_id')::uuid;
    IF NOT FOUND
       OR stored.quantity IS DISTINCT FROM (item->>'quantity')::integer
       OR stored.free_quantity IS DISTINCT FROM (item->>'free_quantity')::integer
       OR stored.unit_price_ht IS DISTINCT FROM (item->>'unit_price_ht')::numeric
       OR stored.discount_rate IS DISTINCT FROM (item->>'discount_rate')::numeric
       OR stored.tax_rate IS DISTINCT FROM (item->>'tax_rate')::numeric THEN
      RAISE EXCEPTION 'Draft price, discount or free units changed: recreate a priced draft'
        USING ERRCODE = '23505';
    END IF;
  END LOOP;
  IF round(coalesce(o.net_amount_ht,0),2) IS DISTINCT FROM
     round((preview->>'total_ht')::numeric,2) THEN
    RAISE EXCEPTION 'Draft total differs from verified commercial terms'
      USING ERRCODE = '23505';
  END IF;
  review_fingerprint:=md5(
    o.id::text || ':' || o.order_type::text || ':' ||
    coalesce(o.order_number,'') || ':' || (preview->'items')::text || ':' ||
    (preview->>'total_ht')
  );
  RETURN jsonb_build_object(
    'order_id',o.id,'brand_pharmacy_id',o.brand_pharmacy_id,
    'order_number',o.order_number,'order_type',o.order_type,
    'status',o.order_status,'items',preview->'items',
    'total_ht',preview->'total_ht','vat',preview->'vat',
    'total_ttc',preview->'total_ttc','review_token',review_fingerprint,
    'hubspot_synced',false
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_submit_priced_order(
  target_order_id uuid, request_id uuid, review_token text, confirmed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  o record;
  reviewed jsonb;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF confirmed IS DISTINCT FROM true OR target_order_id IS NULL OR request_id IS NULL
     OR review_token !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Explicit reviewed confirmation required' USING ERRCODE = '22023';
  END IF;
  -- An order may only be finalized once. A retry of the exact same OAuth
  -- caller and request ID can re-attempt the HubSpot upsert safely.
  SELECT ord.id,ord.brand_id,ord.brand_pharmacy_id,ord.order_status
  INTO o FROM public.orders ord
  WHERE ord.id=target_order_id
    AND ord.external_order_id='chatgpt:' || request_id::text
    AND ord.created_by=auth.uid() AND ord.archived_at IS NULL
  FOR UPDATE;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Order access denied' USING ERRCODE='42501';
  END IF;
  reviewed:=public.tr1_chatgpt_review_priced_order(target_order_id,request_id);
  IF reviewed->>'review_token' IS DISTINCT FROM review_token THEN
    RAISE EXCEPTION 'Order changed since review: review again before submission'
      USING ERRCODE='23505';
  END IF;
  IF o.order_status = 'draft' THEN
    -- Existing transition enforces the agent review rules and audits the
    -- submission. Pending is the only self-service status for brand agents.
    PERFORM public.change_order_status(target_order_id,'pending'::public.order_status,NULL);
    RETURN jsonb_build_object('order_id',target_order_id,'status','pending',
      'submitted',true,'already_submitted',false,'hubspot_synced',false);
  END IF;
  IF o.order_status = 'pending' THEN
    RETURN jsonb_build_object('order_id',target_order_id,'status','pending',
      'submitted',true,'already_submitted',true,'hubspot_synced',false);
  END IF;
  RAISE EXCEPTION 'Order cannot be submitted in its current status'
    USING ERRCODE='23505';
END;
$fn$;

REVOKE ALL ON FUNCTION public.tr1_chatgpt_review_priced_order(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_submit_priced_order(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_review_priced_order(uuid,uuid) TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_submit_priced_order(uuid,uuid,text,boolean) TO tr1_chatgpt_reader;
