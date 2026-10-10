-- Expose the existing private ChatGPT token hook in the Supabase Auth Hooks
-- dashboard selector (which may only enumerate functions in public).
-- Safe boundary: no user, anonymous, or ChatGPT reader EXECUTE privileges.
-- Do not activate this hook until the staging OAuth flow is reviewed.
BEGIN;

CREATE OR REPLACE FUNCTION public.tr1_chatgpt_oauth_hook(event jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $hook$
  SELECT private.tr1_chatgpt_oauth_token_hook(event);
$hook$;

REVOKE ALL ON FUNCTION public.tr1_chatgpt_oauth_hook(jsonb)
  FROM PUBLIC, anon, authenticated, tr1_chatgpt_reader;

GRANT EXECUTE ON FUNCTION public.tr1_chatgpt_oauth_hook(jsonb)
  TO supabase_auth_admin;

COMMIT;
