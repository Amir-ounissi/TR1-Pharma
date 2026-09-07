import type { HubSpotBrandConfiguration } from "./model";

// Portal-specific values live here, never in the generic HubSpot runtime.
// Pipeline/property names were verified read-only against the connected Naali portal.
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
    },
    order: {
      name: "dealname",
      amountHt: "amount",
      currency: "deal_currency_code",
      pipeline: "pipeline",
      stage: "dealstage",
    },
    lineItem: {
      name: "name",
      sku: "hs_sku",
      quantity: "quantity",
      unitPriceHt: "price",
      discountPercent: "hs_discount_percentage",
    },
    meeting: {
      name: "hs_meeting_title",
      startAt: "hs_meeting_start_time",
      endAt: "hs_meeting_end_time",
      timestamp: "hs_timestamp",
    },
    note: {
      body: "hs_note_body",
      timestamp: "hs_timestamp",
    },
  },
  deal: {
    // Transactions – Commerciaux Naali
    pipeline: "1543644371",
    // À vérifier par ADV
    confirmedStage: "5786904809",
  },
  order: {
    syncStatuses: ["confirmed", "invoiced", "partially_delivered", "delivered"],
    linePricingMode: "unit_price_with_discount",
    freeUnitsMode: "separate_line",
    freeUnitNameSuffix: "UG",
  },
};
