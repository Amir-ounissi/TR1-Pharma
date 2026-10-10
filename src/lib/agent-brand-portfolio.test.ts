import { describe, expect, it } from "vitest";
import { summarizeAgentBrandSales } from "./agent-brand-portfolio";

const brands = [
  { id: "naali", name: "Naali" },
  { id: "vk", name: "VK SWISS" },
];

describe("agent commercial multibrand overview", () => {
  it("separates booked revenue and order counts by authorized brand", () => {
    expect(summarizeAgentBrandSales(brands, [
      { brand_id: "naali", order_id: "n1", net_amount_ht: 200 },
      { brand_id: "vk", order_id: "v1", net_amount_ht: "300" },
      { brand_id: "naali", order_id: "n2", net_amount_ht: 120 },
    ])).toEqual([
      { id: "naali", name: "Naali", bookedRevenueHt: 320, bookedOrders: 2 },
      { id: "vk", name: "VK SWISS", bookedRevenueHt: 300, bookedOrders: 1 },
    ]);
  });

  it("ignores unauthorized brands and repeated orders", () => {
    expect(summarizeAgentBrandSales(brands, [
      { brand_id: "unknown", order_id: "u1", net_amount_ht: 5000 },
      { brand_id: "naali", order_id: "n1", net_amount_ht: 120 },
      { brand_id: "naali", order_id: "n1", net_amount_ht: 120 },
      { brand_id: "naali", order_id: "bad", net_amount_ht: "not a number" },
    ])).toEqual([
      { id: "naali", name: "Naali", bookedRevenueHt: 120, bookedOrders: 1 },
      { id: "vk", name: "VK SWISS", bookedRevenueHt: 0, bookedOrders: 0 },
    ]);
  });
});
