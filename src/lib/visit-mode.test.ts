import { describe, expect, it } from "vitest";
import { activeVisitKey, clearActiveVisit, createActiveVisit, loadActiveVisit, saveActiveVisit } from "./visit-mode";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const visit = {
  brandId: "brand-a",
  brandPharmacyId: "relation-a",
  pharmacyId: "pharmacy-a",
  pharmacyName: "Pharmacie Test",
  objective: "Visite",
  contactName: "Claire",
  wazeUrl: "https://waze.test",
  mapsUrl: "https://maps.test",
};

describe("visit mode", () => {
  it("starts and persists a visit", () => {
    const storage = memoryStorage();
    const active = createActiveVisit(visit, new Date("2026-07-27T08:30:00Z"));
    saveActiveVisit(storage, active, "user-a");
    expect(loadActiveVisit(storage, "brand-a", "user-a")).toEqual(active);
  });

  it("restores after reload and clears after validation", () => {
    const storage = memoryStorage();
    saveActiveVisit(storage, createActiveVisit(visit), "user-a");
    expect(loadActiveVisit(storage, "brand-a", "user-a")?.pharmacyName).toBe("Pharmacie Test");
    clearActiveVisit(storage, "brand-a", "user-a");
    expect(loadActiveVisit(storage, "brand-a", "user-a")).toBeNull();
  });

  it("cleans corrupted state", () => {
    const storage = memoryStorage();
    storage.setItem("tr1:agent:active-visit", "{}");
    expect(loadActiveVisit(storage, "brand-a", "user-a")).toBeNull();
  });

  it("never restores a visit from another user or brand", () => {
    const storage = memoryStorage();
    saveActiveVisit(storage, createActiveVisit(visit), "user-a");
    expect(loadActiveVisit(storage, "brand-a", "user-b")).toBeNull();
    expect(loadActiveVisit(storage, "brand-b", "user-a")).toBeNull();
    expect(storage.getItem(activeVisitKey("brand-a", "user-a"))).not.toBeNull();
  });
});
