import { describe, expect, it } from "vitest";
import {
  forecastConfidenceLabel,
  forecastGapStatus,
  forecastIntervalLabel,
  getForecastPeriod,
  normalizeRevenueForecast,
} from "./forecast";

describe("forecast", () => {
  it("builds the annual period from the reference date", () => {
    expect(getForecastPeriod(new Date("2026-09-06T12:00:00.000Z"))).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
      asOf: "2026-09-06",
    });
  });

  it("keeps the objective gap semantics explicit", () => {
    expect(forecastGapStatus(null)).toBe("no_objective");
    expect(forecastGapStatus(12_500)).toBe("behind");
    expect(forecastGapStatus(0)).toBe("on_track");
    expect(forecastGapStatus(-3_000)).toBe("on_track");
  });

  it("explains confidence from the reorder interval source", () => {
    expect(forecastConfidenceLabel("high")).toBe("Élevée");
    expect(forecastConfidenceLabel("medium")).toBe("Moyenne");
    expect(forecastConfidenceLabel("low")).toBe("Faible");
    expect(forecastIntervalLabel("median")).toBe("Médiane historique");
    expect(forecastIntervalLabel("average")).toBe("Moyenne historique");
    expect(forecastIntervalLabel("brand_fallback")).toBe("Délai marque");
  });

  it("normalizes numeric JSON values returned by PostgreSQL", () => {
    const forecast = normalizeRevenueForecast({
      brand_id: "brand",
      period_start: "2026-01-01",
      period_end: "2026-12-31",
      as_of: "2026-09-06",
      realized_revenue_ht: "100000.00",
      booked_pipeline_ht: "5000.00",
      expected_reorder_revenue_ht: "15000.00",
      projected_revenue_ht: "120000.00",
      run_rate_projection_ht: "145000.00",
      objective_revenue_ht: "130000.00",
      objective_gap_ht: "10000.00",
      objective_attainment_projection_percent: "92.3",
      expected_reorders_count: 4,
      low_confidence_expected_reorders_count: 1,
      overdue_reorders_count: 2,
      expected_reorders: [],
      methodology: {},
    });

    expect(forecast.projected_revenue_ht).toBe(120000);
    expect(forecast.objective_gap_ht).toBe(10000);
    expect(forecast.expected_reorders_count).toBe(4);
  });
});
