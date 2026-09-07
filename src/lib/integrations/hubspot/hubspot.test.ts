import { describe, expect, it, vi } from "vitest";
import { HubSpotClient } from "./client";
import { mapMeetingToHubSpot, mapNoteToHubSpot, mapOrderToHubSpot, mapPharmacyToHubSpot } from "./mappers";
import { assertHubSpotBrandConfiguration, type HubSpotBrandConfiguration } from "./model";

const config: HubSpotBrandConfiguration = {
  objects: {
    companies: "companies",
    products: "products",
    deals: "deals",
    lineItems: "line_items",
    meetings: "meetings",
    notes: "notes",
  },
  properties: {
    pharmacy: { name: "name", address: "address", postalCode: "zip", city: "city", phone: "phone" },
    product: { name: "name", sku: "hs_sku", unitPriceHt: "price" },
    order: {
      name: "dealname",
      orderNumber: "tr1_order_number",
      orderDate: "closedate",
      amountHt: "amount",
      currency: "deal_currency_code",
      pipeline: "pipeline",
      stage: "dealstage",
    },
    lineItem: {
      name: "name",
      sku: "hs_sku",
      productExternalId: "tr1_product_id",
      quantity: "quantity",
      unitPriceHt: "price",
      discountPercent: "hs_discount_percentage",
      vatRate: "tr1_vat_rate",
      isFreeUnit: "tr1_is_free_unit",
    },
    meeting: { name: "hs_meeting_title", startAt: "hs_timestamp", endAt: "hs_meeting_end_time", outcome: "hs_meeting_outcome" },
    note: { body: "hs_note_body", timestamp: "hs_timestamp" },
  },
  deal: { pipeline: "pipeline-id", confirmedStage: "confirmed-stage-id" },
  order: {
    syncStatuses: ["confirmed", "invoiced", "partially_delivered", "delivered"],
    linePricingMode: "unit_price_with_discount",
    freeUnitsMode: "separate_line",
    freeUnitNameSuffix: "UG",
  },
};

describe("HubSpot brand mapping", () => {
  it("keeps provider IDs outside payloads when the brand has no TR1 custom property", () => {
    expect(() => assertHubSpotBrandConfiguration(config)).not.toThrow();
    expect(mapPharmacyToHubSpot({ id: "pharmacy-1", name: "Pharmacie Test", city: "Nîmes" }, config)).toEqual({
      tr1RecordId: "pharmacy-1",
      idProperty: undefined,
      properties: { name: "Pharmacie Test", city: "Nîmes" },
    });
  });

  it("maps confirmed order amount from TR1 without recomputing VAT and separates free units", () => {
    const mapped = mapOrderToHubSpot({
      id: "order-1",
      orderNumber: "CMD-001",
      status: "confirmed",
      orderDate: "2026-09-07T08:00:00.000Z",
      netAmountHt: 108,
      taxAmount: 21.6,
      amountTtc: 129.6,
      currency: "EUR",
      lines: [{
        id: "line-1",
        productId: "product-1",
        name: "Produit A",
        sku: "SKU-A",
        quantity: 12,
        freeQuantity: 2,
        unitPriceHt: 10,
        discountPercent: 10,
        vatRate: 20,
      }],
    }, config);

    expect(mapped.deal.properties.amount).toBe("108");
    expect(mapped.lineItems).toHaveLength(2);
    expect(mapped.lineItems[0].properties).toMatchObject({ quantity: "12", price: "10", hs_discount_percentage: "10", tr1_is_free_unit: "false" });
    expect(mapped.lineItems[1].tr1RecordId).toBe("line-1:free");
    expect(mapped.lineItems[1].properties).toMatchObject({ quantity: "2", price: "0", tr1_is_free_unit: "true" });
  });

  it("never exports an unvalidated order status", () => {
    expect(() => mapOrderToHubSpot({
      id: "order-draft",
      orderNumber: "DRAFT",
      status: "draft",
      orderDate: "2026-09-07",
      netAmountHt: 0,
      lines: [],
    }, config)).toThrow(/not configured/);
  });

  it("maps visits and notes as provider-neutral activities", () => {
    expect(mapMeetingToHubSpot({ id: "visit-1", title: "Visite", startAt: "2026-09-07T09:00:00Z", outcome: "good" }, config).properties).toMatchObject({
      hs_meeting_title: "Visite",
      hs_timestamp: "2026-09-07T09:00:00Z",
      hs_meeting_outcome: "good",
    });
    expect(mapNoteToHubSpot({ id: "note-1", body: "Compte rendu", timestamp: "2026-09-07T10:00:00Z" }, config).properties).toMatchObject({
      hs_note_body: "Compte rendu",
    });
  });
});

describe("HubSpot client write safety", () => {
  it("performs zero HTTP calls in dry-run and disabled modes", async () => {
    const fetchImpl = vi.fn();
    const dryRun = new HubSpotClient({ mode: "dry_run", accessToken: "server-token", fetchImpl });
    const disabled = new HubSpotClient({ mode: "disabled", fetchImpl });

    await dryRun.createObject("deals", { dealname: "Dry run" });
    await dryRun.associateDefault("deals", "1", "companies", "2");
    await disabled.updateObject("deals", "1", { amount: "100" });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries 429 and 5xx with bounded retry behavior", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "rate limited" }), { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "temporary" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "123" }), { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new HubSpotClient({ mode: "write", accessToken: "server-token", fetchImpl, sleep, maxRetries: 3 });

    const result = await client.createObject<{ id: string }>("companies", { name: "Pharmacie" });
    expect(result.data).toEqual({ id: "123" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("surfaces safe provider metadata after retries are exhausted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Service unavailable", correlationId: "corr-1" }), { status: 503 }));
    const client = new HubSpotClient({ mode: "write", accessToken: "server-token", fetchImpl, sleep: async () => undefined, maxRetries: 0 });

    await expect(client.createObject("deals", { dealname: "Test" })).rejects.toMatchObject({
      status: 503,
      correlationId: "corr-1",
      retryable: true,
    });
  });
});
