-- TR1 ChatGPT MCP: isolate third-party OAuth JWTs from authenticated CRUD privileges.
-- OAuth token hooks and client registration remain OFF until explicitly configured.
-- Designed to be reversible through a new migration; never edit prior migrations.

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tr1_chatgpt_reader') THEN
    CREATE ROLE tr1_chatgpt_reader NOLOGIN NOINHERIT;
  END IF;
END $role$;
GRANT tr1_chatgpt_reader TO authenticator;

-- This configuration is private and cannot be reached through the Supabase Data API.
CREATE TABLE IF NOT EXISTS private.tr1_chatgpt_oauth_clients (
  client_id uuid PRIMARY KEY,
  resource_url text NOT NULL CHECK (
    resource_url LIKE 'https://%' AND
    resource_url LIKE '%/api/connectors/chatgpt/mcp'
  ),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.tr1_chatgpt_oauth_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.tr1_chatgpt_oauth_clients FROM PUBLIC, anon, authenticated;

-- Install via Supabase Auth > Hooks > Custom Access Token after staging validation.
-- Any unknown third-party OAuth client fails closed. Normal TR1 sessions are untouched.
CREATE OR REPLACE FUNCTION private.tr1_chatgpt_oauth_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  input_client text;
  target_resource text;
  issued_claims jsonb;
BEGIN
  input_client := COALESCE(
    NULLIF(event ->> 'client_id', ''),
    NULLIF(event -> 'claims' ->> 'client_id', '')
  );
  IF input_client IS NULL THEN RETURN event; END IF;

  IF input_client !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Unrecognized OAuth client' USING ERRCODE = '42501';
  END IF;
  SELECT c.resource_url INTO target_resource
    FROM private.tr1_chatgpt_oauth_clients c
    WHERE c.client_id = input_client::uuid AND c.enabled;
  IF target_resource IS NULL THEN
    RAISE EXCEPTION 'OAuth client not enabled for TR1' USING ERRCODE = '42501';
  END IF;

  issued_claims := event -> 'claims';
  IF jsonb_typeof(issued_claims) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'OAuth claims missing' USING ERRCODE = '42501';
  END IF;
  issued_claims := jsonb_set(issued_claims, '{aud}', to_jsonb(target_resource), true);
  issued_claims := jsonb_set(issued_claims, '{role}', to_jsonb('tr1_chatgpt_reader'::text), true);
  RETURN jsonb_set(event, '{claims}', issued_claims, true);
END $fn$;

REVOKE ALL ON FUNCTION private.tr1_chatgpt_oauth_token_hook(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.tr1_chatgpt_oauth_token_hook(jsonb)
  TO supabase_auth_admin;

-- Additional check inside the SECURITY DEFINER readers prevents usage of a regular
-- browser session, impersonated role, unknown OAuth client or wrong JWT audience.
CREATE OR REPLACE FUNCTION private.tr1_chatgpt_authorized()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
SELECT
  auth.uid() IS NOT NULL
  AND (auth.jwt() ->> 'role') = 'tr1_chatgpt_reader'
  AND EXISTS (
    SELECT 1 FROM private.tr1_chatgpt_oauth_clients c
    WHERE c.enabled
      AND c.client_id::text = (auth.jwt() ->> 'client_id')
      AND c.resource_url = (auth.jwt() ->> 'aud')
  );
$fn$;
REVOKE ALL ON FUNCTION private.tr1_chatgpt_authorized()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_list_brands()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE answer jsonb;
BEGIN
  IF NOT private.tr1_chatgpt_authorized() THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'brand_id', b.brand_id, 'brand_name', b.brand_name, 'brand_slug', b.brand_slug
  ) ORDER BY b.brand_name), '[]'::jsonb)
    INTO answer FROM public.get_my_brand_contexts() b;
  RETURN answer;
END $fn$;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_search_pharmacies(
  target_brand_id uuid, search_text text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE answer jsonb;
BEGIN
  IF NOT private.tr1_chatgpt_authorized() THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  IF search_text IS NULL OR length(btrim(search_text)) < 2 OR length(search_text) > 120 THEN
    RAISE EXCEPTION 'Invalid search query' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_my_brand_contexts() b WHERE b.brand_id = target_brand_id
  ) THEN
    RAISE EXCEPTION 'Brand forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
    INTO answer
    FROM public.search_authorized_pharmacies(target_brand_id, search_text, 10) p;
  RETURN answer;
END $fn$;

-- Summary intentionally omits contact names, phone numbers and detailed notes.
CREATE OR REPLACE FUNCTION public.tr1_chatgpt_pharmacy_summary(
  target_brand_pharmacy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  source jsonb;
BEGIN
  IF NOT private.tr1_chatgpt_authorized() THEN
    RAISE EXCEPTION 'ChatGPT OAuth authorization required' USING ERRCODE = '42501';
  END IF;
  -- Existing core RPC checks the active user's pharmacy assignment and brand.
  source := public.get_field_pharmacy_summary(target_brand_pharmacy_id);
  IF source IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'brand_pharmacy_id', source ->> 'brand_pharmacy_id',
    'name', source ->> 'name',
    'address', source ->> 'address',
    'status', source ->> 'status',
    'priority', source ->> 'priority',
    'potential', source ->> 'potential',
    'last_order_at', source ->> 'last_order_at',
    'last_interaction_at', source ->> 'last_interaction_at',
    'next_action_type', source ->> 'next_action_type',
    'next_action_at', source ->> 'next_action_at'
  );
END $fn$;

REVOKE ALL ON FUNCTION public.tr1_chatgpt_list_brands()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tr1_chatgpt_search_pharmacies(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_list_brands()
  TO tr1_chatgpt_reader;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_search_pharmacies(uuid, text)
  TO tr1_chatgpt_reader;

REVOKE ALL ON FUNCTION public.tr1_chatgpt_pharmacy_summary(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_pharmacy_summary(uuid)
  TO tr1_chatgpt_reader;
