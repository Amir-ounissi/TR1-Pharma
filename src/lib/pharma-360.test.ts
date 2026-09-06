import { describe, expect, it } from "vitest";
import { pharma360Address, pharma360SectionCoverage, type Pharma360Snapshot } from "./pharma-360";

const snapshot: Pharma360Snapshot = {
  account: {
    brand_pharmacy_id: "relation",
    pharmacy_id: "pharmacy",
    pharmacy_name: "Pharmacie République",
    address_line_1: "10 place de la République",
    postal_code: "75003",
    city: "Paris",
  },
  business: {
    orders_count: 3,
    reorder_count: 2,
    average_order_value: 500,
    total_revenue_ht: 1500,
    revenue_last_30d_ht: 500,
    revenue_last_90d_ht: 1000,
    has_next_action: false,
  },
  assortment: {
    eligible_product_count: 8,
    implanted_product_count: 5,
    strategic_eligible_count: 3,
    strategic_implanted_count: 2,
    distribution_rate: 62.5,
    strategic_distribution_rate: 66.7,
    products: [],
  },
  field: { interactions: [{ id: "1" }], missions: [], open_tasks: [] },
  trade: { enabled: true, campaigns: [{ id: "campaign" }] },
  sell_out: { enabled: true, validated_capture_count: 1, units_last_90d: 12, revenue_last_90d_ht: 120, latest_captures: [] },
  opportunities: [{
    brand_pharmacy_id: "relation",
    action_type: "prepare_reorder",
    action_label: "Préparer le prochain réassort",
    action_score: 70,
    confidence: "medium",
    suggested_due_at: "2026-09-10",
    rationale: ["La fenêtre de réassort approche."],
    has_next_action: false,
  }],
  capabilities: { trade_marketing: true, sell_out: true, next_best_action: true },
};

describe("Pharma 360", () => {
  it("résume la couverture réelle de chaque couche", () => {
    expect(pharma360SectionCoverage(snapshot)).toEqual({
      business: true,
      assortment: true,
      field: true,
      trade: true,
      sellOut: true,
      opportunities: true,
    });
  });

  it("compose une adresse sans inventer les morceaux absents", () => {
    expect(pharma360Address(snapshot)).toBe("10 place de la République · 75003 Paris");
    expect(pharma360Address({ ...snapshot, account: { ...snapshot.account, address_line_1: null } })).toBe("75003 Paris");
  });
});
