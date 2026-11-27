
-- Public brand showcase: expose only editorial brand descriptions.
-- Remove internal pilot notes from pharmacy-facing brand records.
UPDATE public.brand_discovery_directory
SET catalogue_note = NULL,
    updated_at = now();

CREATE OR REPLACE FUNCTION private.public_brand_directory()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'brands',
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'slug', b.slug,
          'description', d.short_description
        )
        ORDER BY b.name
      ),
      '[]'::jsonb
    ),
    'products',
    '[]'::jsonb
  )
  FROM public.brands b
  LEFT JOIN public.brand_discovery_directory d ON d.brand_id = b.id
  WHERE b.active OR COALESCE(d.discoverable, false);
$function$;

-- Pharmacy accounts only see offers that are explicitly published and verified.
-- Internal/demo offers remain out of the commercial pharmacy experience.
CREATE OR REPLACE FUNCTION private.pharmacy_implantation_offers()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_pharmacy uuid;
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'pharmacy'
  ) THEN
    RAISE EXCEPTION 'Compte pharmacie requis';
  END IF;

  SELECT m.pharmacy_id
  INTO v_pharmacy
  FROM public.pharmacy_memberships m
  WHERE m.user_id = (SELECT auth.uid())
    AND m.active
  ORDER BY m.created_at
  LIMIT 1;

  IF v_pharmacy IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'brand_id', o.brand_id,
        'title', o.title,
        'offer_kind', o.offer_kind,
        'summary', o.summary,
        'min_distinct_references', o.min_distinct_references,
        'min_units_per_reference', o.min_units_per_reference,
        'free_units_per_reference', o.free_units_per_reference,
        'min_total_paid_units', o.min_total_paid_units,
        'min_order_ht', o.min_order_ht,
        'fixed_pack_ht', o.fixed_pack_ht,
        'discount_pct', o.discount_pct,
        'offer_conditions', o.offer_conditions,
        'plv_commitment', o.plv_commitment,
        'training_commitment', o.training_commitment,
        'shipping_terms', o.shipping_terms,
        'verification_status', o.verification_status,
        'valid_until', o.valid_until,
        'lines', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'product_name', p.name,
              'format', p.format,
              'paid_units', l.paid_units,
              'free_units', l.free_units,
              'line_note', l.line_note
            )
            ORDER BY p.name
          )
          FROM public.brand_implantation_offer_lines l
          JOIN public.products p ON p.id = l.product_id
          WHERE l.offer_id = o.id
            AND NOT EXISTS (
              SELECT 1
              FROM public.althesia_product_specs s
              WHERE s.product_id = p.id
                AND s.market_status = 'food_cbd_blocked'
            )
        ), '[]'::jsonb)
      )
      ORDER BY b.name, o.min_units_per_reference NULLS LAST, o.title
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.brand_implantation_offers o
  JOIN public.brands b ON b.id = o.brand_id
  JOIN public.brand_discovery_directory d
    ON d.brand_id = b.id AND d.discoverable
  LEFT JOIN public.pharmacy_brand_relationships r
    ON r.pharmacy_id = v_pharmacy AND r.brand_id = b.id
  WHERE COALESCE(r.status, 'unconfirmed') <> 'implanted'
    AND o.published IS TRUE
    AND o.verification_status = 'verified'
    AND (o.valid_from IS NULL OR o.valid_from <= current_date)
    AND (o.valid_until IS NULL OR o.valid_until >= current_date)
    AND NOT EXISTS (
      SELECT 1
      FROM public.brand_implantation_offer_lines l
      JOIN public.althesia_product_specs s ON s.product_id = l.product_id
      WHERE l.offer_id = o.id
        AND s.market_status = 'food_cbd_blocked'
    );

  RETURN v_result;
END;
$function$;
