-- A Black Friday preorder has independently approved UG, not the pharmacy's
-- default 12+2 rule. Gifts are promotional items, never UG or paid catalog stock.
-- Explicit OAuth-only confirmation and two-phase review are mandatory.
CREATE TABLE IF NOT EXISTS public.tr1_chatgpt_trade_preorders (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  brand_pharmacy_id uuid NOT NULL REFERENCES public.brand_pharmacies(id),
  source_order_number text NOT NULL CHECK (length(source_order_number) BETWEEN 1 AND 80),
  campaign text NOT NULL CHECK (campaign = 'black_friday_2026'),
  gift_antistress_quantity integer NOT NULL CHECK (gift_antistress_quantity BETWEEN 0 AND 9999),
  gift_dream_quantity integer NOT NULL CHECK (gift_dream_quantity BETWEEN 0 AND 9999),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tr1_trade_preorders_source_unique
    UNIQUE (brand_pharmacy_id, source_order_number)
);
ALTER TABLE public.tr1_chatgpt_trade_preorders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tr1_chatgpt_trade_preorders FROM PUBLIC,anon,authenticated;

-- Trusted discount and catalog only; clients may supply quantities of UG but
-- never prices, discounts, or bonus marketing quantities.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_trade_preorder_preview(
  target_brand_pharmacy_id uuid, draft_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  rel record;
  terms record;
  p record;
  line jsonb;
  pid uuid;
  qty integer;
  ug integer;
  seen uuid[] := '{}'::uuid[];
  disc numeric;
  ht numeric;
  vat numeric;
  total_ht numeric := 0;
  total_vat numeric := 0;
  paid_total integer := 0;
  ug_total integer := 0;
  gift_total integer;
  lines jsonb := '[]'::jsonb;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE='42501';
  END IF;
  IF target_brand_pharmacy_id IS NULL OR jsonb_typeof(draft_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(draft_items) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid trade preorder lines' USING ERRCODE='22023';
  END IF;
  SELECT bp.id,bp.brand_id,b.slug INTO rel
  FROM public.brand_pharmacies bp JOIN public.brands b ON b.id=bp.brand_id
  WHERE bp.id=target_brand_pharmacy_id AND bp.archived_at IS NULL;
  IF rel.id IS NULL OR rel.slug <> 'naali'
     OR private.has_brand_role(rel.brand_id,ARRAY['agent']) IS DISTINCT FROM true
     OR private.user_is_assigned_to_relation(auth.uid(),rel.id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Brand pharmacy forbidden' USING ERRCODE='42501';
  END IF;
  SELECT t.discount_rate,t.hubspot_discount_rate,t.hubspot_synced_at
  INTO terms FROM public.brand_pharmacy_commercial_terms t
  WHERE t.brand_pharmacy_id=rel.id AND t.brand_id=rel.brand_id;
  disc:=coalesce(terms.discount_rate,terms.hubspot_discount_rate);
  IF disc IS NULL OR disc NOT BETWEEN 0 AND 100
     OR terms.hubspot_synced_at IS NULL
     OR terms.hubspot_synced_at < now()-interval '24 hours' THEN
    RAISE EXCEPTION 'Naali HubSpot discount missing or stale' USING ERRCODE='22023';
  END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(draft_items) LOOP
    IF jsonb_typeof(line) <> 'object'
       OR jsonb_typeof(line->'product_id') <> 'string'
       OR jsonb_typeof(line->'quantity') <> 'number'
       OR jsonb_typeof(line->'free_quantity') <> 'number'
       OR (line->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR (line->>'quantity') !~ '^[0-9]{1,4}$'
       OR (line->>'free_quantity') !~ '^[0-9]{1,4}$' THEN
      RAISE EXCEPTION 'Invalid trade preorder item' USING ERRCODE='22023';
    END IF;
    pid:=(line->>'product_id')::uuid;
    qty:=(line->>'quantity')::integer;
    ug:=(line->>'free_quantity')::integer;
    IF pid=ANY(seen) OR qty NOT BETWEEN 1 AND 9999 OR ug NOT BETWEEN 0 AND 9999
       OR qty+ug>9999 THEN
      RAISE EXCEPTION 'Duplicate or invalid trade quantities' USING ERRCODE='22023';
    END IF;
    seen:=array_append(seen,pid);
    SELECT id,name,ean,sku,wholesale_price_ht,tax_rate,minimum_order_quantity
    INTO p FROM public.products
    WHERE id=pid AND brand_id=rel.brand_id AND is_active
       AND discontinued_at IS NULL AND is_pharmacy_eligible;
    IF p.id IS NULL OR p.wholesale_price_ht IS NULL OR p.wholesale_price_ht < 0
       OR p.tax_rate IS NULL
       OR (p.minimum_order_quantity IS NOT NULL AND qty < p.minimum_order_quantity)
       OR p.sku IN ('1tdahfraise','1antistress60fdb') THEN
      RAISE EXCEPTION 'Unavailable/discontinued campaign product, price or minimum' USING ERRCODE='22023';
    END IF;
    ht:=round(qty*p.wholesale_price_ht*(1-disc/100),2);
    vat:=round(ht*p.tax_rate/100,2);
    total_ht:=total_ht+ht;
    total_vat:=total_vat+vat;
    paid_total:=paid_total+qty;
    ug_total:=ug_total+ug;
    lines:=lines||jsonb_build_array(jsonb_build_object(
      'product_id',p.id,'name',p.name,'ean',p.ean,
      'quantity',qty,'free_quantity',ug,
      'ug_classification','conditions commerciales client',
      'unit_price_ht',p.wholesale_price_ht,'discount_rate',disc,
      'tax_rate',p.tax_rate,'line_total_ht',ht
    ));
  END LOOP;
  gift_total:=paid_total+ug_total;
  IF gift_total>9999 OR gift_total % 2 <> 0 THEN
    RAISE EXCEPTION 'Black Friday gifts must split evenly, within quantity limit'
      USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object(
    'brand_pharmacy_id',rel.id,'campaign','black_friday_2026',
    'order_type','reorder','hubspot_stage','Précommande',
    'hubspot_preorder_type','Précommande Opération Trade',
    'hubspot_reason','Black Friday 2026',
    'items',lines,'paid_quantity',paid_total,'ug_quantity',ug_total,
    'gift_antistress_quantity',gift_total/2,'gift_dream_quantity',gift_total/2,
    'gift_total',gift_total,'total_ht',total_ht,'vat',total_vat,
    'total_ttc',total_ht+total_vat,'transmitted',false,'status','preview'
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_create_trade_preorder_draft(
  target_brand_pharmacy_id uuid,draft_items jsonb,
  source_order_number text,request_id uuid,confirmed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  preview jsonb;
  result jsonb;
  order_uuid uuid;
  brand_uuid uuid;
  ref text;
  item jsonb;
  stored record;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true
     OR confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Authorized explicit draft confirmation required' USING ERRCODE='42501';
  END IF;
  ref:=btrim(source_order_number);
  IF request_id IS NULL OR ref IS NULL OR length(ref) NOT BETWEEN 1 AND 80
     OR ref ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid source order reference' USING ERRCODE='22023';
  END IF;
  preview:=public.tr1_chatgpt_trade_preorder_preview(target_brand_pharmacy_id,draft_items);
  SELECT brand_id INTO brand_uuid FROM public.brand_pharmacies
  WHERE id=target_brand_pharmacy_id;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('trade-preorder|'||brand_uuid::text||'|'||ref,0));
  -- Fail closed if this source reference is present on ANY nonarchived TR1
  -- order for the same brand, except for this exact OAuth request UUID.
  IF EXISTS(SELECT 1 FROM public.orders o WHERE o.brand_id=brand_uuid
    AND o.archived_at IS NULL AND (o.order_number=ref OR o.external_order_id=ref)
    AND o.external_order_id IS DISTINCT FROM 'chatgpt:'||request_id::text) THEN
    RAISE EXCEPTION 'Source order already exists in TR1' USING ERRCODE='23505';
  END IF;
  SELECT * INTO stored FROM public.tr1_chatgpt_trade_preorders tp
  JOIN public.orders o ON o.id=tp.order_id
  WHERE o.external_order_id='chatgpt:'||request_id::text AND o.created_by=auth.uid();
  -- Base OAuth-bound draft validates product minimums and request idempotency.
  result:=public.tr1_chatgpt_create_order_draft(
    target_brand_pharmacy_id,
    (SELECT jsonb_agg(jsonb_build_object(
      'product_id',x.value->>'product_id','quantity',(x.value->>'quantity')::integer))
     FROM jsonb_array_elements(draft_items) x),
    'reorder','',request_id,true);
  order_uuid:=(result->>'order_id')::uuid;
  IF (result->>'created')::boolean THEN
    UPDATE public.orders SET order_number=ref, notes=
      'Précommande Opération Trade — Black Friday 2026 ; cadeaux consommateurs inclus.'
    WHERE id=order_uuid AND order_status='draft';
    FOR item IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
      UPDATE public.order_items
      SET free_quantity=(item->>'free_quantity')::integer,
          discount_rate=(item->>'discount_rate')::numeric,
          discount_amount_ht=round((item->>'quantity')::numeric*
            (item->>'unit_price_ht')::numeric*(item->>'discount_rate')::numeric/100,2)
      WHERE order_id=order_uuid AND product_id=(item->>'product_id')::uuid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Preorder item not persisted' USING ERRCODE='23514';
      END IF;
      IF (item->>'free_quantity')::integer>0 THEN
        INSERT INTO public.order_item_free_unit_allocations
          (order_item_id,organization_id,brand_id,source,quantity,classification)
        SELECT oi.id,oi.organization_id,oi.brand_id,'commercial_terms',
          (item->>'free_quantity')::integer,'conditions commerciales client'
        FROM public.order_items oi
        WHERE oi.order_id=order_uuid AND oi.product_id=(item->>'product_id')::uuid;
      END IF;
    END LOOP;
    INSERT INTO public.tr1_chatgpt_trade_preorders(
      order_id,brand_pharmacy_id,source_order_number,campaign,
      gift_antistress_quantity,gift_dream_quantity,created_by
    ) VALUES(order_uuid,target_brand_pharmacy_id,ref,'black_friday_2026',
      (preview->>'gift_antistress_quantity')::integer,
      (preview->>'gift_dream_quantity')::integer,auth.uid());
  ELSE
    IF stored.order_id IS DISTINCT FROM order_uuid
       OR stored.source_order_number IS DISTINCT FROM ref
       OR stored.brand_pharmacy_id IS DISTINCT FROM target_brand_pharmacy_id THEN
      RAISE EXCEPTION 'Request ID already used outside this preorder' USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN public.tr1_chatgpt_review_trade_preorder(order_uuid,request_id)
    ||jsonb_build_object('created',result->'created','transmitted',false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_review_trade_preorder(
  target_order_id uuid,request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  ord record;
  basket jsonb;
  preview jsonb;
  item jsonb;
  stored record;
  review_token text;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true
     OR request_id IS NULL OR target_order_id IS NULL THEN
    RAISE EXCEPTION 'Authorized order reference required' USING ERRCODE='42501';
  END IF;
  SELECT o.id,o.brand_id,o.brand_pharmacy_id,o.order_number,
    o.order_status,o.net_amount_ht, tp.campaign,tp.source_order_number,
    tp.gift_antistress_quantity,tp.gift_dream_quantity
  INTO ord FROM public.orders o
  JOIN public.tr1_chatgpt_trade_preorders tp ON tp.order_id=o.id
  WHERE o.id=target_order_id AND o.external_order_id='chatgpt:'||request_id::text
    AND o.created_by=auth.uid() AND o.archived_at IS NULL;
  IF ord.id IS NULL OR ord.order_status::text NOT IN ('draft','pending')
    OR private.has_brand_role(ord.brand_id,ARRAY['agent']) IS DISTINCT FROM true
    OR private.user_is_assigned_to_relation(auth.uid(),ord.brand_pharmacy_id)
         IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Preorder access or status invalid' USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'product_id',oi.product_id,'quantity',oi.quantity,
    'free_quantity',oi.free_quantity) ORDER BY oi.product_id),'[]'::jsonb)
  INTO basket FROM public.order_items oi WHERE oi.order_id=ord.id;
  preview:=public.tr1_chatgpt_trade_preorder_preview(ord.brand_pharmacy_id,basket);
  IF ord.order_number IS DISTINCT FROM ord.source_order_number
     OR round(ord.net_amount_ht,2) IS DISTINCT FROM
        round((preview->>'total_ht')::numeric,2)
     OR ord.gift_antistress_quantity IS DISTINCT FROM
        (preview->>'gift_antistress_quantity')::integer
     OR ord.gift_dream_quantity IS DISTINCT FROM
        (preview->>'gift_dream_quantity')::integer THEN
    RAISE EXCEPTION 'Preorder totals or gifts changed since creation'
      USING ERRCODE='23505';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
    SELECT oi.id,oi.unit_price_ht,oi.discount_rate,oi.tax_rate,
      oi.free_quantity,oi.quantity INTO stored
    FROM public.order_items oi
    WHERE oi.order_id=ord.id AND oi.product_id=(item->>'product_id')::uuid;
    IF NOT FOUND OR stored.quantity IS DISTINCT FROM (item->>'quantity')::integer
       OR stored.free_quantity IS DISTINCT FROM (item->>'free_quantity')::integer
       OR stored.unit_price_ht IS DISTINCT FROM (item->>'unit_price_ht')::numeric
       OR stored.discount_rate IS DISTINCT FROM (item->>'discount_rate')::numeric
       OR stored.tax_rate IS DISTINCT FROM (item->>'tax_rate')::numeric
       OR (SELECT coalesce(sum(a.quantity),0) FROM public.order_item_free_unit_allocations a
           WHERE a.order_item_id=stored.id AND a.source='commercial_terms'
             AND a.classification='conditions commerciales client')
          IS DISTINCT FROM (item->>'free_quantity')::integer THEN
      RAISE EXCEPTION 'Preorder item or UG classification changed'
        USING ERRCODE='23505';
    END IF;
  END LOOP;
  review_token:=md5(ord.id::text||':'||ord.source_order_number||':'||
    (preview->'items')::text||':'||(preview->>'total_ht')||':'||
    ord.gift_antistress_quantity::text||':'||ord.gift_dream_quantity::text);
  RETURN preview||jsonb_build_object('order_id',ord.id,
    'source_order_number',ord.source_order_number,'status',ord.order_status,
    'review_token',review_token,'review_required',true,'hubspot_synced',false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_submit_trade_preorder(
  target_order_id uuid,request_id uuid,review_token text,confirmed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  o record;
  reviewed jsonb;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true
     OR confirmed IS DISTINCT FROM true OR target_order_id IS NULL
     OR request_id IS NULL OR review_token !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Authorized reviewed submission required' USING ERRCODE='42501';
  END IF;
  SELECT ord.id,ord.order_status INTO o FROM public.orders ord
  JOIN public.tr1_chatgpt_trade_preorders tp ON tp.order_id=ord.id
  WHERE ord.id=target_order_id AND ord.external_order_id='chatgpt:'||request_id::text
    AND ord.created_by=auth.uid() AND ord.archived_at IS NULL FOR UPDATE OF ord;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Preorder access denied' USING ERRCODE='42501';
  END IF;
  reviewed:=public.tr1_chatgpt_review_trade_preorder(target_order_id,request_id);
  IF reviewed->>'review_token' IS DISTINCT FROM review_token THEN
    RAISE EXCEPTION 'Preorder changed since review' USING ERRCODE='23505';
  END IF;
  IF o.order_status::text='draft' THEN
    PERFORM public.change_order_status(target_order_id,'pending'::public.order_status,NULL);
    RETURN jsonb_build_object('order_id',o.id,'status','pending',
      'submitted',true,'already_submitted',false,'hubspot_synced',false,
      'campaign','black_friday_2026');
  END IF;
  IF o.order_status::text='pending' THEN
    RETURN jsonb_build_object('order_id',o.id,'status','pending',
      'submitted',true,'already_submitted',true,'hubspot_synced',false,
      'campaign','black_friday_2026');
  END IF;
  RAISE EXCEPTION 'Preorder status invalid for submission' USING ERRCODE='23505';
END;
$fn$;

REVOKE ALL ON FUNCTION public.tr1_chatgpt_trade_preorder_preview(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_create_trade_preorder_draft(uuid,jsonb,text,uuid,boolean)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_review_trade_preorder(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_submit_trade_preorder(uuid,uuid,text,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_trade_preorder_preview(uuid,jsonb)
  TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_create_trade_preorder_draft(uuid,jsonb,text,uuid,boolean)
  TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_review_trade_preorder(uuid,uuid)
  TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_submit_trade_preorder(uuid,uuid,text,boolean)
  TO tr1_chatgpt_reader;
