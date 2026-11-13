import { describe, expect, it } from "vitest";
import { indicativeRange, isAllowedQuantity, sumOrderCents, tierForQuantity } from "@/lib/private-catalogue-format";

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
  it("selectionne le plus grand seuil de volume eligible sans dependre du tri", () => {
    const tiers = [
      { min_quantity: 48, price_ht: 8.5 },
      { min_quantity: 12, price_ht: 12.5 },
      { min_quantity: 24, price_ht: 10.25 },
    ];
    expect(tierForQuantity(tiers, 12)?.price_ht).toBe(12.5);
    expect(tierForQuantity(tiers, 36)?.price_ht).toBe(10.25);
    expect(tierForQuantity(tiers, 96)?.price_ht).toBe(8.5);
    expect(tierForQuantity(tiers, 6)).toBeNull();
    expect(tierForQuantity(tiers, Number.NaN)).toBeNull();
  });

  it("ne transforme pas un prix indicatif absent en tarif ferme", () => {
    expect(indicativeRange(null)).toBe("Tarif sur demande");
    expect(indicativeRange({ min_quantity: 12, price_min_ht: 9, price_max_ht: 13 }))
      .toContain("13,00");
  });

});
