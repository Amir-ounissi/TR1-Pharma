
-- Allow one public catalogue prospect to select several brands while keeping
-- the existing public_catalogue_leads row as the single CRM prospect record.
CREATE TABLE IF NOT EXISTS public.public_catalogue_lead_brands (
  lead_id uuid NOT NULL REFERENCES public.public_catalogue_leads(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_catalogue_lead_brands_pkey PRIMARY KEY (lead_id, brand_id)
);

CREATE INDEX IF NOT EXISTS public_catalogue_lead_brands_brand_idx
  ON public.public_catalogue_lead_brands (brand_id, created_at DESC);

ALTER TABLE public.public_catalogue_lead_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_catalogue_lead_brands_owner_read
  ON public.public_catalogue_lead_brands;

CREATE POLICY public_catalogue_lead_brands_owner_read
  ON public.public_catalogue_lead_brands
  FOR SELECT
  TO authenticated
  USING (public.tr1_is_owner());

GRANT SELECT ON public.public_catalogue_lead_brands TO authenticated;

CREATE OR REPLACE FUNCTION private.submit_public_brand_interests(
  p_brand_slugs text[],
  p_pharmacy_name text,
  p_contact_name text,
  p_email text,
  p_city text,
  p_note text,
  p_honeypot text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_brand_ids uuid[];
  v_lead uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_count integer;
BEGIN
  IF coalesce(p_honeypot, '') <> '' THEN
    RAISE EXCEPTION 'Demande invalide';
  END IF;

  IF p_brand_slugs IS NULL
     OR cardinality(p_brand_slugs) < 1
     OR cardinality(p_brand_slugs) > 8
     OR EXISTS (
       SELECT 1
       FROM unnest(p_brand_slugs) AS requested(slug)
       WHERE requested.slug IS NULL
          OR length(trim(requested.slug)) NOT BETWEEN 1 AND 100
     )
     OR cardinality(ARRAY(SELECT DISTINCT slug FROM unnest(p_brand_slugs) AS requested(slug)))
        <> cardinality(p_brand_slugs)
     OR length(trim(coalesce(p_pharmacy_name, ''))) NOT BETWEEN 2 AND 180
     OR length(trim(coalesce(p_contact_name, ''))) NOT BETWEEN 2 AND 120
     OR length(v_email) NOT BETWEEN 5 AND 254
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR length(trim(coalesce(p_city, ''))) NOT BETWEEN 2 AND 120
     OR length(coalesce(p_note, '')) > 1500
  THEN
    RAISE EXCEPTION 'Coordonnées ou sélection invalides';
  END IF;

  SELECT array_agg(b.id ORDER BY requested.ordinality)
  INTO v_brand_ids
  FROM unnest(p_brand_slugs) WITH ORDINALITY AS requested(slug, ordinality)
  JOIN public.brands b ON b.slug = requested.slug
  LEFT JOIN public.brand_discovery_directory d ON d.brand_id = b.id
  WHERE b.active OR coalesce(d.discoverable, false);

  IF v_brand_ids IS NULL OR cardinality(v_brand_ids) <> cardinality(p_brand_slugs) THEN
    RAISE EXCEPTION 'Une ou plusieurs marques ne sont pas disponibles';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));

  SELECT count(*) INTO v_count
  FROM public.public_catalogue_leads l
  WHERE lower(l.email) = v_email
    AND l.created_at > now() - interval '15 minutes';

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Trop de demandes';
  END IF;

  INSERT INTO public.public_catalogue_leads (
    pharmacy_name,
    contact_name,
    email,
    city,
    note,
    interest_brand_id,
    created_by
  )
  VALUES (
    trim(p_pharmacy_name),
    trim(p_contact_name),
    v_email,
    trim(p_city),
    nullif(trim(coalesce(p_note, '')), ''),
    v_brand_ids[1],
    auth.uid()
  )
  RETURNING id INTO v_lead;

  INSERT INTO public.public_catalogue_lead_brands (lead_id, brand_id)
  SELECT v_lead, selected.brand_id
  FROM unnest(v_brand_ids) AS selected(brand_id);

  RETURN v_lead;
END;
$function$;

GRANT EXECUTE ON FUNCTION private.submit_public_brand_interests(text[], text, text, text, text, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_brand_interests(
  p_brand_slugs text[],
  p_pharmacy_name text,
  p_contact_name text,
  p_email text,
  p_city text,
  p_note text,
  p_honeypot text DEFAULT ''
)
RETURNS uuid
LANGUAGE sql
SET search_path TO ''
AS $function$
  SELECT private.submit_public_brand_interests(
    p_brand_slugs, p_pharmacy_name, p_contact_name, p_email, p_city, p_note, p_honeypot
  );
$function$;

GRANT EXECUTE ON FUNCTION public.submit_public_brand_interests(text[], text, text, text, text, text, text)
  TO anon, authenticated;

-- Preserve compatibility with existing callers that submit one brand.
CREATE OR REPLACE FUNCTION private.submit_public_brand_interest(
  p_brand_slug text,
  p_pharmacy_name text,
  p_contact_name text,
  p_email text,
  p_city text,
  p_note text,
  p_honeypot text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.submit_public_brand_interests(
    ARRAY[p_brand_slug], p_pharmacy_name, p_contact_name, p_email, p_city, p_note, p_honeypot
  );
$function$;

GRANT EXECUTE ON FUNCTION private.submit_public_brand_interest(text, text, text, text, text, text, text)
  TO anon, authenticated;
