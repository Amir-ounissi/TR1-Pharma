import { describe, expect, it } from "vitest";
import {
  selectHistoricalHubSpotOrderCandidate,
  selectHistoricalOutboundHubSpotOrderCandidate,
  type HistoricalHubSpotOrderCandidate,
} from "./order-reconciliation";

const remoteDate = "2026-09-18T08:33:55.148Z";

function candidate(
  overrides: Partial<HistoricalHubSpotOrderCandidate> & Pick<HistoricalHubSpotOrderCandidate, "id">,
): HistoricalHubSpotOrderCandidate {
  return {
    id: overrides.id,
    brandPharmacyId: overrides.brandPharmacyId ?? "bp-1",
    sourceAgentUserId: overrides.sourceAgentUserId ?? "amir",
    netAmountHt: overrides.netAmountHt ?? 501.22,
    orderDate: overrides.orderDate ?? "2026-09-16T19:21:00.000Z",
    orderStatus: overrides.orderStatus ?? "invoiced",
  };
}

describe("historical HubSpot order reconciliation", () => {
  it("links one unique local order with the same account, amount and nearby date", () => {
    expect(selectHistoricalHubSpotOrderCandidate(
      [candidate({ id: "airport-order" })],
      {
        remoteAmount: 501.22,
        remoteDate,
        brandPharmacyId: "bp-1",
        sourceAgentUserId: "amir",
        linkedOrderIds: new Set(),
      },
    )).toBe("airport-order");
  });

  it("never reuses an order already linked to another HubSpot deal", () => {
    expect(selectHistoricalHubSpotOrderCandidate(
      [candidate({ id: "already-linked" })],
      {
        remoteAmount: 501.22,
        remoteDate,
        brandPharmacyId: "bp-1",
        sourceAgentUserId: "amir",
        linkedOrderIds: new Set(["already-linked"]),
      },
    )).toBeNull();
  });

  it("refuses ambiguous matches instead of guessing", () => {
    expect(selectHistoricalHubSpotOrderCandidate(
      [
        candidate({ id: "one" }),
        candidate({ id: "two", orderDate: "2026-09-17T08:00:00.000Z" }),
      ],
      {
        remoteAmount: 501.22,
        remoteDate,
        brandPharmacyId: "bp-1",
        sourceAgentUserId: "amir",
        linkedOrderIds: new Set(),
      },
    )).toBeNull();
  });

  it("rejects a different amount or a distant historical order", () => {
    expect(selectHistoricalHubSpotOrderCandidate(
      [
        candidate({ id: "wrong-amount", netAmountHt: 500 }),
        candidate({ id: "too-old", orderDate: "2026-08-20T08:00:00.000Z" }),
      ],
      {
        remoteAmount: 501.22,
        remoteDate,
        brandPharmacyId: "bp-1",
        sourceAgentUserId: "amir",
        linkedOrderIds: new Set(),
      },
    )).toBeNull();
  });
});


describe("historical outbound HubSpot order identity", () => {
  it("reuses the unique order that originally created the HubSpot deal even after amount drift", () => {
    expect(selectHistoricalOutboundHubSpotOrderCandidate(
      [candidate({ id: "original", netAmountHt: 822.82 })],
      {
        outboundOrderIds: new Set(["original"]),
        brandPharmacyId: "bp-1",
        linkedOrderIds: new Set(),
      },
    )).toBe("original");
  });

  it("does not reuse an outbound order already linked elsewhere", () => {
    expect(selectHistoricalOutboundHubSpotOrderCandidate(
      [candidate({ id: "original" })],
      {
        outboundOrderIds: new Set(["original"]),
        brandPharmacyId: "bp-1",
        linkedOrderIds: new Set(["original"]),
      },
    )).toBeNull();
  });

  it("refuses ambiguous outbound history instead of guessing", () => {
    expect(selectHistoricalOutboundHubSpotOrderCandidate(
      [candidate({ id: "one" }), candidate({ id: "two" })],
      {
        outboundOrderIds: new Set(["one", "two"]),
        brandPharmacyId: "bp-1",
        linkedOrderIds: new Set(),
      },
    )).toBeNull();
  });
});
