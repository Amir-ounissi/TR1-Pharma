# Connectors runtime boundary

The `/dashboard/connectors` workspace configures connector metadata only. It never calls a CRM, ERP or external API directly.

Provider adapters run in a trusted backend/runtime. They resolve `credential_reference` outside the public database, normalize provider payloads to the TR1 canonical model, execute the configured mapping profile, and persist sync metadata through the service-role-only RPCs.

Rules:

- no access token, refresh token, API key, password or client secret in `configuration`;
- `credential_reference` is an opaque `oauth://`, `vault://` or `secret://` locator, never the credential value;
- external provider IDs are linked to canonical TR1 record IDs through `connector_external_links`;
- inbound/outbound runs are traced in `connector_sync_runs`;
- conflicts follow the mapping configuration and never bypass tenant isolation or TR1 validation;
- provider SDK types stay inside adapters and do not enter TR1 domain code.
