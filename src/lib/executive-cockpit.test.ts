import { describe, expect, it } from "vitest";
import {
  buildExecutiveAlerts,
  getExecutivePeriods,
  percentChange,
  pickExecutiveObjective,
  runRateProjection,
  type ExecutiveObjective,
  type ExecutiveOverview,
} from "./executive-cockpit";

const overview: ExecutiveOverview = {
  revenue_ht: 120_000,
  implantations: 24,
  reorders: 56,
  active_pharmacies: 82,
  at_risk_accounts: 3,
  dormant_accounts: 2,
  without_next_action_count: 7,
  strategic_without_action_count: 1,
  first_reorder_rate: 62,
  avg_distribution_rate: 58,
  strategic_distribution_rate: 71,
};

describe("Executive Cockpit", () => {
  it("construit des périodes YTD comparables à N-1", () => {
    expect(getExecutivePeriods(new Date("2026-09-05T12:00:00.000Z"))).toEqual({
      current: { start: "2026-01-01", end: "2026-09-05", fullYearEnd: "2026-12-31" },
      previous: { start: "2025-01-01", end: "2025-09-05" },
    });
  });

  it("calcule la variation vs N-1 sans inventer de pourcentage quand la base est nulle", () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(90, 100)).toBe(-10);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
  });

  it("projette un run-rate déterministe sur la période complète", () => {
    expect(runRateProjection(50, "2026-01-01", "2026-12-31", "2026-06-30")).toBeCloseTo(100.83, 2);
  });

  it("retient uniquement l’objectif marque correspondant exactement à l’exercice", () => {
    const objectives: ExecutiveObjective[] = [
      {
        objective_id: "quarter",
        scope_type: "brand",
        metric_key: "revenue_ht",
        period_start: "2026-01-01",
        period_end: "2026-03-31",
        target_value: 40_000,
        realized_value: 39_000,
        attainment_percent: 97.5,
        gap_value: -1_000,
        projected_value: null,
      },
      {
        objective_id: "year",
        scope_type: "brand",
        metric_key: "revenue_ht",
        period_start: "2026-01-01",
        period_end: "2026-12-31",
        target_value: 220_000,
        realized_value: 120_000,
        attainment_percent: 54.5,
        gap_value: -100_000,
        projected_value: 180_000,
      },
    ];

    expect(pickExecutiveObjective(objectives, "revenue_ht", "2026-01-01", "2026-12-31")?.objective_id).toBe("year");
    expect(pickExecutiveObjective(objectives, "revenue_ht", "2027-01-01", "2027-12-31")).toBeNull();
  });

  it("priorise les alertes actionnables et explicables", () => {
    const alerts = buildExecutiveAlerts({
      current: overview,
      previousRevenue: 130_000,
      projectedRevenue: 180_000,
      targetRevenue: 220_000,
    });

    expect(alerts.map((alert) => alert.key)).toEqual([
      "revenue-projection-gap",
      "strategic-without-action",
      "at-risk",
      "dormant",
      "revenue-n1",
    ]);
  });
});
