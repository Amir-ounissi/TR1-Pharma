import { describe, expect, it, vi } from "vitest";
import { HubSpotClient } from "./client";
import { mapMeetingToHubSpot, mapNoteToHubSpot, mapOrderToHubSpot, mapPharmacyToHubSpot } from "./mappers";
import { assertHubSpotBrandConfiguration, type HubSpotBrandConfiguration } from "./model";
import { syncHubSpotOrder, type HubSpotExternalLinkStore, type HubSpotSyncEvent, type HubSpotSyncJournal } from "./sync";

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
      ownerId: "hubspot_owner_id",
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
    meeting: {
      name: "hs_meeting_title",
      startAt: "hs_meeting_start_time",
      endAt: "hs_meeting_end_time",
      timestamp: "hs_timestamp",
      outcome: "hs_meeting_outcome",
    },
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

const confirmedOrder = {
  id: "order-1",
  orderNumber: "CMD-001",
  status: "confirmed",
  orderDate: "2026-09-07T08:00:00.000Z",
  netAmountHt: 108,
  taxAmount: 21.6,
  amountTtc: 129.6,
  currency: "EUR",
  ownerExternalId: "owner-123",
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

  it("maps confirmed order amount and owner from TR1 without recomputing VAT and separates free units", () => {
    const mapped = mapOrderToHubSpot(confirmedOrder, config);

    expect(mapped.deal.properties.amount).toBe("108");
    expect(mapped.deal.properties.hubspot_owner_id).toBe("owner-123");
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
    expect(mapMeetingToHubSpot({
      id: "visit-1",
      title: "Visite",
      startAt: "2026-09-07T09:00:00Z",
      outcome: "COMPLETED",
    }, config).properties).toMatchObject({
      hs_meeting_title: "Visite",
      hs_meeting_start_time: "2026-09-07T09:00:00Z",
      hs_timestamp: "2026-09-07T09:00:00Z",
      hs_meeting_outcome: "COMPLETED",
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

describe("HubSpot order sync idempotence", () => {
  it("updates the same deal, paid line and UG line on a second sync", async () => {
    const parents = new Map<string, string>();
    const children = new Map<string, string>();
    const events: HubSpotSyncEvent[] = [];

    const links: HubSpotExternalLinkStore = {
      async getParent(tr1RecordId) {
        const externalId = parents.get(tr1RecordId);
        return externalId ? { externalId } : null;
      },
      async saveParent(tr1RecordId, externalId) {
        parents.set(tr1RecordId, externalId);
      },
      async getChild(parentTr1RecordId, childKey) {
        const externalId = children.get(`${parentTr1RecordId}:${childKey}`);
        return externalId ? { externalId } : null;
      },
      async saveChild(parentTr1RecordId, childKey, externalId) {
        children.set(`${parentTr1RecordId}:${childKey}`, externalId);
      },
    };
    const journal: HubSpotSyncJournal = {
      async record(event) {
        events.push(event);
      },
    };

    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url.endsWith("/crm/v3/objects/deals")) {
        const payload = JSON.parse(String(init?.body ?? "{}")) as { properties?: Record<string, string> };
        expect(payload.properties?.hubspot_owner_id).toBe("owner-123");
        return new Response(JSON.stringify({ id: "deal-1" }), { status: 201 });
      }
      if (method === "POST" && url.endsWith("/crm/v3/objects/line_items")) {
        const payload = JSON.parse(String(init?.body ?? "{}")) as { properties?: Record<string, string> };
        const id = payload.properties?.tr1_is_free_unit === "true" ? "line-free-1" : "line-paid-1";
        return new Response(JSON.stringify({ id }), { status: 201 });
      }
      if (method === "PATCH") {
        if (url.endsWith("/crm/v3/objects/deals/deal-1")) {
          const payload = JSON.parse(String(init?.body ?? "{}")) as { properties?: Record<string, string> };
          expect(payload.properties?.hubspot_owner_id).toBe("owner-123");
        }
        return new Response(JSON.stringify({ id: url.split("/").pop() }), { status: 200 });
      }
      if (method === "PUT") {
        return new Response(JSON.stringify({ status: "COMPLETE" }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: "unexpected request" }), { status: 400 });
    });

    const client = new HubSpotClient({ mode: "write", accessToken: "server-token", fetchImpl, maxRetries: 0 });
    const first = await syncHubSpotOrder({
      client,
      config,
      order: confirmedOrder,
      pharmacyExternalId: "company-1",
      links,
      journal,
    });

    expect(first.dealExternalId).toBe("deal-1");
    expect(first.lineItemExternalIds).toEqual({ "line-1": "line-paid-1", "line-1:free": "line-free-1" });
    expect(parents.get("order-1")).toBe("deal-1");
    expect(children.get("order-1:line-1")).toBe("line-paid-1");
    expect(children.get("order-1:line-1:free")).toBe("line-free-1");

    const firstCallCount = fetchImpl.mock.calls.length;
    expect(firstCallCount).toBe(6);

    const second = await syncHubSpotOrder({
      client,
      config,
      order: { ...confirmedOrder, netAmountHt: 117 },
      pharmacyExternalId: "company-1",
      links,
      journal,
    });

    expect(second.dealExternalId).toBe("deal-1");
    expect(second.lineItemExternalIds).toEqual({ "line-1": "line-paid-1", "line-1:free": "line-free-1" });

    const secondCalls = fetchImpl.mock.calls.slice(firstCallCount);
    expect(secondCalls).toHaveLength(6);
    expect(secondCalls.map(([, init]) => init?.method)).toEqual(["PATCH", "PUT", "PATCH", "PUT", "PATCH", "PUT"]);
    expect(secondCalls.some(([input]) => String(input).endsWith("/crm/v3/objects/deals/deal-1"))).toBe(true);
    expect(secondCalls.some(([input]) => String(input).endsWith("/crm/v3/objects/line_items/line-paid-1"))).toBe(true);
    expect(secondCalls.some(([input]) => String(input).endsWith("/crm/v3/objects/line_items/line-free-1"))).toBe(true);
    expect(secondCalls.some(([, init]) => init?.method === "POST")).toBe(false);

    const secondPassObjectEvents = events.slice(6).filter((event) => event.eventType === "update");
    expect(secondPassObjectEvents.map((event) => event.childKey ?? "deal")).toEqual(["deal", "line-1", "line-1:free"]);
  });
});
