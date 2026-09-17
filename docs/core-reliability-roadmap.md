# TR1 PHARMA — Core Reliability Roadmap

Parent tracking: #182

## Phase 1 — Visit Core (PR #181)

Goal: one source of truth for field visits.

- Canonical `close_field_visit` lifecycle.
- Legacy `complete_field_visit` kept only as a compatibility adapter.
- Canonical visit interactions linked with `field_visit_id`.
- Multi-brand closeout interactions and evidence ownership.
- Deterministic/retryable evidence object paths.
- External HubSpot failure isolated from TR1 persistence.
- Cancelled/invalid visit states blocked in the execution UI.
- Database contract tests and a field-visit E2E golden path.
- CI guards against rewriting existing migrations and toggling `vercel.json` in product PRs.

Exit criteria:

- Application quality green.
- Local Supabase reset + pgTAP + lint/advisors green.
- Playwright E2E green.
- PR reviewed before merge.

## Phase 2 — Release & Database Safety

Goal: make production promotion reproducible and remove manual Git deployment switches.

- Promote the exact SHA validated in staging to production.
- Add staging smoke evidence to the production gate.
- Compare migration history between Git, staging and production before promotion.
- Treat every applied migration as immutable; every fix is a new migration.
- Document rollback / forward-fix rules.

## Phase 3 — Durable Side Effects

Goal: external systems never become TR1's source of truth.

- Introduce a durable outbox/event model for CRM, email and other connectors.
- Make connector jobs idempotent, observable and retryable.
- Persist attempt/status/error metadata independently of the business transaction.
- Provide explicit `pending / succeeded / failed` synchronization states.

## Phase 4 — Business Golden Paths

Goal: protect the workflows that field teams actually use.

Required scenarios:

1. Visit without photo.
2. Visit with photo evidence.
3. Evidence upload failure and retry after navigation/reload.
4. Follow-up visit created and visible in Agenda / Today.
5. Multi-brand visit closes once and creates correctly scoped interactions.
6. Order lifecycle distinguishes `submitted`, `processed`, `sent` and `synchronized`.
7. Animation lifecycle: request → accept → schedule → execute → sell-out/report → invoice.

## Architecture rule

`submitted`, `processed`, `sent`, `synchronized` and `completed` are distinct states. UI copy, persistence and integrations must not collapse them into one apparent success state.
