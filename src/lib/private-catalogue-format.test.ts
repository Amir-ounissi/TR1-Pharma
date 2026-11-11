import { describe, expect, it } from "vitest";
import { isAllowedQuantity, sumOrderCents } from "@/lib/private-catalogue-format";

describe("catalogue prive - contraintes des demandes", () => {
  it("respecte minimum et increments", () => {
    expect(isAllowedQuantity(12, 12, 6)).toBe(true);
    expect(isAllowedQuantity(18, 12, 6)).toBe(true);
    expect(isAllowedQuantity(13, 12, 6)).toBe(false);
    expect(isAllowedQuantity(6, 12, 6)).toBe(false);
  });

  it("rejette les quantites falsifiees ou excessives", () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Infinity, 5001]) {
      expect(isAllowedQuantity(bad, 1, 1)).toBe(false);
    }
    expect(isAllowedQuantity(1, 0, 1)).toBe(false);
    expect(isAllowedQuantity(1, 1, 0)).toBe(false);
  });

  it("calcule les prix HT en centimes", () => {
    expect(sumOrderCents([{ price_ht: 10.25, quantity: 12 }, { price_ht: 4.5, quantity: 2 }])).toBe(13200);
    expect(sumOrderCents([{ price_ht: 0.3, quantity: 3 }])).toBe(90);
  });
});
