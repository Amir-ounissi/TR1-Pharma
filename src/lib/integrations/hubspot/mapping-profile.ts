import type { ConnectorEntityType } from "@/lib/connectors";
import type { HubSpotBrandConfiguration, HubSpotPropertyMap } from "./model";

export type HubSpotFieldMappingEntity = Extract<ConnectorEntityType, "orders" | "visits" | "notes">;

type PropertyGroup = "order" | "lineItem" | "meeting" | "note";

type HubSpotFieldDefinition = {
  key: string;
  group: PropertyGroup;
  property: keyof HubSpotPropertyMap;
  label: string;
  description: string;
};

const SAFE_HUBSPOT_PROPERTY = /^[a-zA-Z0-9_.-]{1,160}$/;

export const HUBSPOT_FIELD_DEFINITIONS: Record<HubSpotFieldMappingEntity, HubSpotFieldDefinition[]> = {
  orders: [
    { key: "order.name", group: "order", property: "name", label: "Nom du deal", description: "Nom affiché de la commande dans HubSpot." },
    { key: "order.orderNumber", group: "order", property: "orderNumber", label: "N° de commande", description: "Numéro de commande TR1." },
    { key: "order.orderDate", group: "order", property: "orderDate", label: "Date de commande", description: "Date de la commande." },
    { key: "order.orderType", group: "order", property: "orderType", label: "Type de commande", description: "Implantation, réassort…" },
    { key: "order.amountHt", group: "order", property: "amountHt", label: "Montant HT", description: "Montant net HT de la commande." },
    { key: "order.taxAmount", group: "order", property: "taxAmount", label: "Montant TVA", description: "Montant de TVA de la commande." },
    { key: "order.amountTtc", group: "order", property: "amountTtc", label: "Montant TTC", description: "Montant total TTC." },
    { key: "order.currency", group: "order", property: "currency", label: "Devise", description: "Devise du deal." },
    { key: "order.ownerId", group: "order", property: "ownerId", label: "Propriétaire", description: "Owner HubSpot associé au commercial." },
    { key: "order.origin", group: "order", property: "origin", label: "Origine commande", description: "Origine commerciale de la commande." },
    { key: "order.pipeline", group: "order", property: "pipeline", label: "Pipeline", description: "Champ HubSpot contenant l’identifiant du pipeline." },
    { key: "order.stage", group: "order", property: "stage", label: "Étape", description: "Champ HubSpot contenant l’étape du deal." },
    { key: "lineItem.name", group: "lineItem", property: "name", label: "Ligne · Nom produit", description: "Nom du produit sur la ligne de commande." },
    { key: "lineItem.description", group: "lineItem", property: "description", label: "Ligne · Description", description: "Description de la ligne / UG." },
    { key: "lineItem.sku", group: "lineItem", property: "sku", label: "Ligne · SKU", description: "Référence produit." },
    { key: "lineItem.productExternalId", group: "lineItem", property: "productExternalId", label: "Ligne · Produit HubSpot", description: "Référence au produit du catalogue HubSpot." },
    { key: "lineItem.primaryProductExternalId", group: "lineItem", property: "primaryProductExternalId", label: "Ligne · Produit principal", description: "Lien entre une UG et son produit principal." },
    { key: "lineItem.productType", group: "lineItem", property: "productType", label: "Ligne · Type produit", description: "Type de produit normal / UG." },
    { key: "lineItem.quantity", group: "lineItem", property: "quantity", label: "Ligne · Quantité", description: "Quantité facturée ou gratuite." },
    { key: "lineItem.unitPriceHt", group: "lineItem", property: "unitPriceHt", label: "Ligne · Prix unitaire HT", description: "Prix unitaire HT." },
    { key: "lineItem.discountPercent", group: "lineItem", property: "discountPercent", label: "Ligne · Remise", description: "Pourcentage de remise." },
    { key: "lineItem.vatRate", group: "lineItem", property: "vatRate", label: "Ligne · TVA", description: "Taux de TVA." },
  ],
  visits: [
    { key: "meeting.name", group: "meeting", property: "name", label: "Titre", description: "Titre de l’activité HubSpot." },
    { key: "meeting.startAt", group: "meeting", property: "startAt", label: "Début", description: "Date et heure de début." },
    { key: "meeting.endAt", group: "meeting", property: "endAt", label: "Fin", description: "Date et heure de fin." },
    { key: "meeting.timestamp", group: "meeting", property: "timestamp", label: "Horodatage activité", description: "Timestamp principal de l’activité HubSpot." },
    { key: "meeting.outcome", group: "meeting", property: "outcome", label: "Résultat", description: "Résultat / statut du rendez-vous." },
    { key: "meeting.ownerId", group: "meeting", property: "ownerId", label: "Propriétaire", description: "Owner HubSpot du rendez-vous." },
    { key: "meeting.activityType", group: "meeting", property: "activityType", label: "Type d’activité", description: "Visite client, prospection, rendez-vous…" },
    { key: "meeting.body", group: "meeting", property: "body", label: "Compte rendu", description: "Contenu principal de la visite." },
    { key: "meeting.internalNotes", group: "meeting", property: "internalNotes", label: "Notes internes", description: "Notes internes liées à la visite." },
  ],
  notes: [
    { key: "note.body", group: "note", property: "body", label: "Contenu", description: "Corps de la note HubSpot." },
    { key: "note.timestamp", group: "note", property: "timestamp", label: "Horodatage", description: "Date et heure de la note." },
  ],
};

export function isHubSpotFieldMappingEntity(value: string): value is HubSpotFieldMappingEntity {
  return value === "orders" || value === "visits" || value === "notes";
}

export function defaultHubSpotFieldMapping(
  config: HubSpotBrandConfiguration,
  entityType: HubSpotFieldMappingEntity,
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const definition of HUBSPOT_FIELD_DEFINITIONS[entityType]) {
    const value = config.properties[definition.group][definition.property];
    if (value) mapping[definition.key] = value;
  }
  return mapping;
}

export function normalizeHubSpotFieldMapping(
  entityType: HubSpotFieldMappingEntity,
  mapping: Record<string, unknown>,
): Record<string, string> {
  const allowed = new Set(HUBSPOT_FIELD_DEFINITIONS[entityType].map((definition) => definition.key));
  const normalized: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(mapping)) {
    if (!allowed.has(key)) throw new Error(`Unsupported HubSpot mapping field: ${key}`);
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;
    if (typeof rawValue !== "string") throw new Error(`Invalid HubSpot property for ${key}`);
    const value = rawValue.trim();
    if (!SAFE_HUBSPOT_PROPERTY.test(value)) throw new Error(`Invalid HubSpot property for ${key}`);
    normalized[key] = value;
  }

  return normalized;
}

export function applyHubSpotFieldMapping(
  baseConfig: HubSpotBrandConfiguration,
  entityType: HubSpotFieldMappingEntity,
  rawMapping: Record<string, unknown> | null | undefined,
): HubSpotBrandConfiguration {
  if (!rawMapping || Object.keys(rawMapping).length === 0) return baseConfig;
  const mapping = normalizeHubSpotFieldMapping(entityType, rawMapping);
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

  for (const definition of HUBSPOT_FIELD_DEFINITIONS[entityType]) {
    const value = mapping[definition.key];
    if (value) config.properties[definition.group][definition.property] = value;
  }

  return config;
}
