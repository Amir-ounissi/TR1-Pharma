REVOKE ALL ON TABLE public.public_catalogue_lead_brands FROM anon;

UPDATE public.brand_discovery_directory d
SET short_description = 'Univers de bien-être et soins capillaires.'
FROM public.brands b
WHERE b.id = d.brand_id
  AND b.slug = 'noto'
  AND d.short_description ILIKE '%cannabinoïdes%';
