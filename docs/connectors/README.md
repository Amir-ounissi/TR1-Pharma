# TR1 ChatGPT connector — first slice

This branch introduces a **read-only** pharmacy lookup endpoint and an OpenAPI contract.
It does not register a ChatGPT plugin or connect a Plus account by itself.

## Security
- Bearer token must be a valid **TR1 Supabase user access token**, never a service-role key.
- The endpoint calls Supabase with the caller's token so existing RLS and RPC authorization apply.
- It verifies membership via `get_my_brand_contexts` and uses `search_authorized_pharmacies`.
- No write operations, anonymous queries, or credentials in query parameters.
- Do not paste personal access tokens into a GPT's shared API-key settings.

## Integration prerequisite
A ChatGPT-facing plugin or GPT Action needs a supported **per-user OAuth 2.1 authorization flow**.
This repository does not yet expose such a flow. Configure and review OAuth client registration,
redirect URI validation, state, PKCE, scopes, token lifecycle and revocation before connecting.
Do not deploy this route as a complete connector without these controls and integration tests.

## Next steps
1. Add an OAuth authorization server / trusted provider with TR1 identity mapping.
2. Add integration tests for expired JWT, foreign brand, unauthorized pharmacy and positive read.
3. Expose read-only pharmacy summary and orders, each scoped to the caller's brand.
4. Add draft-only order and visit actions with explicit user confirmation and audit logging.
5. Register the connector in ChatGPT and complete user authorization.

OpenAPI specification: `docs/connectors/tr1-chatgpt-openapi.yaml`.
