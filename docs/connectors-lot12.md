# Lot 12 — Connectors

Scope: provider-neutral CRM/ERP/API architecture without making TR1 dependent on an external CRM.

Included in this lot:

- brand-scoped connector connections with RLS;
- non-sensitive connector configuration and opaque credential references only;
- Data Mapping Studio profile linkage per external object;
- inbound, outbound and bidirectional mapping intent;
- explicit conflict strategies;
- external ID ↔ canonical TR1 ID links;
- trusted-backend-only sync run registration/completion and identity-link mutation;
- admin workspace `/dashboard/connectors` behind the `connectors` capability;
- navigation, unit, pgTAP and Playwright coverage.

Not included: live HubSpot/Salesforce/Dynamics credentials or network calls. Provider-specific adapters are activated only after runtime credentials and a deployment-specific integration are configured.
