# TR1 ↔ ChatGPT MCP — security audit, staging and release gates

**Status: experimental. PR #340 is intentionally DRAFT; production NOT deployed.**
**No ChatGPT OAuth client has been registered or enabled. No user action is live.**

## Architecture

1. Supabase Auth OAuth 2.1 issues user access tokens using PKCE and consent.
2. Its Custom Access Token Hook `private.tr1_chatgpt_oauth_token_hook`
   checks `private.tr1_chatgpt_oauth_clients`, then replaces:
   - JWT `aud` with the **exact** TR1 MCP resource URI;
   - JWT `role` with the unprivileged PostgreSQL role `tr1_chatgpt_reader`.
   Unknown OAuth client IDs cannot receive an OAuth token (fail closed).
3. PostgREST assumes the isolated role, which has **no direct grants on tables**.
   It may execute **only**:
   - `public.tr1_chatgpt_list_brands()`
   - `public.tr1_chatgpt_search_pharmacies(uuid,text)`
   - `public.tr1_chatgpt_pharmacy_summary(uuid)` (minimal commercial data, no contact identity)
   These SECURITY DEFINER functions check the exact enabled OAuth client and audience
   **again**, then call TR1's already-scoped existing membership / pharmacy functions.
4. `POST /api/connectors/chatgpt/mcp` validates JWT signature, issuer, audience,
   client ID, role, live user identity, brand membership, and queries through
   the restricted RPCs. Its only advertised MCP tools are
   `list_tr1_brands`, `search_tr1_pharmacies`, and `get_tr1_pharmacy_summary`.
5. `/.well-known/oauth-protected-resource` and the path-scoped variant describe
   the protected resource; `/oauth/consent` presents a controlled approval UI.
6. Connection defaults **OFF**, regardless of deployment:
   `TR1_CHATGPT_CONNECTOR_ENABLED` must equal `true` to enable the endpoints.

DB migration: `supabase/migrations/20261009100000_tr1_chatgpt_oauth_reader.sql`.
SQL tests: `supabase/tests/database/chatgpt_oauth_reader.test.sql`.
MCP/JWT tests: `src/app/api/connectors/chatgpt/mcp/route.test.ts`,
`src/lib/connectors/chatgpt-mcp-config.test.ts`.

## Database security rationale

OAuth `email` scope is **NOT** database read-only permission. The usual Supabase
OAuth JWT has `role=authenticated`, which could call writable TR1 RPCs.
We must NOT release or accept such broad OAuth tokens in MCP.

Instead, the custom token hook maps only explicitly enabled OAuth clients to
`tr1_chatgpt_reader`. PostgreSQL GRANTs prevent that role from reading or changing
business tables directly, or executing writable SECURITY DEFINER RPCs.
The guarded read functions themselves enforce active user/brand scope.

### Staging verification (Oct 9, 2026)

Checked on **TR1 Pharma Staging Clean** `ehptapmuzckazyxmnmnm`, not production:
- custom reader role and two RPC functions created;
- reader cannot SELECT pharmacies, INSERT orders, UPDATE tasks or write storage.objects;
- no callable mutating SECURITY DEFINER RPC in the exposed public schema;
- temporary mock OAuth JWT successfully listed an authorized brand and searched it;
- summary RPC returns only essential commercial data, never personal contact identities;
- mock token could not search a foreign brand or directly read a table;
- private OAuth client registry is EMPTY after test transaction rollback.
Actual OAuth authorization, refresh, and revocation with a real ChatGPT client
have NOT been tested. Staging objects were tested through SQL, but the versioned
migration must still be applied by the normal staging release pipeline.

## Activation steps — blocked until official tests

1. Run CI for the exact PR head: lint, typecheck, Vitest, pgTAP, E2E, build.
2. In the **staging** Supabase dashboard, enable OAuth 2.1 Server, configure
   authorization path `/oauth/consent` and the correct staging Site URL.
   Set the Custom Access Token Hook to
   `pg-functions://postgres/public/tr1_chatgpt_oauth_hook`.
   The public function is a restricted SECURITY INVOKER wrapper around the
   existing private hook. Only `supabase_auth_admin` may execute it;
   `anon`, `authenticated`, and `tr1_chatgpt_reader` have no EXECUTE grant.
   The public entrypoint is needed if the dashboard function selector excludes
   the private schema. Never select a different unrelated function.
   Do this only after reviewing the staging deployment and its auth settings.
3. Obtain the actual ChatGPT custom-plugin OAuth callback URI/client type from
   the ChatGPT UI. Do **not** invent a callback URL or client ID. Pre-register
   the OAuth client (no dynamic client registration), and insert its UUID + exact
   staging MCP resource URI into the **private** OAuth client registry.
   Enable that one record explicitly only after tests.
4. Configure in **staging** Vercel:
   - `TR1_CHATGPT_CONNECTOR_ENABLED=true` (never in production prematurely)
   - `TR1_CHATGPT_MCP_RESOURCE_URL=https://<staging-host>/api/connectors/chatgpt/mcp`
   - `TR1_CHATGPT_OAUTH_CLIENT_IDS=<the real registered UUID>`
   - `TR1_CHATGPT_ALLOWED_ORIGINS` only if needed, HTTPS.
   Keep JWT/service role secrets out of ChatGPT.
5. Test a **real** OAuth code + PKCE flow with both email and Google TR1 login,
   access/refresh tokens, revoked/disabled client, and cross-brand negative cases.
   Verify JWT `role=tr1_chatgpt_reader`, `aud` equals resource URI, and
   **direct Data API calls** remain forbidden.
6. Validate transport against MCP Inspector / SDK, including protocol negotiation,
   JSON mode, 401 challenges, discovery, HEAD/OPTIONS expectations and error behavior.
   Current hand-written JSON-RPC is a deliberately limited experimental transport.
7. Only then merge the PR, with connector disabled in production. Separately plan
   a carefully reviewed production OAuth client registration and controlled enablement.

## Known blockers / caveats

- **Actual token-flow behavior:** a mock hook/JWT is not a live OAuth test;
  special attention to refresh tokens retaining `client_id` and the reader role.
- **MCP compatibility:** current custom JSON-RPC handler is incomplete relative to
  the maintained current MCP SDK; upgrade to verified `@modelcontextprotocol/server`
  v2 transport with an updated lockfile or prove exact protocol compatibility.
- **Account entitlement:** ChatGPT Plus may not expose custom MCP plugin installation
  in every experience; check the user's own UI before promising availability.
- **Monitoring:** implement rate limiting, auditable access logging, data minimization,
  user-facing revocation, and consent-specific privacy copy before release.
- **OAuth provider:** do not point staging OAuth at TR1's production Supabase project.
  Changing a production auth hook can affect all sign-ins. Staging first.
- ChatGPT Plus is **not** OpenAI API credit and does not provide native background
  microphone access to the TR1 mobile PWA.

## References

- https://supabase.com/docs/guides/auth/oauth-server
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://supabase.com/docs/guides/auth/oauth-server/token-security
- https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://ts.sdk.modelcontextprotocol.io/v2/
