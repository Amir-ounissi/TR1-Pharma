-- The public catalogue wrapper must read the curated directory as its owner.
-- Anonymous visitors do not have SELECT access to brand_discovery_directory;
-- expose only the whitelisted brand fields returned by private.public_brand_directory().
CREATE OR REPLACE FUNCTION public.public_catalogue_data()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.public_brand_directory();
$function$;
