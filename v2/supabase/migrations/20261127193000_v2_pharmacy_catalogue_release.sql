
-- Publish only supplier-priced references with an active source record.
-- Unverified brands and discontinued / restricted references remain visible,
-- but cannot be selected or priced in a pharmacy request.

UPDATE public.products p
SET published = true,
    price_verified = true
FROM public.brands b
WHERE b.id = p.brand_id
  AND b.slug IN ('beauty-of-joseon','biodance','dr-althea')
  AND p.source_active IS TRUE
  AND p.source_document IS NOT NULL
  AND p.price_ht IS NOT NULL;

UPDATE public.products p
SET published = true,
    price_verified = true,
    source_active = true,
    requires_review = false
FROM public.brands b
WHERE b.id = p.brand_id
  AND b.slug IN ('bloomster','vitalora')
  AND p.price_ht IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.althesia_trade_offers o
    WHERE o.product_id = p.id
      AND o.price_confirmed IS TRUE
  );

UPDATE public.althesia_product_specs s
SET product_source_checked = true
FROM public.products p
JOIN public.brands b ON b.id = p.brand_id
WHERE s.product_id = p.id
  AND b.slug IN ('bloomster','vitalora')
  AND EXISTS (
    SELECT 1 FROM public.althesia_trade_offers o
    WHERE o.product_id = p.id AND o.price_confirmed IS TRUE
  );

-- Biodance masks: supplier volume tiers, with TR1's agreed 5% uplift applied
-- by catalogue_link_price when the pharmacist views the professional tariff.
UPDATE public.products p
SET min_qty = 12,
    qty_step = 4
FROM public.brands b
WHERE b.id = p.brand_id
  AND b.slug = 'biodance'
  AND p.source_active IS TRUE
  AND p.name ILIKE '%mask%';

INSERT INTO public.product_quantity_tiers
  (product_id, min_qty, price_ht, verified, source_note)
SELECT
  p.id,
  t.min_qty,
  t.price_ht,
  true,
  'Biodance2026.pdf — palier fournisseur HT; majoration TR1 de 5 % appliquée à l’affichage'
FROM public.products p
JOIN public.brands b ON b.id = p.brand_id
CROSS JOIN (
  VALUES
    (12, 3.50::numeric),
    (24, 3.20::numeric),
    (40, 3.10::numeric),
    (96, 3.00::numeric),
    (200, 2.80::numeric)
) AS t(min_qty, price_ht)
WHERE b.slug = 'biodance'
  AND p.source_active IS TRUE
  AND p.name ILIKE '%mask%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_quantity_tiers existing
    WHERE existing.product_id = p.id
      AND existing.min_qty = t.min_qty
  );

UPDATE public.brand_discovery_directory
SET catalogue_note = NULL;

CREATE OR REPLACE FUNCTION private.commercial_request_eligible(p_product uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    LEFT JOIN public.althesia_product_specs s ON s.product_id = p.id
    WHERE p.id = p_product
      AND p.published IS TRUE
      AND p.price_verified IS TRUE
      AND p.source_active IS TRUE
      AND p.price_ht IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.product_discontinuations d
        WHERE d.brand_id = p.brand_id
          AND d.ean IS NOT DISTINCT FROM p.ean
      )
      AND COALESCE(s.market_status, '') <> 'food_cbd_blocked'
  );
$function$;

