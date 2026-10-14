# ChatGPT → TR1 Naali order submission → HubSpot

A new two-step ChatGPT action makes a priced order draft actionable **only after the user explicitly confirms the exact basket**.

1. `preview_tr1_priced_order` calculates the real catalog prices, discount and free units.
2. `create_tr1_priced_order_draft` stores the verified draft using an idempotent request ID.
3. `review_tr1_priced_order` rechecks the stored basket against current verified commercial terms and returns a review token. Present the pharmacy, order number, product lines, quantities, discounts, free goods and totals.
4. Only after user confirmation, `submit_tr1_priced_order_to_hubspot` submits the draft as `pending` through the existing reviewed agent workflow and attempts HubSpot sync. The same request ID and review token may be retried safely.
5. The tool reports `hubspot_synced: true` only after checking the sync journal for an acknowledged deal, pharmacy association and all paid/free product lines. If HubSpot fails, the TR1 order remains `pending`, `hubspot_synced: false` is returned and a later retry must be used. Never claim delivery from TR1 submission alone.

Safety: OAuth-bound, scoped to orders the caller created and agent-assigned pharmacies; Naali only; `initial` and `reorder` only; no direct client-supplied pricing, no confirmation without review token, no duplicate order on retry. This action does **not** send email or PDF to the brand.

The HubSpot deal owner remains Amir Ounissi. The `prise_de_commande` property remains intentionally omitted until the enum option is configured.

Release via mandatory CI, staging and production gates; test fixtures only, no real order creation during release validation.
