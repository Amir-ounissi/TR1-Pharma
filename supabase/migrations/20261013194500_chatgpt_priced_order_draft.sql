-- MCP commercial parity: compute line prices and free units from trusted TR1/HubSpot
-- snapshots, never from a scanned order or user-provided price/discount.
-- A stale Naali HubSpot snapshot fails closed until refreshed by the web integration.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_priced_order_preview(
  target_brand_pharmacy_id uuid, draft_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  rel record;
  terms record;
  line jsonb;
  p record;
  qty integer;
  product_id uuid;
  seen uuid[] := '{}'::uuid[];
  discount numeric;
  paid integer;
  free integer;
  free_qty integer;
  lines jsonb := '[]'::jsonb;
  total_ht numeric := 0;
  total_vat numeric := 0;
  line_ht numeric;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF target_brand_pharmacy_id IS NULL OR jsonb_typeof(draft_items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(draft_items) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid order lines' USING ERRCODE = '22023';
  END IF;
  SELECT bp.id, bp.brand_id, b.slug INTO rel
  FROM public.brand_pharmacies bp JOIN public.brands b ON b.id = bp.brand_id
  WHERE bp.id = target_brand_pharmacy_id AND bp.archived_at IS NULL;
  IF rel.id IS NULL
    OR private.has_brand_role(rel.brand_id, ARRAY['agent']) IS DISTINCT FROM true
    OR private.user_is_assigned_to_relation(auth.uid(), rel.id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Brand pharmacy forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO terms FROM public.brand_pharmacy_commercial_terms t
  WHERE t.brand_pharmacy_id = rel.id AND t.brand_id = rel.brand_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial terms missing: refresh TR1/HubSpot before ordering' USING ERRCODE = '22023';
  END IF;
  IF rel.slug = 'naali' AND
     (terms.discount_rate IS NULL OR terms.ug_paid_quantity IS NULL OR terms.ug_free_quantity IS NULL)
     AND (terms.hubspot_synced_at IS NULL OR terms.hubspot_synced_at < now() - interval '24 hours') THEN
    RAISE EXCEPTION 'Naali HubSpot commercial terms stale: refresh before ordering' USING ERRCODE = '22023';
  END IF;
  discount := coalesce(terms.discount_rate, terms.hubspot_discount_rate);
  paid := coalesce(terms.ug_paid_quantity, terms.hubspot_ug_paid_quantity);
  free := coalesce(terms.ug_free_quantity, terms.hubspot_ug_free_quantity);
  -- Naali ambassador lead status overrides generic HubSpot UG snapshot, as on web.
  -- Explicit TR1 manual UG terms take precedence.
  IF rel.slug = 'naali' AND terms.ug_paid_quantity IS NULL AND
     lower(btrim(coalesce(terms.hubspot_lead_status,''))) = 'client ambassadeur' THEN
    paid := 12; free := 2;
  ELSIF rel.slug = 'naali' AND terms.ug_paid_quantity IS NULL AND
     lower(btrim(coalesce(terms.hubspot_lead_status,''))) = 'client partenaire' THEN
    paid := 12; free := 1;
  END IF;
  IF discount IS NULL OR discount < 0 OR discount > 100
     OR paid IS NULL OR paid <= 0 OR free IS NULL OR free < 0 THEN
    RAISE EXCEPTION 'Commercial discount or free-unit rule unverified' USING ERRCODE = '22023';
  END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(draft_items) LOOP
    IF jsonb_typeof(line) <> 'object' OR
       NOT (line ? 'product_id' AND line ? 'quantity') OR
       jsonb_typeof(line->'product_id') <> 'string' OR
       jsonb_typeof(line->'quantity') <> 'number' OR
       (line->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
       (line->>'quantity') !~ '^[0-9]{1,4}$' THEN
      RAISE EXCEPTION 'Invalid order item' USING ERRCODE = '22023';
    END IF;
    product_id := (line->>'product_id')::uuid;
    qty := (line->>'quantity')::integer;
    IF qty NOT BETWEEN 1 AND 9999 OR product_id = ANY(seen) THEN
      RAISE EXCEPTION 'Duplicate product or invalid quantity' USING ERRCODE = '22023';
    END IF;
    seen := array_append(seen, product_id);
    SELECT id,name,ean,wholesale_price_ht,tax_rate,minimum_order_quantity INTO p
    FROM public.products WHERE id=product_id AND brand_id=rel.brand_id
      AND is_active AND discontinued_at IS NULL AND is_pharmacy_eligible;
    IF p.id IS NULL OR p.wholesale_price_ht IS NULL OR p.wholesale_price_ht < 0
      OR p.tax_rate IS NULL OR (p.minimum_order_quantity IS NOT NULL AND qty < p.minimum_order_quantity) THEN
      RAISE EXCEPTION 'Unavailable product, catalog price or minimum quantity' USING ERRCODE = '22023';
    END IF;
    free_qty := (qty / paid) * free;
    line_ht := round(qty * p.wholesale_price_ht * (1 - discount / 100), 2);
    total_ht := total_ht + line_ht;
    total_vat := total_vat + round(line_ht * p.tax_rate / 100, 2);
    lines := lines || jsonb_build_array(jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'ean', p.ean,
      'quantity', qty, 'free_quantity', free_qty,
      'unit_price_ht', p.wholesale_price_ht, 'discount_rate', discount,
      'tax_rate', p.tax_rate, 'line_total_ht', line_ht
    ));
  END LOOP;
  RETURN jsonb_build_object('brand_pharmacy_id',rel.id,
    'items',lines,'total_ht',total_ht,'vat',total_vat,'total_ttc',total_ht+total_vat,
    'status','preview','transmitted',false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_create_priced_order_draft(
  target_brand_pharmacy_id uuid, draft_items jsonb,
  order_type text, request_id uuid, confirmed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  preview jsonb;
  result jsonb;
  order_uuid uuid;
  line jsonb;
  existing record;
BEGIN
  IF confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit confirmation required' USING ERRCODE = '42501';
  END IF;
  -- Preview validates the OAuth caller, assignment, catalog, and fresh trusted terms.
  preview := public.tr1_chatgpt_priced_order_preview(target_brand_pharmacy_id,draft_items);
  result := public.tr1_chatgpt_create_order_draft(
    target_brand_pharmacy_id,draft_items,order_type,'',request_id,true);
  order_uuid := (result->>'order_id')::uuid;
  IF (result->>'created')::boolean THEN
    FOR line IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
      UPDATE public.order_items
      SET free_quantity=(line->>'free_quantity')::integer,
          discount_rate=(line->>'discount_rate')::numeric,
          discount_amount_ht=round(
            (line->>'quantity')::numeric*(line->>'unit_price_ht')::numeric*
            (line->>'discount_rate')::numeric/100,2)
      WHERE order_id=order_uuid AND product_id=(line->>'product_id')::uuid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Order line persistence failed' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    UPDATE public.orders SET notes=NULL WHERE id=order_uuid AND order_status='draft';
  ELSE
    -- Never return an existing draft as successfully priced when its terms differ.
    FOR line IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
      SELECT free_quantity,discount_rate,unit_price_ht INTO existing
      FROM public.order_items
      WHERE order_id=order_uuid AND product_id=(line->>'product_id')::uuid;
      IF existing.free_quantity IS DISTINCT FROM (line->>'free_quantity')::integer
         OR existing.discount_rate IS DISTINCT FROM (line->>'discount_rate')::numeric
         OR existing.unit_price_ht IS DISTINCT FROM (line->>'unit_price_ht')::numeric THEN
        RAISE EXCEPTION 'Existing draft has different commercial terms; review it in TR1'
          USING ERRCODE = '23505';
      END IF;
    END LOOP;
  END IF;
  RETURN result || jsonb_build_object(
    'review_required',true,'transmitted',false,'pricing_applied',true,
    'total_ht',preview->'total_ht','vat',preview->'vat',
    'total_ttc',preview->'total_ttc','items',preview->'items');
END;
$fn$;

REVOKE ALL ON FUNCTION public.tr1_chatgpt_priced_order_preview(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_create_priced_order_draft(uuid,jsonb,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_priced_order_preview(uuid,jsonb) TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_create_priced_order_draft(uuid,jsonb,text,uuid,boolean) TO tr1_chatgpt_reader;
