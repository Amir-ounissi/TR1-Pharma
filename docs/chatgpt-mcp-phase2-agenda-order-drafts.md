# ChatGPT TR1 Production — phase 2 (draft PR, NOT ENABLED)

## Scope

Four MCP tools are added behind the existing global MCP feature gate:
- `list_tr1_catalog`: active products with catalog wholesale price, tax, MOQ (maximum 50)
- `get_tr1_agenda`: user's own agenda entries (maximum 15 calendar days)
- `create_tr1_planned_visit`: add a *planned* TR1 visit, not a pharmacist-confirmed appointment
- `create_tr1_order_draft`: save an **unsent** draft order, never submit or email

Both write tools require a user-approved `confirmed=true` tool call; the assistant
must first display the pharmacy, brand, dates or product lines and obtain explicit
confirmation. Tool annotations advertise writes. Human review in TR1 is still
required before any order submission/transmission. Host-level permissions should
be set to **Always ask** for this plugin's writes.

## Technical integration

- Existing authorization: `tr1_chatgpt_reader` has no table privileges. Each new
  `SECURITY DEFINER` RPC independently verifies the dedicated OAuth JWT via
  `private.tr1_chatgpt_authorized()`; generic CRUD grants remain forbidden.
- The planned-visit RPC delegates to `create_field_visit`, preserving a single
  physical visit across brands and the existing territory/assignment checks.
- Draft orders delegate to `create_order_with_pharmacy_resolution` but only for
  *already-associated, assigned* brand-pharmacy relations. No new global pharmacy
  is created. A stable UUID request ID becomes `chatgpt:<uuid>` and is guarded
  with an advisory transaction lock to avoid replay duplication.
- Draft lines take price HT and VAT exclusively from the active TR1 product
  catalog. No free units, discounts, or shipping are inferred; these require
  explicit review in the application. The RPC hardcodes `draft` and never calls
  a transmission routine or HubSpot synchronization.
- All changes are independent from UX/desktop work in main.

## Mandatory preproduction tests

1. Unit: valid/invalid tool input, no write without `confirmed=true`, duplicate
   product or invalid ISO datetime rejected.
2. Staging SQL: anonymous, authenticated browser and unknown/disabled OAuth
   tokens cannot execute; permitted OAuth can read only authorized brands.
3. Staging SQL: create a visit for an assigned pharmacy; repeat returns same visit;
   unassigned and cross-brand requests rejected; conflicting events rejected.
4. Staging SQL: create one unsent draft; repeat request ID returns the same row;
   invalid SKU/price/quantity rejected transactionally; no side effects on other
   brands or orders; ensure invoice/send/HubSpot workflows remain off.
5. Integration: OAuth connect/reconnect, `initialize`, `tools/list`, 401
   unauthenticated `tools/call`, end-to-end approval and tool runs.
6. Regression: existing three read tools work unchanged. Existing TR1 UI order
   and agenda forms work unchanged. Check CI lint, typecheck, tests, build and DB.

## Release controls

DO NOT merge, apply the new migration to production, expand direct table grants,
promote Vercel deployments, or send commercial orders until the staged tests and
a human production approval are complete.
