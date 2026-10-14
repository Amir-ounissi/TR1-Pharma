-- Preserve the original pharmacy purchase-order number for ChatGPT priced drafts.
-- Keep external_order_id = chatgpt:<request_uuid> as the existing idempotency key:
-- HubSpot reconciliation also uses external_order_id, so never replace it.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_create_priced_order_draft_with_reference(
  target_brand_pharmacy_id uuid,
  draft_items jsonb,
  order_type text,
  request_id uuid,
  confirmed boolean,
  source_order_number text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  source_ref text;
  brand_uuid uuid;
  order_uuid uuid;
  stored_ref text;
  result jsonb;
  request_key text;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit confirmation required' USING ERRCODE = '42501';
  END IF;
  source_ref := btrim(source_order_number);
  IF source_ref IS NULL OR length(source_ref) NOT BETWEEN 1 AND 80
     OR source_ref ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid original order reference' USING ERRCODE = '22023';
  END IF;
  IF request_id IS NULL THEN
    RAISE EXCEPTION 'Missing idempotency key' USING ERRCODE = '22023';
  END IF;

  -- Recheck the same pharmacy scope as the underlying priced-draft function
  -- before checking references, to avoid leaking other pharmacies' records.
  SELECT bp.brand_id INTO brand_uuid
  FROM public.brand_pharmacies bp
  WHERE bp.id = target_brand_pharmacy_id AND bp.archived_at IS NULL;
  IF brand_uuid IS NULL
     OR private.has_brand_role(brand_uuid, ARRAY['agent']) IS DISTINCT FROM true
     OR private.user_is_assigned_to_relation(auth.uid(), target_brand_pharmacy_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Brand pharmacy forbidden' USING ERRCODE = '42501';
  END IF;
  request_key := 'chatgpt:' || request_id::text;

  -- Serialize connector-created orders sharing this reference. A reused request
  -- UUID must match the same source reference; two distinct requests must not
  -- silently claim the same original purchase-order number.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chatgpt-source-order|' || brand_uuid::text || '|' || source_ref, 0)
  );
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.brand_id = brand_uuid AND o.archived_at IS NULL
      AND (o.order_number = source_ref OR o.external_order_id = source_ref)
      AND o.external_order_id IS DISTINCT FROM request_key
  ) THEN
    RAISE EXCEPTION 'Original order reference already belongs to another order'
      USING ERRCODE = '23505';
  END IF;

  -- Pricing and free units remain computed by the existing trusted RPC;
  -- no client-supplied price, discount or free quantity is accepted.
  result := public.tr1_chatgpt_create_priced_order_draft(
    target_brand_pharmacy_id, draft_items, order_type, request_id, true
  );
  order_uuid := (result->>'order_id')::uuid;

  SELECT o.order_number INTO stored_ref
  FROM public.orders o
  WHERE o.id = order_uuid AND o.brand_id = brand_uuid
    AND o.brand_pharmacy_id = target_brand_pharmacy_id
    AND o.external_order_id = request_key
    AND o.created_by = auth.uid()
    AND o.order_status = 'draft'
    AND o.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Confirmed draft not found or already submitted'
      USING ERRCODE = '23505';
  END IF;
  IF stored_ref IS NOT NULL AND stored_ref <> source_ref THEN
    RAISE EXCEPTION 'Existing request has a different source reference'
      USING ERRCODE = '23505';
  END IF;
  UPDATE public.orders
  SET order_number = source_ref
  WHERE id = order_uuid AND order_status = 'draft';

  RETURN result || jsonb_build_object(
    'source_order_number', source_ref,
    'transmitted', false
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.tr1_chatgpt_create_priced_order_draft_with_reference(uuid,jsonb,text,uuid,boolean,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_create_priced_order_draft_with_reference(uuid,jsonb,text,uuid,boolean,text)
  TO tr1_chatgpt_reader;
