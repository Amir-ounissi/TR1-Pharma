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

export function resolveNaaliHubSpotOrderRoute(roleKey: string) {
  const normalized = roleKey.trim().toLowerCase();
  if (normalized === "agent") return NAALI_HUBSPOT_ORDER_ROUTES.agent;
  if (NAALI_INTERNAL_ORDER_ROLES.has(normalized)) return NAALI_HUBSPOT_ORDER_ROUTES.commercial;
  throw new Error(`Unsupported TR1 role for Naali HubSpot order routing: ${roleKey}`);
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
    },
    meeting: {
      name: "hs_meeting_title",
      startAt: "hs_meeting_start_time",
      endAt: "hs_meeting_end_time",
      timestamp: "hs_timestamp",
      outcome: "hs_meeting_outcome",
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
  },
};
