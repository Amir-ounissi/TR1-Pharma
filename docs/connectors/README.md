# TR1 ↔ ChatGPT: MCP connector audit and rollout plan

Status: **EXPERIMENTAL / DISABLED / NOT READY TO MERGE OR RELEASE** (PR #340).
This branch does not install a ChatGPT plugin and has not been released to TR1 production.

## Why MCP rather than OpenAPI

ChatGPT's custom connector expects MCP tools and OAuth for user authorization.
The earlier REST route and OpenAPI specification have been removed.
Current MCP endpoint: `POST /api/connectors/chatgpt/mcp`.
OAuth resource metadata: `GET /.well-known/oauth-protected-resource`.
The two read-only tools are `list_tr1_brands` (authorized brands only) and `search_tr1_pharmacies` (up to 10 results per authorized brand).
Existing database RPCs remain the source of truth for visibility:
`get_my_brand_contexts()` and `search_authorized_pharmacies(...)`.

## Security model (intended)

- **Disabled by default**: The entire MCP endpoint and resource metadata return 404 until enabled.
- **User-scoped**: never accept a service-role key, browser session alone, or a shared API key.
- **Token validation**: verify the Supabase JWT signature, issuer, subject, `role`, exact MCP resource audience and an allowlisted OAuth `client_id`; then call `getUser(token)` to check the user and apply existing RLS via caller JWT.
- **Scope caution**: OAuth `email` controls OAuth identity information, **NOT PostgreSQL table permissions**.
- **Defense in depth**: check the current user's brand via `get_my_brand_contexts`, then use the existing SECURITY INVOKER pharmacy RPC and RLS. Never trust a supplied brand ID alone.
- **Consent**: the user sees an explicit consent screen limited to registered OAuth clients. TR1 login may return to this page only through a validated internal path.
- **No writes**: the MCP code currently exposes only brand discovery and pharmacy search, with no order, visit, task, messaging, or file modifications.

### BLOCKER A: OAuth audience / resource indicators

Supabase OAuth 2.1's current default access token uses `aud=authenticated`. MCP protected-resource
authorization (RFC 9728 / RFC 8707) requires **resource-bound** tokens. TR1 now REJECTS
default Supabase OAuth tokens unless the `aud` is the exact configured MCP resource URL.

Do **not** set `TR1_CHATGPT_CONNECTOR_ENABLED=true` until the authorization flow can issue
and validate such a resource-bound token without breaking PostgREST/RLS. Investigate
a Custom Access Token Hook or an issuer/gateway which supports resource indicators,
token audience validation, revocation and token exchange. Test this with the pinned
Supabase client / project and an actual ChatGPT OAuth client, not just mock tests.

### BLOCKER B: direct Supabase access with OAuth tokens

OAuth tokens issued directly by Supabase can access Supabase's Data API subject to normal
RLS. A tool labeled read-only does **not** make the underlying token read-only.
The `email` scope is not a database permission boundary. Existing RLS write policies
may still allow this OAuth client to perform database writes outside the MCP tools.

Before enabling the integration, design and verify a **client-specific read-only DB
authorization boundary** (e.g., reviewed client_id-aware RLS for *all* relevant writes)
or use a dedicated resource token/gateway that cannot call Supabase Data API directly.
No production RLS policies have been altered in this branch.

### BLOCKER C: MCP implementation and compatibility

The custom minimal JSON-RPC route is only a subset of streamable HTTP MCP; it is not
verified with the official MCP Inspector or ChatGPT. Use the maintained MCP TypeScript SDK
for full protocol/session/HTTP semantics where practical; pin the version and lockfile.
The route currently negotiates `2025-06-18` and supports initialization, ping,
tools/list, tools/call, notifications/initialized. Run the MCP conformance tests.

### BLOCKER D: ChatGPT account eligibility

Availability of custom ChatGPT plugins, ChatGPT Work, and voice calls depends on
the user's ChatGPT plan and current product rollout. Never promise a Plus account
can install a custom MCP plugin without verifying that the UI allows it.
MCP connectivity does **not** equal background hands-free mobile listening.

## Configuration (FOR FUTURE STAGING TESTS ONLY)

- `TR1_CHATGPT_CONNECTOR_ENABLED=false` until every blocker above is resolved.
- `TR1_CHATGPT_MCP_RESOURCE_URL=https://<trusted-staging-host>/api/connectors/chatgpt/mcp`
- `TR1_CHATGPT_OAUTH_CLIENT_IDS=<registered-client-id>`
- `TR1_CHATGPT_ALLOWED_ORIGINS=` optional comma-separated HTTPS origins (only trusted clients).
- Existing `NEXT_PUBLIC_SUPABASE_URL` and publishable key; NEVER provide a service-role key to ChatGPT.

Supabase Auth > OAuth 2.1 Server must be enabled **on a staging project**,
with its consent/authorization URL directed to `/oauth/consent`.
Supabase supports authorization code + PKCE and client registration;
it handles authorization codes and token refresh. Exact ChatGPT OAuth client
registration and callback URIs must come from ChatGPT's actual UI; never guess these.

## Test and release gates

1. Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`.
2. Run MCP Inspector against a *staging* HTTPS endpoint. Test discovery, initialization,
   invalid methods and headers, missing/expired/wrong-audience tokens, cross-brand IDs.
3. Validate OAuth with a real consent round-trip (email and Google sign-in) and token
   renewal/revocation; no copied credentials in the plugin config.
4. Verify **negative direct Supabase Data API write tests** using an OAuth token issued
   for the ChatGPT client. These must fail even for a user otherwise allowed to write.
5. Check security, rate limits, audit logging, PII minimization, privacy notice and user
   disconnection before rollout. Do not rely on a mock test as a substitute.
6. Keep PR as a draft until the full gate passes. No production changes without review.

## References

- https://supabase.com/docs/guides/auth/oauth-server
- https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- https://supabase.com/docs/guides/auth/oauth-server/token-security
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/auth