CREATE OR REPLACE FUNCTION private.catalogue_link_price(
  p_pharmacy uuid,
  p_product uuid,
  p_qty integer
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN NOT private.commercial_request_eligible(p_product) THEN NULL
    WHEN EXISTS (
      SELECT 1
      FROM public.price_rules r
      WHERE r.pharmacy_id = p_pharmacy
        AND r.product_id = p_product
        AND r.min_qty <= p_qty
    ) THEN (
      SELECT r.price_ht
      FROM public.price_rules r
      WHERE r.pharmacy_id = p_pharmacy
        AND r.product_id = p_product
        AND r.min_qty <= p_qty
      ORDER BY r.min_qty DESC
      LIMIT 1
    )
    ELSE ROUND(
      COALESCE(
        (
          SELECT q.price_ht
          FROM public.product_quantity_tiers q
          WHERE q.product_id = p_product
            AND q.verified IS TRUE
            AND q.min_qty <= p_qty
          ORDER BY q.min_qty DESC
          LIMIT 1
        ),
        (
          SELECT o.purchase_unit_ht
          FROM public.althesia_trade_offers o
          WHERE o.product_id = p_product
            AND o.price_confirmed IS TRUE
            AND o.free_quantity = 0
            AND o.paid_quantity <= p_qty
          ORDER BY o.paid_quantity DESC
          LIMIT 1
        ),
        p.price_ht
      )
      *
      CASE
        WHEN b.slug = 'beauty-of-joseon' THEN 1.10
        WHEN b.slug IN ('biodance','dr-althea') THEN 1.05
        ELSE 1.00
      END,
      2
    )
  END
  FROM public.products p
  JOIN public.brands b ON b.id = p.brand_id
  WHERE p.id = p_product;
$function$;

CREATE OR REPLACE FUNCTION private.catalogue_link_data_release(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_data jsonb;
BEGIN
  v_data := private.catalogue_link_data(p_token);

  IF v_data IS NULL OR jsonb_typeof(v_data->'products') <> 'array' THEN
    RETURN v_data;
  END IF;

  RETURN jsonb_set(
    v_data,
    '{products}',
    COALESCE((
      SELECT jsonb_agg(
        p || jsonb_build_object(
          'requestable', flags.eligible,
          'brand_slug', b.slug,
          'price_label', CASE
            WHEN flags.eligible THEN 'Tarif professionnel HT'
            ELSE 'Tarif sur demande'
          END,
          'commercial_status', flags.status,
          'commercial_note', flags.note,
          'price_ht', CASE
            WHEN flags.eligible THEN COALESCE(p->'price_ht', 'null'::jsonb)
            ELSE 'null'::jsonb
          END,
          'tiers', CASE
            WHEN flags.eligible THEN COALESCE(p->'tiers', '[]'::jsonb)
            ELSE '[]'::jsonb
          END,
          'description', CASE
            WHEN b.slug IN ('bloomster','vitalora','noto','vk-swiss') THEN 'null'::jsonb
            WHEN p->>'description' = 'Présentation détaillée à demander à la marque. Référence conservée au catalogue.' THEN 'null'::jsonb
            ELSE COALESCE(p->'description', 'null'::jsonb)
          END,
          'benefits', CASE
            WHEN b.slug IN ('bloomster','vitalora','noto','vk-swiss') THEN 'null'::jsonb
            ELSE COALESCE(p->'benefits', 'null'::jsonb)
          END,
          'actives', CASE
            WHEN b.slug IN ('noto','vk-swiss') THEN 'null'::jsonb
            ELSE COALESCE(p->'actives', 'null'::jsonb)
          END,
          'usage_advice', CASE
            WHEN b.slug IN ('noto','vk-swiss') THEN 'null'::jsonb
            ELSE COALESCE(p->'usage_advice', 'null'::jsonb)
          END,
          'precautions', CASE
            WHEN b.slug IN ('noto','vk-swiss') THEN 'null'::jsonb
            ELSE COALESCE(p->'precautions', 'null'::jsonb)
          END,
          'inci', CASE
            WHEN b.slug IN ('noto','vk-swiss') THEN 'null'::jsonb
            ELSE COALESCE(p->'inci', 'null'::jsonb)
          END
        )
        ORDER BY b.name, COALESCE(p->>'name','')
      )
      FROM jsonb_array_elements(v_data->'products') p
      JOIN public.products dbp ON dbp.id = (p->>'id')::uuid
      JOIN public.brands b ON b.id = dbp.brand_id
      LEFT JOIN public.althesia_product_specs s ON s.product_id = dbp.id
      CROSS JOIN LATERAL (
        SELECT
          private.commercial_request_eligible(dbp.id) AS eligible,
          EXISTS (
            SELECT 1
            FROM public.product_discontinuations d
            WHERE d.brand_id = dbp.brand_id
              AND d.ean IS NOT DISTINCT FROM dbp.ean
          ) AS discontinued
      ) base
      CROSS JOIN LATERAL (
        SELECT
          base.eligible,
          CASE
            WHEN base.discontinued THEN 'Référence arrêtée'
            WHEN s.market_status = 'food_cbd_blocked' THEN 'Non proposée à la vente'
            WHEN base.eligible THEN NULL
            WHEN dbp.source_active IS FALSE
              AND b.slug IN ('beauty-of-joseon','biodance')
              THEN 'Référence inactive au tarif fournisseur'
            ELSE 'Tarif sur demande auprès de TR1'
          END AS status,
          CASE
            WHEN base.discontinued THEN 'Référence arrêtée par le fournisseur.'
            WHEN s.market_status = 'food_cbd_blocked'
              THEN 'Cette référence n’est pas proposée à la vente dans le catalogue officinal.'
            WHEN base.eligible THEN NULL
            WHEN dbp.source_active IS FALSE
              AND b.slug IN ('beauty-of-joseon','biodance')
              THEN 'Cette référence ne figure pas dans le tarif fournisseur actif.'
            ELSE 'TR1 communique les conditions professionnelles de cette référence sur demande.'
          END AS note
      ) flags
    ), '[]'::jsonb),
    true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.catalogue_link_data(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.catalogue_link_data_release(p_token);
$function$;

GRANT EXECUTE ON FUNCTION public.catalogue_link_data(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.public_brand_directory()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
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
          'description', d.short_description,
          'product_count', counts.total,
          'requestable_count', counts.requestable
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
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (
        WHERE private.commercial_request_eligible(p.id)
      )::integer AS requestable
    FROM public.products p
    WHERE p.brand_id = b.id
  ) counts ON true
  WHERE b.active OR COALESCE(d.discoverable, false);
$function$;
