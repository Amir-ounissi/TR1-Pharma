import { describe, expect, it } from "vitest";
import {
  classifyFirstOrder,
  missionEffectiveness,
  missionImpactQuality,
  observationMaturity,
  observedRevenueChange,
  safeRatio,
  shouldRecommendFollowup,
} from "./mission-impact";

describe("mission impact", () => {
  it.each([
    [0, "early"], [29, "early"], [30, "30d_complete"], [59, "30d_complete"],
    [60, "60d_complete"], [89, "60d_complete"], [90, "mature"],
  ])("classifies maturity at day %i", (days, expected) => {
    expect(observationMaturity(days)).toBe(expected);
  });

  it("does not classify effectiveness before J+30", () => {
    expect(missionEffectiveness({ daysObserved: 29, revenueBefore: 100, revenueAfter30: 200, ordersAfter30: 1, ordersAfter60: 1, reorderAfter30: true, reorderAfter60: true })).toBe("insufficient_data");
  });

  it.each([
    [{ daysObserved: 30, revenueBefore: 100, revenueAfter30: 121, ordersAfter30: 1, ordersAfter60: 1, reorderAfter30: false, reorderAfter60: false }, "strong_positive"],
    [{ daysObserved: 30, revenueBefore: 100, revenueAfter30: 110, ordersAfter30: 1, ordersAfter60: 1, reorderAfter30: false, reorderAfter60: false }, "positive"],
    [{ daysObserved: 30, revenueBefore: 100, revenueAfter30: 100, ordersAfter30: 0, ordersAfter60: 0, reorderAfter30: false, reorderAfter60: false }, "neutral"],
    [{ daysObserved: 60, revenueBefore: 0, revenueAfter30: 0, ordersAfter30: 0, ordersAfter60: 0, reorderAfter30: false, reorderAfter60: false }, "no_observable_result"],
    [{ daysObserved: 30, revenueBefore: 0, revenueAfter30: 0, ordersAfter30: 0, ordersAfter60: 0, reorderAfter30: false, reorderAfter60: false }, "weak"],
  ])("classifies effectiveness deterministically", (input, expected) => {
    expect(missionEffectiveness(input)).toBe(expected);
  });

  it("handles cost ratios without infinity", () => {
    expect(safeRatio(120, 0)).toBeNull();
    expect(safeRatio(120, 40)).toBe(3);
  });

  it("does not invent a revenue evolution with no baseline", () => {
    expect(observedRevenueChange(0, 100, 90)).toBeNull();
    expect(observedRevenueChange(100, 130, 29)).toBeNull();
    expect(observedRevenueChange(100, 130, 30)).toBeCloseTo(0.3);
  });

  it("distinguishes implantation, reorder and no order", () => {
    expect(classifyFirstOrder(0, "2026-01-01")).toBe("first_order");
    expect(classifyFirstOrder(2, "2026-01-01")).toBe("reorder");
    expect(classifyFirstOrder(2, null)).toBe("none");
  });

  it("downgrades quality for overlap and missing fields", () => {
    expect(missionImpactQuality({ totalCost: 0, hasReport: false, missionType: "animation", unitsSold: null, overlappingMissions: false })).toBe("insufficient");
    expect(missionImpactQuality({ totalCost: 100, hasReport: true, missionType: "animation", unitsSold: 10, overlappingMissions: true })).toBe("partial");
    expect(missionImpactQuality({ totalCost: 100, hasReport: true, missionType: "animation", unitsSold: 10, overlappingMissions: false })).toBe("complete");
  });

  it("recommends but never creates follow-up implicitly", () => {
    expect(shouldRecommendFollowup(8, 7, false)).toBe(true);
    expect(shouldRecommendFollowup(7, 7, false)).toBe(false);
    expect(shouldRecommendFollowup(20, 7, true)).toBe(false);
  });
});
