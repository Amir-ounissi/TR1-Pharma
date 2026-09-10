import { describe, expect, it } from "vitest";
import { mapMeetingToHubSpot, mapOrderToHubSpot } from "./mappers";
import {
  NAALI_HUBSPOT_CONFIGURATION,
  resolveNaaliHubSpotOrderType,
  resolveNaaliHubSpotVisitType,
} from "./naali";

describe("Naali HubSpot activity mapping", () => {
  it("maps a TR1 client visit to a HubSpot meeting with owner, type and report body", () => {
    const mapped = mapMeetingToHubSpot({
      id: "visit-1",
      title: "Visite · Pharmacie Test",
      startAt: "2026-09-11T08:00:00.000Z",
      endAt: "2026-09-11T08:45:00.000Z",
      outcome: "COMPLETED",
      ownerExternalId: "29117704",
      activityType: resolveNaaliHubSpotVisitType("client_visit"),
      body: "Compte rendu de visite",
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.properties).toMatchObject({
      hs_meeting_title: "Visite · Pharmacie Test",
      hs_meeting_start_time: "2026-09-11T08:00:00.000Z",
      hs_timestamp: "2026-09-11T08:00:00.000Z",
      hs_meeting_end_time: "2026-09-11T08:45:00.000Z",
      hs_meeting_outcome: "COMPLETED",
      hubspot_owner_id: "29117704",
      hs_activity_type: "Visite client",
      hs_meeting_body: "Compte rendu de visite",
    });
    expect(mapped.properties.hs_note_body).toBeUndefined();
  });

  it("uses the exact Naali HubSpot activity values for current TR1 visit kinds", () => {
    expect(resolveNaaliHubSpotVisitType("client_visit")).toBe("Visite client");
    expect(resolveNaaliHubSpotVisitType("prospecting")).toBe("Visite prospection");
    expect(resolveNaaliHubSpotVisitType("relationship")).toBe("Rendez-vous client");
    expect(resolveNaaliHubSpotVisitType("merchandising")).toBe("Visite client");
    expect(resolveNaaliHubSpotVisitType("sell_out")).toBe("Visite client");
  });

  it("refuses to invent a HubSpot activity type for an unknown visit kind", () => {
    expect(() => resolveNaaliHubSpotVisitType("unknown")).toThrow(/Unsupported TR1 visit kind/);
  });
});

describe("Naali HubSpot order mapping", () => {
  it("maps unambiguous TR1 order types to the exact HubSpot values", () => {
    expect(resolveNaaliHubSpotOrderType("initial")).toBe("Implantation");
    expect(resolveNaaliHubSpotOrderType("reorder")).toBe("Réassort");
    expect(resolveNaaliHubSpotOrderType("other")).toBeNull();
  });

  it("writes type_de_commande only when TR1 supplied an unambiguous HubSpot value", () => {
    const mapped = mapOrderToHubSpot({
      id: "order-1",
      orderNumber: "CMD-001",
      status: "confirmed",
      orderDate: "2026-09-11T09:00:00.000Z",
      orderTypeValue: "Réassort",
      netAmountHt: 100,
      currency: "EUR",
      lines: [],
    }, NAALI_HUBSPOT_CONFIGURATION);

    expect(mapped.deal.properties.type_de_commande).toBe("Réassort");
  });
});
