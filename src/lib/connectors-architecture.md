# Connector architecture invariants

TR1 remains the system of record for its canonical commercial model. External CRM/ERP schemas are adapters, not domain types.

1. A `connector_connection` is brand-scoped and contains only non-sensitive metadata plus an opaque credential locator.
2. A `connector_entity_mapping` binds one external object to one canonical TR1 entity and can reuse a Data Mapping Studio profile.
3. Bidirectional mappings are expanded into explicit inbound and outbound runs; sync execution is never performed from a browser request.
4. `connector_sync_runs` is append-oriented execution telemetry. Trusted runtime RPCs are service-role-only.
5. `connector_external_links` persists external identity ↔ TR1 canonical record identity without replacing canonical IDs.
6. Tenant authorization stays in PostgreSQL/RLS; provider adapters do not grant data access.
7. Manual conflict strategy is the default. Automatic conflict resolution must be explicitly configured.
