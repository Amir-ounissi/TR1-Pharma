import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsUrl,
  buildWazeUrl,
  hasValidNoNextActionReason,
  sortTodayItems,
  suggestNextAction,
} from "./agent-experience";

describe("agent experience", () => {
  it("builds Waze and Maps links from coordinates", () => {
    const pharmacy = { latitude: 48.86, longitude: 2.35 };
    expect(buildWazeUrl(pharmacy)).toContain("48.86%2C2.35");
    expect(buildGoogleMapsUrl(pharmacy)).toContain("destination=48.86%2C2.35");
  });

  it("falls back to a normalized address", () => {
    const pharmacy = { address_line_1: "10 rue Test", postal_code: "75001", city: "Paris" };
    expect(buildWazeUrl(pharmacy)).toContain("10%20rue%20Test%2C%2075001%2C%20Paris%2C%20FR");
  });

  it("suggests deterministic actions", () => {
    expect(suggestNextAction({ interactionType: "call", outcome: "no_answer", commercialStatus: "active" })).toMatchObject({ type: "call", delayDays: 2 });
    expect(suggestNextAction({ interactionType: "visit", outcome: "completed", commercialStatus: "dormant" })).toMatchObject({ type: "visit", delayDays: 7 });
  });

  it("sorts overdue, time, priority and then available distance", () => {
    const now = new Date("2026-07-27T10:00:00Z");
    const sorted = sortTodayItems([
      { id: "far", dueAt: "2026-07-27T12:00:00Z", priority: "high" as const, distanceKm: 8 },
      { id: "overdue", dueAt: "2026-07-27T09:00:00Z", priority: "low" as const },
      { id: "near", dueAt: "2026-07-27T12:00:00Z", priority: "high" as const, distanceKm: 2 },
    ], now);
    expect(sorted.map((item) => item.id)).toEqual(["overdue", "near", "far"]);
  });

  it("requires a reason when no next action is selected", () => {
    expect(hasValidNoNextActionReason(true, "Pas utile")).toBe(false);
    expect(hasValidNoNextActionReason(true, "Compte définitivement fermé")).toBe(true);
  });
});
