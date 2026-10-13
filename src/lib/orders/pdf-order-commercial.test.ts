import { describe, expect, it } from "vitest";
import { resolveCommercialOrderLine } from "./pdf-order-commercial";

describe("Naali order terms", () => {
  const ambassador = { discountRate: 35, freeUnitsRule: { paidQuantity: 12, freeQuantity: 2, label: "12+2" } };
  it("applies 12+2 separately for each product and never to combined quantities", () => {
    const lines = [12, 12, 12, 12, 12].map((quantity) => resolveCommercialOrderLine(quantity, ambassador));
    expect(lines).toEqual(Array.from({ length: 5 }, () => ({ discountRate: 35, freeQuantity: 2 })));
    expect(lines.reduce((sum, line) => sum + line.freeQuantity, 0)).toBe(10);
    expect(resolveCommercialOrderLine(23, ambassador).freeQuantity).toBe(2);
    expect(resolveCommercialOrderLine(24, ambassador).freeQuantity).toBe(4);
  });
  it("supports pharmacies with no free units or explicit 12+1", () => {
    expect(resolveCommercialOrderLine(12, { discountRate: 30, freeUnitsRule: null })).toEqual({ discountRate: 30, freeQuantity: 0 });
    expect(resolveCommercialOrderLine(12, { discountRate: 30, freeUnitsRule: { paidQuantity: 12, freeQuantity: 1, label: "12+1" } }).freeQuantity).toBe(1);
  });
  it("rejects absent or invalid commercial discounts", () => {
    expect(() => resolveCommercialOrderLine(12, { discountRate: null, freeUnitsRule: null })).toThrow("Remise commerciale introuvable");
    expect(() => resolveCommercialOrderLine(0, ambassador)).toThrow("Quantité achetée invalide");
  });
});
