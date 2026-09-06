export type ForecastConfidence = "high" | "medium" | "low";

export type ForecastExpectedReorder = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  territory_name: string | null;
  agent_name: string | null;
  expected_reorder_date: string;
  expected_value_ht: number;
  interval_source: "median" | "average" | "brand_fallback";
  confidence: ForecastConfidence;
  health_status: string;
  expected_interval_days: number;
};

export type RevenueForecast = {
  brand_id: string;
  period_start: string;
  period_end: string;
  as_of: string;
  realized_revenue_ht: number;
  booked_pipeline_ht: number;
  expected_reorder_revenue_ht: number;
  projected_revenue_ht: number;
  run_rate_projection_ht: number;
  objective_revenue_ht: number | null;
  objective_gap_ht: number | null;
  objective_attainment_projection_percent: number | null;
  expected_reorders_count: number;
  low_confidence_expected_reorders_count: number;
  overdue_reorders_count: number;
  expected_reorders: ForecastExpectedReorder[];
  methodology: {
    realized: string;
    booked: string;
    expected_reorders: string;
    confidence: string;
    exclusions: string;
  };
};

export function getForecastPeriod(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    asOf: referenceDate.toISOString().slice(0, 10),
  };
}

export function forecastGapStatus(gap: number | null) {
  if (gap === null) return "no_objective" as const;
  if (gap > 0) return "behind" as const;
  return "on_track" as const;
}

export function forecastConfidenceLabel(confidence: ForecastConfidence) {
  if (confidence === "high") return "Élevée";
  if (confidence === "medium") return "Moyenne";
  return "Faible";
}

export function forecastIntervalLabel(source: ForecastExpectedReorder["interval_source"]) {
  if (source === "median") return "Médiane historique";
  if (source === "average") return "Moyenne historique";
  return "Délai marque";
}

export function normalizeRevenueForecast(value: unknown): RevenueForecast {
  if (!value || typeof value !== "object") throw new Error("Forecast response is invalid");
  const row = value as Record<string, unknown>;
  const number = (key: string, nullable = false) => {
    const raw = row[key];
    if (nullable && raw === null) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) throw new Error(`Forecast field ${key} is invalid`);
    return parsed;
  };

  return {
    brand_id: String(row.brand_id ?? ""),
    period_start: String(row.period_start ?? ""),
    period_end: String(row.period_end ?? ""),
    as_of: String(row.as_of ?? ""),
    realized_revenue_ht: number("realized_revenue_ht") as number,
    booked_pipeline_ht: number("booked_pipeline_ht") as number,
    expected_reorder_revenue_ht: number("expected_reorder_revenue_ht") as number,
    projected_revenue_ht: number("projected_revenue_ht") as number,
    run_rate_projection_ht: number("run_rate_projection_ht") as number,
    objective_revenue_ht: number("objective_revenue_ht", true),
    objective_gap_ht: number("objective_gap_ht", true),
    objective_attainment_projection_percent: number("objective_attainment_projection_percent", true),
    expected_reorders_count: number("expected_reorders_count") as number,
    low_confidence_expected_reorders_count: number("low_confidence_expected_reorders_count") as number,
    overdue_reorders_count: number("overdue_reorders_count") as number,
    expected_reorders: Array.isArray(row.expected_reorders)
      ? row.expected_reorders.map((item) => {
          const reorder = item as Record<string, unknown>;
          return {
            brand_pharmacy_id: String(reorder.brand_pharmacy_id ?? ""),
            pharmacy_name: String(reorder.pharmacy_name ?? ""),
            territory_name: reorder.territory_name === null ? null : String(reorder.territory_name ?? ""),
            agent_name: reorder.agent_name === null ? null : String(reorder.agent_name ?? ""),
            expected_reorder_date: String(reorder.expected_reorder_date ?? ""),
            expected_value_ht: Number(reorder.expected_value_ht ?? 0),
            interval_source: reorder.interval_source as ForecastExpectedReorder["interval_source"],
            confidence: reorder.confidence as ForecastConfidence,
            health_status: String(reorder.health_status ?? ""),
            expected_interval_days: Number(reorder.expected_interval_days ?? 0),
          };
        })
      : [],
    methodology: (row.methodology ?? {}) as RevenueForecast["methodology"],
  };
}
