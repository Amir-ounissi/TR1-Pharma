import type { HubSpotBrandConfiguration } from "./model";

export const NAALI_HUBSPOT_ORDER_ROUTES = {
  commercial: {
    pipeline: "1543644371",
    confirmedStage: "5786904809",
    origin: "Commercial Naali",
  },
  agent: {
    pipeline: "1543733493",
    confirmedStage: "5787550915",
    origin: "Agent",
  },
} as const;

const NAALI_INTERNAL_ORDER_ROLES = new Set([
  "super_admin",
  "tr1_manager",
  "brand_admin",
  "brand_user",
  "brand_direction",
]);

const NAALI_COMMERCIAL_HUBSPOT_OWNER_IDS = new Set([
  "727665403", // Amir Ounissi
]);

const NAALI_HUBSPOT_VISIT_TYPES: Record<string, string> = {
  client_visit: "Visite client",
  prospecting: "Visite prospection",
  relationship: "Rendez-vous client",
  merchandising: "Visite client",
  sell_out: "Visite client",
};

const NAALI_HUBSPOT_ORDER_TYPES: Record<string, string> = {
  initial: "Implantation",
  implantation: "Implantation",
  reorder: "Réassort",
  restock: "Réassort",
};

export function resolveNaaliHubSpotOrderRoute(roleKey: string, ownerExternalId?: string | null) {
  const normalizedOwner = ownerExternalId?.trim();
  if (normalizedOwner && NAALI_COMMERCIAL_HUBSPOT_OWNER_IDS.has(normalizedOwner)) {
    return NAALI_HUBSPOT_ORDER_ROUTES.commercial;
  }

  const normalized = roleKey.trim().toLowerCase();
  if (normalized === "agent") return NAALI_HUBSPOT_ORDER_ROUTES.agent;
  if (NAALI_INTERNAL_ORDER_ROLES.has(normalized)) return NAALI_HUBSPOT_ORDER_ROUTES.commercial;
  throw new Error(`Unsupported TR1 role for Naali HubSpot order routing: ${roleKey}`);
}

export function resolveNaaliHubSpotVisitType(visitKind: string) {
  const normalized = visitKind.trim().toLowerCase();
  const activityType = NAALI_HUBSPOT_VISIT_TYPES[normalized];
  if (!activityType) throw new Error(`Unsupported TR1 visit kind for Naali HubSpot sync: ${visitKind}`);
  return activityType;
}

export function resolveNaaliHubSpotOrderType(orderType: string | null | undefined) {
  const normalized = orderType?.trim().toLowerCase();
  return normalized ? NAALI_HUBSPOT_ORDER_TYPES[normalized] ?? null : null;
}

// Portal-specific values live here, never in the generic HubSpot runtime.
// Pipeline/property names and route values were verified read-only against the connected Naali portal.
export const NAALI_HUBSPOT_CONFIGURATION: HubSpotBrandConfiguration = {
  objects: {
    companies: "companies",
    products: "products",
    deals: "deals",
    lineItems: "line_items",
    meetings: "meetings",
    notes: "notes",
  },
  properties: {
    pharmacy: {
      name: "name",
      address: "address",
      postalCode: "zip",
      city: "city",
      phone: "phone",
      email: "e_mail",
    },
    product: {
      name: "name",
      sku: "hs_sku",
      primaryProductExternalId: "primary_product_id",
      productType: "type_de_produit_naali",
    },
    order: {
      name: "dealname",
      amountHt: "amount",
      currency: "deal_currency_code",
      ownerId: "hubspot_owner_id",
      origin: "origine_de_la_commande",
      orderType: "type_de_commande",
      pipeline: "pipeline",
      stage: "dealstage",
    },
    lineItem: {
      name: "name",
      description: "description",
      sku: "hs_sku",
      productExternalId: "hs_product_id",
      primaryProductExternalId: "primary_product_id",
      productType: "type_de_produit_naali",
      quantity: "quantity",
      unitPriceHt: "price",
      discountPercent: "hs_discount_percentage",
      taxRateGroupId: "hs_tax_rate_group_id",
      freeUnitReason: "test_type_dug",
    },
    meeting: {
      name: "hs_meeting_title",
      startAt: "hs_meeting_start_time",
      endAt: "hs_meeting_end_time",
      timestamp: "hs_timestamp",
      outcome: "hs_meeting_outcome",
      ownerId: "hubspot_owner_id",
      activityType: "hs_activity_type",
      body: "hs_meeting_body",
      internalNotes: "hs_internal_meeting_notes",
    },
    note: {
      body: "hs_note_body",
      timestamp: "hs_timestamp",
    },
  },
  deal: {
    pipeline: NAALI_HUBSPOT_ORDER_ROUTES.commercial.pipeline,
    confirmedStage: NAALI_HUBSPOT_ORDER_ROUTES.commercial.confirmedStage,
  },
  order: {
    syncStatuses: ["pending", "confirmed", "invoiced", "partially_delivered", "delivered"],
    linePricingMode: "unit_price_with_discount",
    freeUnitsMode: "separate_line",
    freeUnitNamePrefix: "UG",
    freeUnitReasonValue: "conditions commerciale client",
    taxRateGroupIds: {
      "2": "115968336",
      "2.1": "115991071",
      "3": "116915187",
      "5.5": "115989351",
      "8.1": "116087659",
      "21": "117518330",
    },
  },
};