export const SAAS_CAPABILITIES = [
  "core_crm",
  "orders",
  "agent_day",
  "missions",
  "performance",
  "distribution",
  "assistant_terrain",
  "whatsapp",
  "pdf_order_import",
  "data_mapping",
  "autonomous_onboarding",
  "executive_cockpit",
  "kam_groups",
  "trade_marketing",
  "sell_out",
  "forecast",
  "next_best_action",
  "pharma_360",
  "direction_workspace",
  "connectors",
  "multi_provider",
  "advanced_audit",
  "api_access",
  "sso",
  "custom_roles",
] as const;

export type SaasCapability = (typeof SAAS_CAPABILITIES)[number];

const CAPABILITY_SET = new Set<string>(SAAS_CAPABILITIES);

export type CapabilityDecision = {
  enabled: boolean;
  source: "override" | "plan" | "legacy_full" | "none";
};

export const DEFAULT_BRAND_TERMINOLOGY = {
  field_rep_singular: "Commercial",
  field_rep_plural: "Commerciaux",
  manager_singular: "Manager",
  manager_plural: "Managers",
  pharmacy_singular: "Pharmacie",
  pharmacy_plural: "Pharmacies",
  customer_singular: "Client",
  customer_plural: "Clients",
  initial_order: "Implantation",
  reorder: "Réassort",
  mission_singular: "Mission",
  mission_plural: "Missions",
} as const;

export type BrandTerminology = {
  [K in keyof typeof DEFAULT_BRAND_TERMINOLOGY]: string;
};

export function isSaasCapability(value: string): value is SaasCapability {
  return CAPABILITY_SET.has(value);
}

export function resolveCapabilityDecision(input: {
  planEnabled: boolean;
  legacyFull?: boolean;
  overrideEnabled?: boolean | null;
}): CapabilityDecision {
  if (input.overrideEnabled != null) {
    return { enabled: input.overrideEnabled, source: "override" };
  }
  if (input.legacyFull) return { enabled: true, source: "legacy_full" };
  if (input.planEnabled) return { enabled: true, source: "plan" };
  return { enabled: false, source: "none" };
}

export function resolveBrandTerminology(value: unknown): BrandTerminology {
  const resolved: Record<string, string> = { ...DEFAULT_BRAND_TERMINOLOGY };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return resolved as BrandTerminology;
  }

  const source = value as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_BRAND_TERMINOLOGY)) {
    const candidate = source[key];
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (!normalized || normalized.length > 80) continue;
    resolved[key] = normalized;
  }
  return resolved as BrandTerminology;
}
