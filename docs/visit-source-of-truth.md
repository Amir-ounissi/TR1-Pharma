# Field visit source of truth

TR1 stores one canonical business visit in `field_visits`. Brands, CRM records and interactions attach to that visit; they must not create parallel business visits for the same physical appointment.

## Authority matrix

| Concern | Canonical authority | Rule |
| --- | --- | --- |
| Visit identity | TR1 `field_visits.id` | One physical appointment is one row, regardless of brand count. |
| Brand scope | TR1 `field_visit_brands` | Multi-brand work adds links to the same visit; it never duplicates the visit. |
| HubSpot identity | `connector_external_links` | One HubSpot meeting maps to one TR1 visit and one TR1 visit maps to at most one HubSpot meeting for a connection. |
| TR1-origin schedule/lifecycle | TR1 | HubSpot inbound reconciliation may link the meeting but must not overwrite a manually created or follow-up TR1 visit. |
| HubSpot-origin schedule before execution | HubSpot as inbound input, persisted in TR1 | An `import` visit can receive HubSpot reschedules/cancellations until TR1 starts or completes it. |
| Visit execution and closeout | TR1 | Once a visit is `in_progress` or `completed`, HubSpot cannot regress or replace its lifecycle. |
| Visit interaction | TR1 canonical interaction per visit + brand | Reconciliation must not create a second interaction that competes with the closeout interaction. Existing placeholders are reused on closeout. |

## Idempotency rules

1. Replaying the same local create request for the same agent, pharmacy, start and end must return the existing visit.
2. Replaying the same HubSpot meeting must resolve through its external link.
3. When an unlinked HubSpot meeting arrives, reconciliation may adopt an unlinked TR1 candidate near the same time, but never a visit already linked to a different HubSpot meeting.
4. A closeout must reuse an existing visit interaction for the same brand instead of inserting a duplicate.
5. External synchronization failure must not invalidate a successfully persisted TR1 business action.

These rules make TR1 the canonical operational record while still allowing HubSpot-origin data to be imported deterministically.
