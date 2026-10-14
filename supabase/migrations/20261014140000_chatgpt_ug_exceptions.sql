-- ChatGPT connector: scoped, explicit UG additions/replacements, preserving
-- trusted commercial price/discount and an auditable classification per line.
CREATE TABLE IF NOT EXISTS public.tr1_chatgpt_order_ug_overrides (
  order_item_id uuid PRIMARY KEY REFERENCES public.order_items(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('add','replace')),
  quantity integer NOT NULL CHECK (quantity BETWEEN 0 AND 9999),
  classification text NOT NULL CHECK (length(btrim(classification)) BETWEEN 2 AND 120),
  confirmed_by uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tr1_chatgpt_ug_positive_add CHECK (mode <> 'add' OR quantity > 0)
);
ALTER TABLE public.tr1_chatgpt_order_ug_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tr1_chatgpt_order_ug_overrides FROM PUBLIC, anon, authenticated, tr1_chatgpt_reader;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_ug_adjusted_preview(
  target_brand_pharmacy_id uuid, draft_items jsonb, adjustments jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  base jsonb;
  adjustment jsonb;
  item jsonb;
  updated_items jsonb := '[]'::jsonb;
  seen uuid[] := '{}'::uuid[];
  product_uuid uuid;
  match_adjustment jsonb;
  default_free integer;
  final_free integer;
  commercial_free integer;
  manual_free integer;
  change_quantity integer;
  change_mode text;
  change_classification text;
BEGIN
  -- The underlying preview enforces the OAuth caller, assigned pharmacy,
  -- trusted catalog prices and fresh TR1/HubSpot commercial conditions.
  base := public.tr1_chatgpt_priced_order_preview(target_brand_pharmacy_id,draft_items);
  IF jsonb_typeof(adjustments) IS DISTINCT FROM 'array'
     OR jsonb_array_length(adjustments) > 30 THEN
    RAISE EXCEPTION 'Invalid UG adjustments' USING ERRCODE = '22023';
  END IF;
  FOR adjustment IN SELECT value FROM jsonb_array_elements(adjustments) LOOP
    IF jsonb_typeof(adjustment) <> 'object'
       OR (SELECT count(*) FROM jsonb_object_keys(adjustment)) <> 4
       OR NOT (adjustment ?& ARRAY['product_id','mode','quantity','classification'])
       OR jsonb_typeof(adjustment->'product_id') <> 'string'
       OR jsonb_typeof(adjustment->'mode') <> 'string'
       OR jsonb_typeof(adjustment->'quantity') <> 'number'
       OR jsonb_typeof(adjustment->'classification') <> 'string'
       OR (adjustment->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR (adjustment->>'quantity') !~ '^[0-9]{1,4}$' THEN
      RAISE EXCEPTION 'Invalid UG override fields' USING ERRCODE = '22023';
    END IF;
    product_uuid := (adjustment->>'product_id')::uuid;
    change_mode := adjustment->>'mode';
    change_quantity := (adjustment->>'quantity')::integer;
    change_classification := adjustment->>'classification';
    IF product_uuid = ANY(seen)
       OR change_mode NOT IN ('add','replace')
       OR change_quantity NOT BETWEEN 0 AND 9999
       OR (change_mode = 'add' AND change_quantity = 0)
       OR change_classification NOT IN (
         'compensation opé promo','offre exceptionnelle sell-in','geste commercial',
         'échange périmé','échange déféctueux','litige logistique','cadeau challenge'
       )
       OR NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(base->'items') x
         WHERE (x->>'product_id')::uuid = product_uuid
       ) THEN
      RAISE EXCEPTION 'Duplicate, unjustified or out-of-basket UG adjustment'
        USING ERRCODE = '22023';
    END IF;
    seen := array_append(seen,product_uuid);
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(base->'items') LOOP
    SELECT a.value INTO match_adjustment
    FROM jsonb_array_elements(adjustments) a
    WHERE a.value->>'product_id' = item->>'product_id';
    default_free := (item->>'free_quantity')::integer;
    IF match_adjustment IS NULL THEN
      commercial_free := default_free;
      manual_free := 0;
      final_free := default_free;
      change_mode := 'standard';
      change_classification := NULL;
    ELSE
      change_mode := match_adjustment->>'mode';
      change_classification := match_adjustment->>'classification';
      manual_free := (match_adjustment->>'quantity')::integer;
      commercial_free := CASE WHEN change_mode='replace' THEN 0 ELSE default_free END;
      final_free := commercial_free + manual_free;
      IF final_free > 9999 THEN
        RAISE EXCEPTION 'Excessive UG after adjustment' USING ERRCODE='22023';
      END IF;
    END IF;
    updated_items := updated_items || jsonb_build_array(item || jsonb_build_object(
      'free_quantity',final_free,
      'commercial_free_quantity',commercial_free,
      'manual_free_quantity',manual_free,
      'ug_mode',change_mode,
      'ug_classification',change_classification,
      'standard_free_quantity',default_free
    ));
    match_adjustment := NULL;
  END LOOP;
  RETURN (base - 'items') || jsonb_build_object(
    'items',updated_items,'ug_adjustments',adjustments);
END;
$fn$;

-- Must apply only to an unsent draft owned by the current OAuth user.
-- The supplied list is the COMPLETE desired list of exceptions; [] restores
-- the verified standard UG rules. Never alters pharmacy-wide terms.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_set_draft_ug_adjustments(
  target_order_id uuid, request_id uuid, adjustments jsonb, confirmed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  ord record;
  basket jsonb;
  preview jsonb;
  item jsonb;
  stored record;
  row_id uuid;
  override_item jsonb;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true
     OR confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit authorized UG confirmation required' USING ERRCODE='42501';
  END IF;
  IF target_order_id IS NULL OR request_id IS NULL THEN
    RAISE EXCEPTION 'Order reference required' USING ERRCODE='22023';
  END IF;
  SELECT o.id,o.brand_id,o.brand_pharmacy_id,o.order_type,o.order_status,
         o.net_amount_ht,b.slug AS brand_slug
  INTO ord FROM public.orders o
  JOIN public.brands b ON b.id=o.brand_id
  WHERE o.id=target_order_id AND o.external_order_id='chatgpt:' || request_id::text
    AND o.created_by=auth.uid() AND o.archived_at IS NULL FOR UPDATE OF o;
  IF ord.id IS NULL OR ord.brand_slug <> 'naali'
     OR private.has_brand_role(ord.brand_id,ARRAY['agent']) IS DISTINCT FROM true
     OR private.user_is_assigned_to_relation(auth.uid(),ord.brand_pharmacy_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Unauthorized order scope' USING ERRCODE='42501';
  END IF;
  IF ord.order_status::text <> 'draft'
     OR ord.order_type::text NOT IN ('initial','reorder') THEN
    RAISE EXCEPTION 'Only unsubmitted Naali initial/reorder drafts support UG changes'
      USING ERRCODE='23505';
  END IF;
  SELECT coalesce(jsonb_agg(
    jsonb_build_object('product_id',oi.product_id,'quantity',oi.quantity)
    ORDER BY oi.product_id),'[]'::jsonb)
  INTO basket FROM public.order_items oi WHERE oi.order_id=ord.id;
  preview := public.tr1_chatgpt_ug_adjusted_preview(
    ord.brand_pharmacy_id,basket,adjustments);
  IF round(coalesce(ord.net_amount_ht,0),2) IS DISTINCT FROM
     round((preview->>'total_ht')::numeric,2) THEN
    RAISE EXCEPTION 'Draft total differs from verified commercial terms'
      USING ERRCODE='23505';
  END IF;
  -- Prices and discounts must have been persisted by the existing trusted
  -- priced-draft flow. Never repair injected prices or an unrelated draft.
  FOR item IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
    SELECT oi.id,oi.quantity,oi.unit_price_ht,oi.discount_rate,oi.tax_rate
    INTO stored FROM public.order_items oi
    WHERE oi.order_id=ord.id AND oi.product_id=(item->>'product_id')::uuid;
    IF NOT FOUND OR stored.quantity IS DISTINCT FROM (item->>'quantity')::integer
       OR stored.unit_price_ht IS DISTINCT FROM (item->>'unit_price_ht')::numeric
       OR stored.discount_rate IS DISTINCT FROM (item->>'discount_rate')::numeric
       OR stored.tax_rate IS DISTINCT FROM (item->>'tax_rate')::numeric THEN
      RAISE EXCEPTION 'Draft pricing mismatch: recreate trusted priced draft'
        USING ERRCODE='23505';
    END IF;
  END LOOP;

  DELETE FROM public.tr1_chatgpt_order_ug_overrides ov
    USING public.order_items oi
    WHERE ov.order_item_id=oi.id AND oi.order_id=ord.id;
  DELETE FROM public.order_item_free_unit_allocations a
    USING public.order_items oi
    WHERE a.order_item_id=oi.id AND oi.order_id=ord.id;

  FOR item IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
    SELECT oi.id INTO row_id FROM public.order_items oi
    WHERE oi.order_id=ord.id AND oi.product_id=(item->>'product_id')::uuid;
    UPDATE public.order_items SET free_quantity=(item->>'free_quantity')::integer
    WHERE id=row_id;
    IF (item->>'commercial_free_quantity')::integer > 0 THEN
      INSERT INTO public.order_item_free_unit_allocations
        (order_item_id,organization_id,brand_id,source,quantity,classification)
      SELECT row_id,oi.organization_id,oi.brand_id,'commercial_terms',
        (item->>'commercial_free_quantity')::integer,'conditions commerciales client'
      FROM public.order_items oi WHERE oi.id=row_id;
    END IF;
    IF (item->>'manual_free_quantity')::integer > 0 THEN
      INSERT INTO public.order_item_free_unit_allocations
        (order_item_id,organization_id,brand_id,source,quantity,classification)
      SELECT row_id,oi.organization_id,oi.brand_id,'manual',
        (item->>'manual_free_quantity')::integer,(item->>'ug_classification')
      FROM public.order_items oi WHERE oi.id=row_id;
    END IF;
    IF item->>'ug_mode' IN ('add','replace') THEN
      INSERT INTO public.tr1_chatgpt_order_ug_overrides
        (order_item_id,mode,quantity,classification,confirmed_by)
      VALUES (row_id,item->>'ug_mode',(item->>'manual_free_quantity')::integer,
        item->>'ug_classification',auth.uid());
    END IF;
  END LOOP;
  RETURN preview || jsonb_build_object(
    'order_id',ord.id,'status','draft','adjustments_applied',true,
    'transmitted',false,'review_required',true);
END;
$fn$;

-- The normal review/submit pair is unchanged for standard orders. When a
-- classified exception exists, review recalculates the adjusted snapshot,
-- verifies the corresponding commercial/manual allocations, and includes
-- the exception details in the confirmation fingerprint.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_review_priced_order(
  target_order_id uuid, request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  o record;
  basket jsonb;
  preview jsonb;
  adjustments jsonb;
  item jsonb;
  stored record;
  item_count integer;
  review_fingerprint text;
  commercial_alloc integer;
  manual_alloc integer;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE='42501';
  END IF;
  IF target_order_id IS NULL OR request_id IS NULL THEN
    RAISE EXCEPTION 'Order and request ID required' USING ERRCODE='22023';
  END IF;
  SELECT ord.id,ord.brand_id,ord.brand_pharmacy_id,ord.order_type,
         ord.order_status,ord.order_number,ord.net_amount_ht,
         br.slug AS brand_slug
  INTO o FROM public.orders ord
  JOIN public.brands br ON br.id=ord.brand_id
  JOIN public.brand_pharmacies bp ON bp.id=ord.brand_pharmacy_id
  WHERE ord.id=target_order_id
    AND ord.external_order_id='chatgpt:' || request_id::text
    AND ord.created_by=auth.uid()
    AND ord.archived_at IS NULL AND bp.archived_at IS NULL;
  IF o.id IS NULL OR o.brand_slug <> 'naali'
     OR private.has_brand_role(o.brand_id,ARRAY['agent']) IS DISTINCT FROM true
     OR private.user_is_assigned_to_relation(auth.uid(),o.brand_pharmacy_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Order access denied' USING ERRCODE='42501';
  END IF;
  IF o.order_status::text NOT IN ('draft','pending')
     OR o.order_type::text NOT IN ('initial','reorder') THEN
    RAISE EXCEPTION 'Order status/type unsupported' USING ERRCODE='22023';
  END IF;
  SELECT count(*),coalesce(jsonb_agg(
    jsonb_build_object('product_id',oi.product_id,'quantity',oi.quantity)
    ORDER BY oi.product_id),'[]'::jsonb)
  INTO item_count,basket FROM public.order_items oi WHERE oi.order_id=o.id;
  IF item_count NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid order line count' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'product_id',oi.product_id,'mode',ov.mode,'quantity',ov.quantity,
    'classification',ov.classification) ORDER BY oi.product_id),'[]'::jsonb)
  INTO adjustments
  FROM public.tr1_chatgpt_order_ug_overrides ov
  JOIN public.order_items oi ON oi.id=ov.order_item_id WHERE oi.order_id=o.id;

  IF jsonb_array_length(adjustments)>0 THEN
    preview:=public.tr1_chatgpt_ug_adjusted_preview(
      o.brand_pharmacy_id,basket,adjustments);
  ELSE
    preview:=public.tr1_chatgpt_priced_order_preview(o.brand_pharmacy_id,basket);
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
    SELECT oi.id,oi.product_id,oi.quantity,oi.free_quantity,
      oi.unit_price_ht,oi.discount_rate,oi.tax_rate
    INTO stored FROM public.order_items oi
    WHERE oi.order_id=o.id AND oi.product_id=(item->>'product_id')::uuid;
    IF NOT FOUND
      OR stored.quantity IS DISTINCT FROM (item->>'quantity')::integer
      OR stored.free_quantity IS DISTINCT FROM (item->>'free_quantity')::integer
      OR stored.unit_price_ht IS DISTINCT FROM (item->>'unit_price_ht')::numeric
      OR stored.discount_rate IS DISTINCT FROM (item->>'discount_rate')::numeric
      OR stored.tax_rate IS DISTINCT FROM (item->>'tax_rate')::numeric THEN
      RAISE EXCEPTION 'Draft values changed: review or recreate' USING ERRCODE='23505';
    END IF;
    IF jsonb_array_length(adjustments)>0 THEN
      SELECT
        coalesce(sum(a.quantity) FILTER (WHERE a.source='commercial_terms'),0),
        coalesce(sum(a.quantity) FILTER (WHERE a.source='manual'),0)
      INTO commercial_alloc,manual_alloc
      FROM public.order_item_free_unit_allocations a
      WHERE a.order_item_id=stored.id;
      IF commercial_alloc <> (item->>'commercial_free_quantity')::integer
        OR manual_alloc <> (item->>'manual_free_quantity')::integer THEN
        RAISE EXCEPTION 'UG allocation does not match confirmed exception'
          USING ERRCODE='23505';
      END IF;
    END IF;
  END LOOP;
  IF round(coalesce(o.net_amount_ht,0),2) IS DISTINCT FROM
    round((preview->>'total_ht')::numeric,2) THEN
    RAISE EXCEPTION 'Draft total mismatch' USING ERRCODE='23505';
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
    'hubspot_synced',false,
    'ug_adjustments',adjustments
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.tr1_chatgpt_ug_adjusted_preview(uuid,jsonb,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_set_draft_ug_adjustments(uuid,uuid,jsonb,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_ug_adjusted_preview(uuid,jsonb,jsonb)
  TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_set_draft_ug_adjustments(uuid,uuid,jsonb,boolean)
  TO tr1_chatgpt_reader;
