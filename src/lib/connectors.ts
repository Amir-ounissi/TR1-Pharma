export const CONNECTOR_PROVIDERS = {
  hubspot: { label: "HubSpot", family: "crm", auth: "oauth" },
  salesforce: { label: "Salesforce", family: "crm", auth: "oauth" },
  dynamics: { label: "Microsoft Dynamics", family: "crm", auth: "oauth" },
  erp: { label: "ERP / gestion commerciale", family: "erp", auth: "external_secret" },
  generic_api: { label: "API générique", family: "api", auth: "external_secret" },
} as const;

export type ConnectorProvider = keyof typeof CONNECTOR_PROVIDERS;
export type ConnectorDirection = "inbound" | "outbound" | "bidirectional";
export type ConnectorSyncDirection = Exclude<ConnectorDirection, "bidirectional">;
export type ConnectorConflictStrategy = "manual" | "external_wins" | "tr1_wins" | "newest_wins";
export type ConnectorConnectionStatus = "draft" | "ready" | "active" | "paused" | "error" | "archived";
export type ConnectorCredentialStatus = "missing" | "configured" | "expired";
export type ConnectorSyncStatus = "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";

export const CONNECTOR_ENTITY_TYPES = ["pharmacies", "contacts", "products", "orders"] as const;
export type ConnectorEntityType = (typeof CONNECTOR_ENTITY_TYPES)[number];

export type ConnectorRecord = {
  externalId: string;
  externalUpdatedAt?: string | null;
  payload: Record<string, unknown>;
};

export type ConnectorPullRequest = {
  entityType: ConnectorEntityType;
  externalObject: string;
  cursor?: string | null;
  limit: number;
};

export type ConnectorPullBatch = {
  records: ConnectorRecord[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ConnectorPushRecord = {
  tr1RecordId: string;
  externalId?: string | null;
  payload: Record<string, unknown>;
};

export type ConnectorPushResult = {
  tr1RecordId: string;
  externalId: string;
  externalUpdatedAt?: string | null;
};

/**
 * Contract implemented by provider adapters. Domain code only speaks this
 * normalized language and never imports HubSpot/Salesforce/Dynamics SDK types.
 * Credentials are resolved by the trusted runtime from credentialReference;
 * they are never passed through public connector configuration.
 */
export interface ConnectorAdapter {
  readonly provider: ConnectorProvider;
  pull(request: ConnectorPullRequest): Promise<ConnectorPullBatch>;
  push?(entityType: ConnectorEntityType, records: ConnectorPushRecord[]): Promise<ConnectorPushResult[]>;
}

const SECRET_KEYS = new Set([
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "client_secret",
  "password",
  "secret",
  "bearer_token",
]);

export function isConnectorProvider(value: string): value is ConnectorProvider {
  return Object.prototype.hasOwnProperty.call(CONNECTOR_PROVIDERS, value);
}

export function connectorProviderLabel(provider: ConnectorProvider) {
  return CONNECTOR_PROVIDERS[provider].label;
}

export function connectorStatusLabel(status: ConnectorConnectionStatus) {
  return ({
    draft: "Brouillon",
    ready: "Prêt",
    active: "Actif",
    paused: "En pause",
    error: "Erreur",
    archived: "Archivé",
  } as const)[status];
}

export function connectorCredentialLabel(status: ConnectorCredentialStatus) {
  return ({ missing: "À configurer", configured: "Configuré", expired: "À renouveler" } as const)[status];
}

export function connectorDirectionLabel(direction: ConnectorDirection) {
  return ({ inbound: "Vers TR1", outbound: "Depuis TR1", bidirectional: "Bidirectionnel" } as const)[direction];
}

export function isSafeConnectorConfiguration(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return !containsSecretKey(value as Record<string, unknown>);
}

function containsSecretKey(value: Record<string, unknown>): boolean {
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEYS.has(key.toLowerCase())) return true;
    if (nested && typeof nested === "object") {
      if (Array.isArray(nested)) {
        if (nested.some((item) => item && typeof item === "object" && containsSecretKey(item as Record<string, unknown>))) return true;
      } else if (containsSecretKey(nested as Record<string, unknown>)) {
        return true;
      }
    }
  }
  return false;
}

export function normalizeConnectorBaseUrl(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function isCredentialReference(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return false;
  return /^(?:vault|secret|oauth):\/\/[a-z0-9][a-z0-9/_:.-]{2,240}$/i.test(candidate);
}

export function connectorSourceSystem(provider: ConnectorProvider, externalObject: string) {
  const object = externalObject
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${provider}_${object || "object"}`.slice(0, 120);
}

export function summarizeConnectorConnections(rows: Array<{ status: ConnectorConnectionStatus; credential_status: ConnectorCredentialStatus }>) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    ready: rows.filter((row) => row.status === "ready").length,
    errors: rows.filter((row) => row.status === "error").length,
    credentialsToConfigure: rows.filter((row) => row.credential_status !== "configured").length,
  };
}
