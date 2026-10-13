-- Expose trusted, previously synchronized HubSpot commercial conditions on the
-- authorized pharmacy summary. Does not change orders or override source data.
-- The authorization check must precede any commercial-term lookup.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_pharmacy_summary(target_brand_pharmacy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  source jsonb;
  terms record;
  effective_discount numeric;
  effective_paid integer;
  effective_free integer;
  discount_origin text;
  free_origin text;
  normalized_lead text;
  conditions jsonb := null;
BEGIN
  IF private.tr1_chatgpt_authorized() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;

  -- The canonical field-summary RPC independently checks pharmacy assignment.
  source := public.get_field_pharmacy_summary(target_brand_pharmacy_id);
  IF source IS NULL THEN RETURN NULL; END IF;

  SELECT t.* INTO terms
  FROM public.brand_pharmacy_commercial_terms t
  JOIN public.brand_pharmacies bp
    ON bp.id = t.brand_pharmacy_id AND bp.brand_id = t.brand_id
  WHERE t.brand_pharmacy_id = target_brand_pharmacy_id
    AND bp.archived_at IS NULL;

  IF FOUND THEN
    effective_discount := coalesce(terms.discount_rate,terms.hubspot_discount_rate);
    effective_paid := coalesce(terms.ug_paid_quantity,terms.hubspot_ug_paid_quantity);
    effective_free := coalesce(terms.ug_free_quantity,terms.hubspot_ug_free_quantity);
    discount_origin := CASE
      WHEN terms.discount_rate IS NOT NULL THEN 'tr1_override'
      WHEN terms.hubspot_discount_rate IS NOT NULL THEN 'hubspot'
      ELSE NULL
    END;
    free_origin := CASE
      WHEN terms.ug_paid_quantity IS NOT NULL THEN 'tr1_override'
      WHEN terms.hubspot_ug_paid_quantity IS NOT NULL THEN 'hubspot_field'
      ELSE NULL
    END;

    normalized_lead := lower(btrim(coalesce(terms.hubspot_lead_status,'')));
    IF terms.ug_paid_quantity IS NULL AND normalized_lead = 'client ambassadeur' THEN
      effective_paid := 12; effective_free := 2;
      free_origin := 'hubspot_lead_status';
    ELSIF terms.ug_paid_quantity IS NULL AND normalized_lead = 'client partenaire' THEN
      effective_paid := 12; effective_free := 1;
      free_origin := 'hubspot_lead_status';
    END IF;

    conditions := jsonb_build_object(
      'discount_rate',effective_discount,
      'discount_source',discount_origin,
      'free_units',CASE
        WHEN effective_paid IS NOT NULL AND effective_free IS NOT NULL THEN
          jsonb_build_object('paid_quantity',effective_paid,'free_quantity',effective_free,
            'label',effective_paid::text || '+' || effective_free::text)
        ELSE NULL
      END,
      'free_units_source',free_origin,
      'potential',terms.hubspot_potential,
      'lead_status',terms.hubspot_lead_status,
      'hubspot_synced_at',terms.hubspot_synced_at,
      'hubspot_stale',terms.hubspot_synced_at IS NULL OR
        terms.hubspot_synced_at < now() - interval '24 hours'
    );
  END IF;

  RETURN jsonb_build_object(
    'brand_pharmacy_id',source->>'brand_pharmacy_id',
    'name',source->>'name',
    'address',source->>'address',
    'status',source->>'status',
    'priority',source->>'priority',
    'potential',source->>'potential',
    'last_order_at',source->>'last_order_at',
    'last_interaction_at',source->>'last_interaction_at',
    'next_action_type',source->>'next_action_type',
    'next_action_at',source->>'next_action_at',
    'commercial_terms',conditions
  );
END;
$fn$;

-- Keep the restricted OAuth role as the only public-facing executor.
REVOKE ALL ON FUNCTION public.tr1_chatgpt_pharmacy_summary(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_pharmacy_summary(uuid)
  TO tr1_chatgpt_reader;
