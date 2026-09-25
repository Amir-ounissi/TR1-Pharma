-- P2: support Supabase secret API keys for trusted connector runtime calls.
-- sb_secret_* keys execute through PostgREST as the service_role database role,
-- but unlike the legacy service_role API key they are not JWTs and therefore
-- do not populate request.jwt.claim.role. Keep legacy JWT compatibility while
-- accepting the actual Postgres role selected by PostgREST.

create or replace function private.is_service_role_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    ) = 'service_role'
    or coalesce(nullif(current_setting('role', true), ''), 'none') = 'service_role';
$$;

revoke all on function private.is_service_role_request()
  from public, anon, authenticated;

comment on function private.is_service_role_request() is
  'Trusted backend check compatible with both legacy service_role JWT API keys and sb_secret API keys routed as the service_role Postgres role.';
