# TR1 ChatGPT MCP — phase 2 guarded release request

Date: 2026-10-13
Authorized scope: extend existing TR1 ChatGPT MCP integration to catalog read, 15-day agenda read, user-confirmed planned visits, and unsent order drafts.
Source baseline (before rollout): 89e1281ca9ad3c470fe60e65ce0971e7de51d6ec
Reviewed MCP main SHA: 4f2e90506a2801b0804208065f997eea827c0418
Staging Supabase: ehptapmuzckazyxmnmnm
Production Supabase: zhifmehctuflwfexlvkz

## Release conditions
- CI (application, pgTAP database and E2E) must pass on exact release commit.
- Official staging release must complete with migration drift checks and smoke before the production release.
- The production workflow alone may migrate production data and promote the tested candidate.
- Existing separate staging ChatGPT plugin remains available for isolated testing.
- OAuth-scoped roles only; no direct table grants; real order transmission remains unavailable from ChatGPT.
- Every visit / order draft requires explicit per-action user confirmation.
- No commercial order or field visit is requested or authorized by this release request.
- If any gate fails, do not bypass it; production remains on its current deployment.

This file is intentionally non-runtime and starts the repository's existing guarded release automation.
