import type { HubSpotBrandConfiguration, HubSpotPropertyMap } from "./model";

export type HubSpotAdminMappingEntity = "orders" | "visits";

export type HubSpotMappingTransforms = {
  orderTypeValues: Record<string, string>;
  visitTypeValues: Record<string, string>;
};

export const TR1_ORDER_TYPE_KEYS = [
  "initial",
  "reorder",
  "complementary",
  "replacement",
  "sample",
  "return",
  "credit_note",
  "other",
] as const;

export const TR1_VISIT_KIND_KEYS = [
  "client_visit",
  "prospecting",
  "relationship",
  "training",
  "other",
] as const;

export const HUBSPOT_ORDER_TYPE_OPTIONS = [
  "Implantation",
  "Réassort",
  "Précommande de lancement",
  "Précommande rupture",
  "Commande différée",
  "Complément d'implantation",
  "Complément de réassort",
] as const;

export const HUBSPOT_ACTIVITY_TYPE_OPTIONS = [
  "Appel prospection",
  "Appel client",
  "Visite prospection",
  "Visite client",
  "Rendez-vous prospect",
  "Rendez-vous client",
  "Formation",
  "Animation",
  "Suivi agent",
] as const;

export const ORDER_PROPERTY_KEYS = [
  "name",
  "orderNumber",
  "orderDate",
  "orderType",
  "amountHt",
  "taxAmount",
  "amountTtc",
  "currency",
  "ownerId",
  "origin",
  "pipeline",
  "stage",
] as const satisfies readonly (keyof HubSpotPropertyMap)[];

export const MEETING_PROPERTY_KEYS = [
  "name",
  "startAt",
  "endAt",
  "timestamp",
  "outcome",
  "ownerId",
  "activityType",
  "body",
  "internalNotes",
] as const satisfies readonly (keyof HubSpotPropertyMap)[];

const SAFE_PROPERTY_NAME = /^[a-zA-Z0-9_.-]{1,160}$/;
const ORDER_TYPE_TARGETS = new Set<string>(HUBSPOT_ORDER_TYPE_OPTIONS);
const VISIT_TYPE_TARGETS = new Set<string>(HUBSPOT_ACTIVITY_TYPE_OPTIONS);

export function isSafeHubSpotPropertyName(value: string) {
  return SAFE_PROPERTY_NAME.test(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mergePropertyMap(
  base: HubSpotPropertyMap,
  rawMapping: unknown,
  allowedKeys: readonly (keyof HubSpotPropertyMap)[],
) {
  const next: HubSpotPropertyMap = { ...base };
  const mapping = objectValue(rawMapping);
  const allowed = new Set<string>(allowedKeys);

  for (const [key, rawValue] of Object.entries(mapping)) {
    if (!allowed.has(key)) continue;
    if (typeof rawValue !== "string") continue;
    const value = rawValue.trim();
    if (!value) {
      delete next[key as keyof HubSpotPropertyMap];
      continue;
    }
    if (!isSafeHubSpotPropertyName(value)) {
      throw new Error(`Invalid HubSpot property override for ${key}`);
    }
    next[key as keyof HubSpotPropertyMap] = value;
  }

  return next;
}

function normalizeValueMap(
  raw: unknown,
  allowedSourceKeys: readonly string[],
  allowedTargets: Set<string>,
) {
  const source = objectValue(raw);
  const allowedSources = new Set(allowedSourceKeys);
  const result: Record<string, string> = {};

  for (const [sourceKey, rawTarget] of Object.entries(source)) {
    if (!allowedSources.has(sourceKey) || typeof rawTarget !== "string") continue;
    const target = rawTarget.trim();
    if (!target) {
      result[sourceKey] = "";
      continue;
    }
    if (!allowedTargets.has(target)) {
      throw new Error(`Unsupported HubSpot mapped value for ${sourceKey}`);
    }
    result[sourceKey] = target;
  }

  return result;
}

export function buildHubSpotRuntimeProfile(options: {
  baseConfig: HubSpotBrandConfiguration;
  entityType: "orders" | "visits" | "notes";
  mapping?: unknown;
  transforms?: unknown;
}) {
  const { baseConfig, entityType } = options;
  const mapping = objectValue(options.mapping);
  const transforms = objectValue(options.transforms);
  const config: HubSpotBrandConfiguration = {
    ...baseConfig,
    objects: { ...baseConfig.objects },
    properties: {
      pharmacy: { ...baseConfig.properties.pharmacy },
      product: { ...baseConfig.properties.product },
      order: { ...baseConfig.properties.order },
      lineItem: { ...baseConfig.properties.lineItem },
      meeting: { ...baseConfig.properties.meeting },
      note: { ...baseConfig.properties.note },
    },
    deal: { ...baseConfig.deal },
    order: { ...baseConfig.order, syncStatuses: [...baseConfig.order.syncStatuses] },
  };

  if (entityType === "orders") {
    config.properties.order = mergePropertyMap(
      baseConfig.properties.order,
      mapping.order,
      ORDER_PROPERTY_KEYS,
    );
  } else if (entityType === "visits") {
    config.properties.meeting = mergePropertyMap(
      baseConfig.properties.meeting,
      mapping.meeting,
      MEETING_PROPERTY_KEYS,
    );
  }

  return {
    config,
    transforms: {
      orderTypeValues: normalizeValueMap(
        transforms.orderTypeValues,
        TR1_ORDER_TYPE_KEYS,
        ORDER_TYPE_TARGETS,
      ),
      visitTypeValues: normalizeValueMap(
        transforms.visitTypeValues,
        TR1_VISIT_KIND_KEYS,
        VISIT_TYPE_TARGETS,
      ),
    } satisfies HubSpotMappingTransforms,
  };
}

export function resolveHubSpotMappedValue(
  values: Record<string, string>,
  sourceValue: string | null | undefined,
  fallback: string | null,
) {
  const key = sourceValue?.trim().toLowerCase();
  if (!key || !Object.prototype.hasOwnProperty.call(values, key)) return fallback;
  return values[key]?.trim() || null;
}
