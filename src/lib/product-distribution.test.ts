import { describe, expect, it } from "vitest";
import {
  countProductPresence,
  isProductPresent,
  productDistributionPercent,
  type ProductPresenceRow,
} from "./product-distribution";

function row(overrides: Partial<ProductPresenceRow> = {}): ProductPresenceRow {
  return {
    product_id: "product-1",
    brand_pharmacy_id: "pharmacy-1",
    order_presence: false,
    status: "planned",
    manually_confirmed_present: false,
    removed_at: null,
    ...overrides,
  };
}

describe("product distribution", () => {
  it.each([
    row({ order_presence: true }),
    row({ status: "implanted" }),
    row({ status: "active" }),
    row({ status: "temporarily_unavailable" }),
    row({ manually_confirmed_present: true }),
  ])("recognizes every supported presence signal", (presence) => {
    expect(isProductPresent(presence)).toBe(true);
  });

  it("excludes removed relations and deduplicates pharmacies", () => {
    const counts = countProductPresence([
      row({ order_presence: true }),
      row({ status: "active" }),
      row({ brand_pharmacy_id: "pharmacy-2", manually_confirmed_present: true }),
      row({ brand_pharmacy_id: "pharmacy-3", order_presence: true, removed_at: "2026-01-01" }),
    ]);

    expect(counts.get("product-1")).toBe(2);
  });

  it("computes the visible portfolio percentage", () => {
    expect(productDistributionPercent(23, 25)).toBe(92);
    expect(productDistributionPercent(0, 0)).toBeNull();
  });
});
