import { describe, expect, it, vi } from "vitest";
import { HubSpotClient } from "./client";
import type { HubSpotBrandConfiguration } from "./model";
import {
  syncHubSpotNote,
  syncHubSpotVisit,
  type HubSpotExternalLinkStore,
  type HubSpotSyncEvent,
  type HubSpotSyncJournal,
} from "./sync";

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
    pharmacy: { name: "name" },
    product: { name: "name" },
    order: { name: "dealname", pipeline: "pipeline", stage: "dealstage", amountHt: "amount" },
    lineItem: { name: "name", quantity: "quantity", unitPriceHt: "price" },
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
    syncStatuses: ["confirmed"],
    linePricingMode: "unit_price_with_discount",
    freeUnitsMode: "separate_line",
  },
};

function memoryStores() {
  const parents = new Map<string, string>();
  const events: HubSpotSyncEvent[] = [];
  const links: HubSpotExternalLinkStore = {
    async getParent(tr1RecordId) {
      const externalId = parents.get(tr1RecordId);
      return externalId ? { externalId } : null;
    },
    async saveParent(tr1RecordId, externalId) {
      parents.set(tr1RecordId, externalId);
    },
    async getChild() {
      return null;
    },
    async saveChild() {},
  };
  const journal: HubSpotSyncJournal = {
    async record(event) {
      events.push(event);
    },
  };
  return { parents, events, links, journal };
}

function activityFetch() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "POST" && url.endsWith("/crm/v3/objects/meetings")) {
      return new Response(JSON.stringify({ id: "meeting-1" }), { status: 201 });
    }
    if (method === "POST" && url.endsWith("/crm/v3/objects/notes")) {
      return new Response(JSON.stringify({ id: "note-1" }), { status: 201 });
    }
    if (method === "PATCH") {
      return new Response(JSON.stringify({ id: url.split("/").pop() }), { status: 200 });
    }
    if (method === "PUT") {
      return new Response(JSON.stringify({ status: "COMPLETE" }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: "unexpected request" }), { status: 400 });
  });
}

describe("HubSpot activity sync idempotence", () => {
  it("updates the same meeting on a second completed-visit sync", async () => {
    const { parents, events, links, journal } = memoryStores();
    const fetchImpl = activityFetch();
    const client = new HubSpotClient({ mode: "write", accessToken: "server-token", fetchImpl, maxRetries: 0 });
    const visit = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Visite · Pharmacie Test",
      startAt: "2026-09-07T09:00:00Z",
      endAt: "2026-09-07T09:45:00Z",
      outcome: "COMPLETED",
    };

    const first = await syncHubSpotVisit({
      client,
      config,
      visit,
      pharmacyExternalId: "company-1",
      links,
      journal,
    });
    expect(first.externalId).toBe("meeting-1");
    expect(parents.get(visit.id)).toBe("meeting-1");
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "PUT"]);

    const second = await syncHubSpotVisit({
      client,
      config,
      visit: { ...visit, endAt: "2026-09-07T10:00:00Z" },
      pharmacyExternalId: "company-1",
      links,
      journal,
    });
    expect(second.externalId).toBe("meeting-1");
    expect(fetchImpl.mock.calls.slice(2).map(([, init]) => init?.method)).toEqual(["PATCH", "PUT"]);
    expect(events.filter((event) => event.eventType === "update")).toHaveLength(1);
  });

  it("updates the same note on a second sync", async () => {
    const { parents, links, journal } = memoryStores();
    const fetchImpl = activityFetch();
    const client = new HubSpotClient({ mode: "write", accessToken: "server-token", fetchImpl, maxRetries: 0 });
    const note = {
      id: "22222222-2222-4222-8222-222222222222",
      body: "Note terrain\n\nCompte rendu",
      timestamp: "2026-09-07T10:00:00Z",
    };

    await syncHubSpotNote({ client, config, note, pharmacyExternalId: "company-1", links, journal });
    expect(parents.get(note.id)).toBe("note-1");
    await syncHubSpotNote({
      client,
      config,
      note: { ...note, body: "Note terrain\n\nCompte rendu mis à jour" },
      pharmacyExternalId: "company-1",
      links,
      journal,
    });

    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "PUT", "PATCH", "PUT"]);
    expect(fetchImpl.mock.calls.some(([input]) => String(input).endsWith("/crm/v3/objects/notes/note-1"))).toBe(true);
  });
});
