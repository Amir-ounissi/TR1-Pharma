import { describe, expect, it } from "vitest";
import {
  brandProviderStatusLabel,
  fieldProviderActivityLabel,
  fieldProviderTypeLabel,
  providerContractIsCurrent,
  providerContractStatusLabel,
  summarizeBrandProviderPortfolio,
  type BrandProviderPortfolioRow,
} from "./field-providers";

const row = (overrides: Partial<BrandProviderPortfolioRow> = {}): BrandProviderPortfolioRow => ({
  relation_id: "00000000-0000-0000-0000-000000000001",
  field_provider_id: "00000000-0000-0000-0000-000000000002",
  display_name: "Agence Terrain",
  email: "terrain@example.test",
  phone: null,
  provider_type: "agency",
  relation_status: "active",
  contract_status: "active",
  activities: ["animation"],
  preferred: true,
  priority: 10,
  daily_rate_ht: 350,
  half_day_rate_ht: 220,
  travel_rate_type: "forfait",
  valid_from: "2026-01-01",
  valid_until: "2026-12-31",
  notes: null,
  missions_total: 8,
  upcoming_missions: 2,
  completed_90d: 3,
  cost_90d: 1050,
  last_mission_at: "2026-09-01T10:00:00.000Z",
  ...overrides,
});

describe("field provider portfolio", () => {
  it("summarizes portfolio workload and spend", () => {
    const summary = summarizeBrandProviderPortfolio([
      row(),
      row({ relation_id: "2", preferred: false, relation_status: "paused", upcoming_missions: 1, completed_90d: 2, cost_90d: 400 }),
    ]);

    expect(summary).toEqual({
      total: 2,
      active: 1,
      preferred: 1,
      upcomingMissions: 3,
      completed90d: 5,
      cost90d: 1450,
    });
  });

  it("evaluates contract validity deterministically", () => {
    const today = new Date("2026-09-06T12:00:00.000Z");
    expect(providerContractIsCurrent(row(), today)).toBe(true);
    expect(providerContractIsCurrent(row({ valid_from: "2026-10-01" }), today)).toBe(false);
    expect(providerContractIsCurrent(row({ valid_until: "2026-08-31" }), today)).toBe(false);
    expect(providerContractIsCurrent(row({ contract_status: "pending" }), today)).toBe(false);
  });

  it("provides stable French labels", () => {
    expect(fieldProviderTypeLabel("agency")).toBe("Agence");
    expect(fieldProviderActivityLabel("training")).toBe("Formation");
    expect(providerContractStatusLabel("pending")).toBe("À contractualiser");
    expect(brandProviderStatusLabel("paused")).toBe("En pause");
  });
});
