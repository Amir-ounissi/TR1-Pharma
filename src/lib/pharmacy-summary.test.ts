import { describe, expect, it, vi } from "vitest";
import { loadPharmacySummary } from "./pharmacy-summary";

type SummaryFixture = {
  brand_pharmacy_id: string;
  brand_id: string;
  pharmacy_id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  priority: string;
  potential: string;
  last_interaction_at: string | null;
  last_order_at: string | null;
  next_action_type: string | null;
  next_action_at: string | null;
  primary_contact: { name: string; phone: string };
};

type HealthFixture = {
  brand_pharmacy_id: string;
  brand_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  city: string;
  territory_name: string;
  agent_name: string;
  commercial_status: string;
  priority_level: string;
  potential_level: string;
  first_order_at: string | null;
  last_order_at: string | null;
  first_reorder_at: string | null;
  orders_count: number;
  reorder_count: number;
  days_to_first_reorder: number | null;
  days_since_last_order: number | null;
  average_reorder_interval_days: number | null;
  median_reorder_interval_days: number | null;
  expected_interval_days: number | null;
  expected_reorder_at: string | null;
  expected_reorder_delay_days: number | null;
  revenue_last_90d: number;
  revenue_previous_90d: number;
  revenue_trend: string;
  revenue_trend_percent: number | null;
  has_next_action: boolean;
  next_action_at: string | null;
  last_interaction_at: string | null;
  last_mission_at: string | null;
  health_status: string;
  priority_score: number;
  priority_reasons: string[];
  recommendation: string;
};

const baseSummary: SummaryFixture = {
  brand_pharmacy_id: "bp-1",
  brand_id: "brand-1",
  pharmacy_id: "ph-1",
  name: "Pharmacie du Centre",
  address: "12 rue Victor Hugo, 13001 Marseille",
  phone: "0102030405",
  latitude: null,
  longitude: null,
  status: "active",
  priority: "strategic",
  potential: "high",
  last_interaction_at: "2026-08-10T09:00:00.000Z",
  last_order_at: "2026-08-01T09:00:00.000Z",
  next_action_type: "follow_up",
  next_action_at: "2026-08-20T09:00:00.000Z",
  primary_contact: { name: "Alice Martin", phone: "0102030405" },
};

const baseHealth: HealthFixture = {
  brand_pharmacy_id: "bp-1",
  brand_id: "brand-1",
  pharmacy_id: "ph-1",
  pharmacy_name: "Pharmacie du Centre",
  city: "Marseille",
  territory_name: "Sud",
  agent_name: "Nora Petit",
  commercial_status: "active",
  priority_level: "strategic",
  potential_level: "high",
  first_order_at: "2026-07-01T09:00:00.000Z",
  last_order_at: "2026-08-01T09:00:00.000Z",
  first_reorder_at: null,
  orders_count: 1,
  reorder_count: 0,
  days_to_first_reorder: null,
  days_since_last_order: 11,
  average_reorder_interval_days: null,
  median_reorder_interval_days: null,
  expected_interval_days: 60,
  expected_reorder_at: "2026-08-30T09:00:00.000Z",
  expected_reorder_delay_days: null,
  revenue_last_90d: 0,
  revenue_previous_90d: 0,
  revenue_trend: "insufficient_data",
  revenue_trend_percent: null,
  has_next_action: true,
  next_action_at: "2026-08-20T09:00:00.000Z",
  last_interaction_at: "2026-08-10T09:00:00.000Z",
  last_mission_at: null,
  health_status: "awaiting_first_reorder",
  priority_score: 50,
  priority_reasons: ["Premier réassort à sécuriser", "Compte stratégique", "Fort potentiel commercial", "Aucun suivi programmé"],
  recommendation: "Sécuriser le premier réassort",
};

const timelineRows = [
  { brand_pharmacy_id: "bp-1", event_type: "interaction", title: "Visite terrain", details: "Compte rendu partagé", author_name: "Nora Petit", occurred_at: "2026-08-10T09:00:00.000Z" },
  { brand_pharmacy_id: "bp-1", event_type: "task", title: "Relance planifiée", details: "Prévoir un appel", author_name: "Nora Petit", occurred_at: "2026-08-09T09:00:00.000Z" },
  { brand_pharmacy_id: "bp-1", event_type: "status_change", title: "Compte actif", details: "Passage en actif", author_name: "TR1", occurred_at: "2026-08-08T09:00:00.000Z" },
];

function createClient(overrides?: {
  summary?: SummaryFixture | null;
  health?: HealthFixture[];
  timeline?: typeof timelineRows;
  rpcError?: string | null;
}) {
  return {
    rpc: vi.fn(async (name: string) => {
      if (overrides?.rpcError) return { data: null, error: { message: overrides.rpcError } };
      if (name === "get_field_pharmacy_summary") return { data: overrides?.summary ?? baseSummary, error: null };
      if (name === "get_commercial_health") return { data: overrides?.health ?? [baseHealth], error: null };
      return { data: null, error: null };
    }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: overrides?.timeline ?? timelineRows, error: null })),
          })),
        })),
      })),
    })),
  };
}

describe("loadPharmacySummary", () => {
  it("returns a compact summary for an authorized pharmacy", async () => {
    const summary = await loadPharmacySummary(createClient() as never, "bp-1");
    expect(summary?.pharmacy.name).toBe("Pharmacie du Centre");
    expect(summary?.whyAct).toHaveLength(3);
    expect(summary?.whyAct).toEqual([
      "Premier réassort attendu",
      "Compte stratégique à suivre",
      "Fort potentiel commercial",
    ]);
    expect(summary?.recentEvents.length).toBeLessThanOrEqual(3);
    expect(summary?.nextAction.label).toBe("follow_up");
  });

  it("uses the canonical empty next action wording", async () => {
    const client = createClient({
      summary: { ...baseSummary, next_action_type: null as string | null, next_action_at: null as string | null },
      health: [{ ...baseHealth, has_next_action: false, next_action_at: null, priority_reasons: ["Aucun suivi programmé"] }],
    });
    const summary = await loadPharmacySummary(client as never, "bp-1");
    expect(summary?.nextAction.label).toBe("Aucune prochaine action prévue");
    expect(summary?.whyAct[0]).toBe("Aucune prochaine action prévue");
  });

  it("handles no order and no history states", async () => {
    const client = createClient({
      summary: { ...baseSummary, last_order_at: null as string | null, last_interaction_at: null as string | null },
      health: [{ ...baseHealth, orders_count: 0, reorder_count: 0, first_order_at: null, last_order_at: null, first_reorder_at: null, priority_reasons: ["Aucune première commande n’est encore observée."], health_status: "insufficient_history" }],
      timeline: [],
    });
    const summary = await loadPharmacySummary(client as never, "bp-1");
    expect(summary?.lastCommercialSignal.label).toBe("Aucune commande observée");
    expect(summary?.recentEvents).toEqual([]);
    expect(summary?.whyAct).toContain("Absence de première commande");
  });

  it("rejects unauthorized access without leaking data", async () => {
    const client = createClient({ rpcError: "Pharmacy summary forbidden" });
    await expect(loadPharmacySummary(client as never, "bp-2")).rejects.toThrow("forbidden");
  });

  it("never returns more than three recent events", async () => {
    const extendedTimeline = [...timelineRows, { ...timelineRows[0], occurred_at: "2026-08-07T09:00:00.000Z", title: "Ancien événement" }];
    const summary = await loadPharmacySummary(createClient({ timeline: extendedTimeline }) as never, "bp-1");
    expect(summary?.recentEvents).toHaveLength(3);
  });
});
