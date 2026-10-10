-- ChatGPT MCP phase 2 (review-only migration): narrow user-scoped catalog/agenda reads
-- and explicit write tools limited to planned visits and unsent order drafts.
-- OAuth reader has NO direct table grants; every function must check the JWT client.
-- Do not apply to production until staging, OAuth, and authorization tests pass.

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_catalog(
  target_brand_id uuid, search_text text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE answer jsonb;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF target_brand_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.get_my_brand_contexts() b WHERE b.brand_id = target_brand_id
  ) THEN
    RAISE EXCEPTION 'Brand forbidden' USING ERRCODE = '42501';
  END IF;
  IF search_text IS NOT NULL AND length(search_text) > 120 THEN
    RAISE EXCEPTION 'Search too long' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.name), '[]'::jsonb)
  INTO answer
  FROM (
    SELECT id, name, sku, ean, wholesale_price_ht, tax_rate,
           minimum_order_quantity, units_per_case
    FROM public.products
    WHERE brand_id = target_brand_id
      AND is_active AND discontinued_at IS NULL AND is_pharmacy_eligible
      AND (NULLIF(btrim(search_text), '') IS NULL OR
        name ILIKE '%' || btrim(search_text) || '%' OR
        sku ILIKE '%' || btrim(search_text) || '%')
    ORDER BY name, id LIMIT 50
  ) p;
  RETURN answer;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_agenda(
  start_date date, end_date date
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE answer jsonb;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF start_date IS NULL OR end_date IS NULL OR end_date < start_date OR
     end_date > start_date + 14 THEN
    RAISE EXCEPTION 'Agenda range must be 1 to 15 calendar days' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.start_at), '[]'::jsonb)
  INTO answer FROM (
    SELECT source_kind, source_id, title, start_at, end_at,
           pharmacy_id, pharmacy_name, city, brand_names, status, event_type
    FROM public.get_my_field_agenda(start_date, end_date, NULL)
    WHERE ownership = 'mine'
    ORDER BY start_at, source_id
    LIMIT 150
  ) e;
  RETURN answer;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_create_planned_visit(
  target_pharmacy_id uuid,
  target_brand_pharmacy_ids uuid[],
  visit_kind text,
  visit_title text,
  visit_objective text,
  start_at timestamptz,
  end_at timestamptz,
  confirmed boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  existing_id uuid;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit confirmation required' USING ERRCODE = '42501';
  END IF;
  IF target_pharmacy_id IS NULL OR target_brand_pharmacy_ids IS NULL
     OR cardinality(target_brand_pharmacy_ids) NOT BETWEEN 1 AND 5
     OR array_position(target_brand_pharmacy_ids,NULL) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(target_brand_pharmacy_ids) x) <> cardinality(target_brand_pharmacy_ids)
     OR visit_kind IS NULL OR visit_kind NOT IN ('client_visit','prospecting','relationship','training','other')
     OR visit_title IS NULL OR length(btrim(visit_title)) NOT BETWEEN 2 AND 160
     OR length(coalesce(visit_objective,'')) > 1000
     OR start_at IS NULL OR end_at IS NULL
     OR start_at <= now() OR start_at > now() + interval '180 days'
     OR end_at <= start_at + interval '14 minutes'
     OR end_at > start_at + interval '4 hours' THEN
    RAISE EXCEPTION 'Invalid visit parameters' USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent AI creates for one user so overlap detection is effective.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chatgpt-visit|' || auth.uid()::text,0)
  );

  -- Reusing the exact existing visit is safe and preserves multibrand identity.
  SELECT id INTO existing_id
  FROM public.field_visits
  WHERE owner_user_id = auth.uid()
    AND pharmacy_id = target_pharmacy_id
    AND scheduled_start_at = start_at
    AND scheduled_end_at = end_at
    AND archived_at IS NULL AND status <> 'cancelled'
  ORDER BY created_at LIMIT 1;
  IF existing_id IS NULL AND EXISTS (
    SELECT 1 FROM public.field_visits
    WHERE owner_user_id = auth.uid() AND archived_at IS NULL AND status <> 'cancelled'
      AND scheduled_start_at < end_at AND scheduled_end_at > start_at
  ) THEN
    RAISE EXCEPTION 'Overlapping existing visit; review the agenda' USING ERRCODE = '23514';
  END IF;

  RETURN public.create_field_visit(
    target_pharmacy_id,
    jsonb_build_object(
      'visit_kind', visit_kind, 'title', btrim(visit_title),
      'objective', nullif(btrim(coalesce(visit_objective,'')),''),
      'scheduled_start_at', start_at, 'scheduled_end_at', end_at,
      'notes', 'Créée depuis ChatGPT après confirmation'
    ),
    target_brand_pharmacy_ids
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_create_order_draft(
  target_brand_pharmacy_id uuid,
  draft_items jsonb,
  order_type text,
  note text,
  request_id uuid,
  confirmed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  rel record;
  item jsonb;
  product record;
  item_ids uuid[] := '{}'::uuid[];
  items jsonb := '[]'::jsonb;
  qty integer;
  item_id uuid;
  existing_order_id uuid;
  existing_relation_id uuid;
  existing_order_status public.order_status;
  existing_order_type public.order_type;
  existing_lines jsonb;
  requested_lines jsonb;
  created_order_id uuid;
  external_key text;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit confirmation required' USING ERRCODE = '42501';
  END IF;
  IF target_brand_pharmacy_id IS NULL OR request_id IS NULL
     OR (CASE WHEN jsonb_typeof(draft_items) = 'array'
       THEN jsonb_array_length(draft_items) ELSE 0 END) NOT BETWEEN 1 AND 30
     OR order_type IS NULL OR order_type NOT IN ('initial','reorder','complementary','replacement','sample','return','credit_note','other')
     OR length(coalesce(note,'')) > 1000 THEN
    RAISE EXCEPTION 'Invalid draft request' USING ERRCODE = '22023';
  END IF;
  SELECT bp.id, bp.brand_id INTO rel
  FROM public.brand_pharmacies bp
  WHERE bp.id = target_brand_pharmacy_id AND bp.archived_at IS NULL;

  -- A ChatGPT caller may only draft orders for assigned agent accounts.
  IF rel.id IS NULL
     OR private.has_brand_role(rel.brand_id, ARRAY['agent']) IS DISTINCT FROM true
     OR private.user_is_assigned_to_relation(auth.uid(), rel.id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Brand pharmacy forbidden' USING ERRCODE = '42501';
  END IF;
  external_key := 'chatgpt:' || request_id::text;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chatgpt-draft|' || rel.brand_id::text || '|' || external_key,0)
  );
  FOR item IN SELECT value FROM jsonb_array_elements(draft_items)
  LOOP
    IF jsonb_typeof(item) <> 'object' OR
       NOT (item ? 'product_id' AND item ? 'quantity') OR
       jsonb_typeof(item->'product_id') <> 'string' OR
       jsonb_typeof(item->'quantity') <> 'number' OR
       (item->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
       (item->>'quantity') !~ '^[0-9]{1,4}$' THEN
      RAISE EXCEPTION 'Invalid product or quantity' USING ERRCODE = '22023';
    END IF;
    item_id := (item->>'product_id')::uuid;
    qty := (item->>'quantity')::integer;
    IF qty NOT BETWEEN 1 AND 9999 OR item_id = ANY(item_ids) THEN
      RAISE EXCEPTION 'Invalid or duplicated product' USING ERRCODE = '22023';
    END IF;
    item_ids := array_append(item_ids,item_id);

    SELECT p.id, p.wholesale_price_ht, p.tax_rate, p.minimum_order_quantity
    INTO product FROM public.products p
    WHERE p.id = item_id AND p.brand_id = rel.brand_id AND p.is_active
      AND p.discontinued_at IS NULL AND p.is_pharmacy_eligible;
    IF product.id IS NULL OR product.wholesale_price_ht IS NULL OR product.wholesale_price_ht < 0
       OR product.tax_rate IS NULL OR (product.minimum_order_quantity IS NOT NULL
           AND qty < product.minimum_order_quantity) THEN
      RAISE EXCEPTION 'Unavailable product, price or minimum quantity' USING ERRCODE = '22023';
    END IF;

    items := items || jsonb_build_array(jsonb_build_object(
      'product_id', item_id, 'quantity', qty, 'free_quantity', 0,
      'unit_price_ht', product.wholesale_price_ht, 'discount_rate', NULL,
      'tax_rate', product.tax_rate
    ));
  END LOOP;

  -- Idempotence must not falsely report a subsequently submitted order as a draft,
  -- or silently accept the same request UUID for a different pharmacy/line basket.
  SELECT o.id, o.brand_pharmacy_id, o.order_status, o.order_type
    INTO existing_order_id, existing_relation_id, existing_order_status, existing_order_type
  FROM public.orders o
  WHERE o.brand_id = rel.brand_id AND o.external_order_id = external_key
    AND o.created_by = auth.uid() AND o.archived_at IS NULL;
  IF existing_order_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('product_id', oi.product_id, 'quantity', oi.quantity)
      ORDER BY oi.product_id
    ), '[]'::jsonb)
    INTO existing_lines
    FROM public.order_items oi WHERE oi.order_id = existing_order_id;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('product_id', (line->>'product_id')::uuid, 'quantity', (line->>'quantity')::integer)
      ORDER BY (line->>'product_id')::uuid
    ), '[]'::jsonb)
    INTO requested_lines FROM jsonb_array_elements(items) line;

    IF existing_relation_id IS DISTINCT FROM rel.id
       OR existing_order_type::text IS DISTINCT FROM order_type
       OR existing_order_status::text IS DISTINCT FROM 'draft'
       OR existing_lines IS DISTINCT FROM requested_lines THEN
      RAISE EXCEPTION 'Request ID belongs to a changed or non-draft order; use a new request ID'
        USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object('order_id', existing_order_id, 'status', 'draft',
      'created', false, 'transmitted', false, 'review_required', true);
  END IF;

  SELECT order_id INTO created_order_id FROM public.create_order_with_pharmacy_resolution(
    rel.brand_id, rel.id, NULL, NULL,
    jsonb_build_object(
      'external_order_id', external_key, 'order_type', order_type,
      'order_status', 'draft', 'source', 'manual', 'order_date', now(),
      'shipping_amount_ht', 0,
      'notes', concat_ws(E'\n',
        'Brouillon ChatGPT : prix catalogue HT ; remise, UG et frais de port à vérifier dans TR1 avant envoi.',
        NULLIF(btrim(coalesce(note,'')),''))
    ),
    items
  );
  RETURN jsonb_build_object(
    'order_id', created_order_id, 'status', 'draft', 'created', true,
    'transmitted', false, 'review_required', true
  );
END;
$fn$;

-- Do not grant table access, generic mutations, or ownership to the OAuth role.
REVOKE ALL ON FUNCTION public.tr1_chatgpt_catalog(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_agenda(date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_create_planned_visit(uuid,uuid[],text,text,text,timestamptz,timestamptz,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_create_order_draft(uuid,jsonb,text,text,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_catalog(uuid,text) TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_agenda(date,date) TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_create_planned_visit(uuid,uuid[],text,text,text,timestamptz,timestamptz,boolean) TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_create_order_draft(uuid,jsonb,text,text,uuid,boolean) TO tr1_chatgpt_reader;
