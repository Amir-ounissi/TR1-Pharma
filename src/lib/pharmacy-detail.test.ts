import { describe, expect, it } from "vitest";
import { getPharmacyDetailDataNeeds, normalizePharmacyDetailTab } from "@/lib/pharmacy-detail";

describe("pharmacy detail data loading", () => {
  it("loads only contact data for the contacts tab", () => {
    const needs = getPharmacyDetailDataNeeds("contacts");
    expect(needs.contacts).toBe(true);
    expect(Object.entries(needs).filter(([, required]) => required).map(([key]) => key)).toEqual(["contacts"]);
  });

  it("loads activity dependencies without performance-only data", () => {
    const needs = getPharmacyDetailDataNeeds("activity");
    expect(needs).toMatchObject({ contacts: true, commercialMemberships: true, timeline: true, assignments: true, orders: true, missions: true });
    expect(needs.performance).toBe(false);
    expect(needs.commercialHealth).toBe(false);
  });

  it("loads cockpit data for overview without orders or contacts", () => {
    const needs = getPharmacyDetailDataNeeds("overview");
    expect(needs).toMatchObject({ performance: true, distribution: true, commercialHealth: true, missions: true, missionImpacts: true });
    expect(needs.orders).toBe(false);
    expect(needs.contacts).toBe(false);
  });

  it("falls back to overview for an unknown tab", () => {
    expect(normalizePharmacyDetailTab("technical-tab")).toBe("overview");
  });
});
