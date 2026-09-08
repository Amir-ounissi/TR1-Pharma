import { describe, expect, it } from "vitest";
import {
  clearOfflineDaySnapshot,
  loadActiveOfflineDaySnapshot,
  saveOfflineDaySnapshot,
  setActiveOfflineScope,
  type OfflineDaySnapshot,
} from "./offline-day-snapshot";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as unknown as Storage;
}

function snapshot(overrides: Partial<OfflineDaySnapshot> = {}): OfflineDaySnapshot {
  return {
    version: 1,
    userId: "user-1",
    brandId: "brand-1",
    brandName: "Naali",
    businessDate: "2026-09-08",
    dayLabel: "mardi 8 septembre",
    savedAt: "2026-09-08T08:00:00.000Z",
    day: { tasks: [], missions: [], reports: [], follow_ups: [] },
    nextVisit: null,
    visits: [],
    stockAlerts: [],
    ...overrides,
  };
}

describe("offline day snapshot", () => {
  it("restores only the active user and brand scope", () => {
    const target = storage();
    const current = snapshot();

    expect(saveOfflineDaySnapshot(target, current)).toBe(true);
    expect(loadActiveOfflineDaySnapshot(target)).toEqual(current);
  });

  it("removes a cached day when the active brand changes", () => {
    const target = storage();
    saveOfflineDaySnapshot(target, snapshot());

    setActiveOfflineScope(target, { userId: "user-1", brandId: "brand-2" });

    expect(loadActiveOfflineDaySnapshot(target)).toBeNull();
  });

  it("removes a cached day when the active user changes", () => {
    const target = storage();
    saveOfflineDaySnapshot(target, snapshot());

    setActiveOfflineScope(target, { userId: "user-2", brandId: "brand-1" });

    expect(loadActiveOfflineDaySnapshot(target)).toBeNull();
  });

  it("clears the active scope and cached business data on logout", () => {
    const target = storage();
    saveOfflineDaySnapshot(target, snapshot());

    clearOfflineDaySnapshot(target);

    expect(loadActiveOfflineDaySnapshot(target)).toBeNull();
  });
});
