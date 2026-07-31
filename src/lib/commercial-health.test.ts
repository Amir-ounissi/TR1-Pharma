import { describe, expect, it } from "vitest";
import {
  buildReorderFollowUp,
  commercialPriority,
  commercialRecommendation,
  representativeReorderInterval,
  resolveCommercialHealthStatus,
  revenueTrend,
} from "./commercial-health";

describe("commercial health rules", () => {
  it("uses brand fallback without a usable interval", () => {
    expect(representativeReorderInterval([], 60)).toEqual({ days: 60, source: "brand_fallback" });
    expect(representativeReorderInterval([0, 0], 45)).toEqual({ days: 45, source: "brand_fallback" });
  });

  it("uses the average for one or two intervals", () => {
    expect(representativeReorderInterval([40], 60)).toEqual({ days: 40, source: "average" });
    expect(representativeReorderInterval([40, 60], 60)).toEqual({ days: 50, source: "average" });
  });

  it("uses the median for many orders and resists outliers", () => {
    expect(representativeReorderInterval([28, 30, 31, 120], 60)).toEqual({ days: 31, source: "median" });
  });

  it.each([
    [{ ordersCount: 0, daysSinceFirstOrder: null, daysSinceLastOrder: null, expectedIntervalDays: 60 }, "insufficient_history"],
    [{ ordersCount: 1, daysSinceFirstOrder: 3, daysSinceLastOrder: 3, expectedIntervalDays: 60 }, "newly_implanted"],
    [{ ordersCount: 1, daysSinceFirstOrder: 30, daysSinceLastOrder: 30, expectedIntervalDays: 60 }, "awaiting_first_reorder"],
    [{ ordersCount: 1, daysSinceFirstOrder: 53, daysSinceLastOrder: 53, expectedIntervalDays: 60 }, "reorder_due_soon"],
    [{ ordersCount: 1, daysSinceFirstOrder: 60, daysSinceLastOrder: 60, expectedIntervalDays: 60 }, "reorder_due_soon"],
    [{ ordersCount: 1, daysSinceFirstOrder: 61, daysSinceLastOrder: 61, expectedIntervalDays: 60 }, "reorder_overdue"],
    [{ ordersCount: 1, daysSinceFirstOrder: 82, daysSinceLastOrder: 82, expectedIntervalDays: 60 }, "at_risk"],
    [{ ordersCount: 1, daysSinceFirstOrder: 121, daysSinceLastOrder: 121, expectedIntervalDays: 60 }, "dormant"],
    [{ ordersCount: 2, daysSinceFirstOrder: 80, daysSinceLastOrder: 20, expectedIntervalDays: 60 }, "reorder_expected"],
    [{ ordersCount: 4, daysSinceFirstOrder: 200, daysSinceLastOrder: 20, expectedIntervalDays: 60 }, "healthy"],
    [{ ordersCount: 4, daysSinceFirstOrder: 200, daysSinceLastOrder: 53, expectedIntervalDays: 60 }, "reorder_due_soon"],
    [{ ordersCount: 4, daysSinceFirstOrder: 200, daysSinceLastOrder: 61, expectedIntervalDays: 60 }, "reorder_overdue"],
    [{ ordersCount: 4, daysSinceFirstOrder: 200, daysSinceLastOrder: 82, expectedIntervalDays: 60 }, "at_risk"],
    [{ ordersCount: 4, daysSinceFirstOrder: 200, daysSinceLastOrder: 121, expectedIntervalDays: 60 }, "dormant"],
  ])("classifies boundary case %#", (input, expected) => {
    expect(resolveCommercialHealthStatus(input)).toBe(expected);
  });

  it("classifies revenue trends at exact thresholds", () => {
    expect(revenueTrend(120, 100)).toMatchObject({ status: "growth", changePercent: 20 });
    expect(revenueTrend(105, 100).status).toBe("stable");
    expect(revenueTrend(95, 100).status).toBe("stable");
    expect(revenueTrend(80, 100).status).toBe("decline");
    expect(revenueTrend(79, 100).status).toBe("strong_decline");
    expect(revenueTrend(100, 0).status).toBe("insufficient_data");
  });

  it("builds an explainable capped priority score", () => {
    expect(commercialPriority({
      status: "reorder_overdue",
      hasNextAction: false,
      priorityLevel: "strategic",
      potentialLevel: "very_high",
      revenueTrend: "strong_decline",
      recentMissionWithoutFollowUp: true,
      expectedDelayDays: 18,
    })).toEqual({
      score: 100,
      reasons: [
        "Réassort en retard de 18 jours",
        "Aucun suivi programmé",
        "Compte stratégique",
        "Fort potentiel commercial",
        "Chiffre d’affaires en baisse",
        "Mission récente sans suivi commercial",
      ],
    });
  });

  it("returns deterministic recommendations", () => {
    expect(commercialRecommendation("reorder_overdue", false)).toBe("Contacter la pharmacie");
    expect(commercialRecommendation("awaiting_first_reorder", false)).toBe("Sécuriser le premier réassort");
    expect(commercialRecommendation("reorder_due_soon", true)).toBe("Préparer une relance");
    expect(commercialRecommendation("healthy", false)).toBe("Programmer une prochaine action");
  });

  it("prefills a follow-up without creating it", () => {
    const now = new Date(2026, 6, 27, 10);
    const expectedDueAt = new Date(2026, 6, 28, 9).toISOString();
    expect(buildReorderFollowUp({
      pharmacyName: "Pharmacie République",
      recommendation: "Contacter la pharmacie",
      now,
    })).toEqual({
      taskType: "call",
      priority: "high",
      title: "Relance réassort — Pharmacie République",
      description: "Contacter la pharmacie",
      dueAt: expectedDueAt,
    });
  });
});
