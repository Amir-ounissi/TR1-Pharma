import { describe, expect, it } from "vitest";
import { indicativeRange, isAllowedQuantity, sumOrderCents, tierForQuantity, tierSavingsCents, nextTierDiscountCents, firstOrderQuantity, steppedOrderQuantity, collectiveTierTopUp, DEFAULT_QUANTITY_STEP } from "@/lib/private-catalogue-format";

describe("catalogue prive - contraintes des demandes", () => {
  it("applique six par défaut, et permet un pas personnalisé par produit", () => {
    expect(DEFAULT_QUANTITY_STEP).toBe(6);
    expect(firstOrderQuantity(1)).toBe(6);
    expect(firstOrderQuantity(6)).toBe(6);
    expect(firstOrderQuantity(8, 6)).toBe(12);
    expect(firstOrderQuantity(8, 4)).toBe(8);
    expect(isAllowedQuantity(6, 6)).toBe(true);
    expect(isAllowedQuantity(12, 6)).toBe(true);
    expect(isAllowedQuantity(13, 6)).toBe(false);
    expect(isAllowedQuantity(18, 6)).toBe(true);
    expect(isAllowedQuantity(8, 8, 4)).toBe(true);
    expect(isAllowedQuantity(9, 8, 4)).toBe(false);
    expect(isAllowedQuantity(1, 1, 1)).toBe(true);
  });

  it("fait +/-6 et supprime le produit sous le minimum", () => {
    expect(steppedOrderQuantity(0, 6, 6, 1)).toBe(6);
    expect(steppedOrderQuantity(6, 6, 6, 1)).toBe(12);
    expect(steppedOrderQuantity(12, 6, 6, -1)).toBe(6);
    expect(steppedOrderQuantity(6, 6, 6, -1)).toBe(0);
    expect(steppedOrderQuantity(13, 6, 6, 1)).toBe(18);
    expect(steppedOrderQuantity(13, 6, 6, -1)).toBe(12);
    expect(steppedOrderQuantity(7, 6, 6, -1)).toBe(6);
    expect(steppedOrderQuantity(7, 6, 6, 1)).toBe(12);
    expect(steppedOrderQuantity(0, 8, 4, 1)).toBe(8);
    expect(steppedOrderQuantity(8, 8, 4, 1)).toBe(12);
  });

  it("respecte les masques Biodance : minimum 12 et multiple de 4 SUR LE TOTAL", () => {
    // Deux references à 4 et 8 : 12 au total, condition fournisseur satisfaite.
    expect(isAllowedQuantity(4, 1, 1)).toBe(true);
    expect(isAllowedQuantity(8, 1, 1)).toBe(true);
    expect((4 + 8) % 4).toBe(0);
    // Les quantités individuelles 6+6 restent possibles, même si
    // les boutons proposent des raccourcis +4/-4.
    expect(isAllowedQuantity(6, 1, 1)).toBe(true);
    expect((6 + 6) % 4).toBe(0);
    expect(steppedOrderQuantity(0, 4, 4, 1)).toBe(4);
    expect(steppedOrderQuantity(4, 4, 4, 1)).toBe(8);
    expect(collectiveTierTopUp(24, 40, 4, 12, 1, 1))
      .toEqual({ additional: 16, total: 40 });
    expect(collectiveTierTopUp(10, 12, 4, 3, 1, 1))
      .toEqual({ additional: 2, total: 12 });
    // Si l'administrateur impose finalement le pas 6 sur la référence,
    // le palier collectif reste atteignable à 48 sans quantité invalide.
    expect(collectiveTierTopUp(24, 40, 4, 6, 6, 6))
      .toEqual({ additional: 24, total: 48 });
    expect(collectiveTierTopUp(20, 24, 0, 8, 1, 1)).toBeNull();
  });

  it("rejette les quantites falsifiees ou excessives", () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Infinity, 5001]) {
      expect(isAllowedQuantity(bad, 1, 1)).toBe(false);
    }
    expect(isAllowedQuantity(1, 0, 1)).toBe(false);
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

  it("calcule une économie HT vs le premier palier, au volume commandé", () => {
    const tiers = [
      { min_quantity: 40, price_min_ht: 3.41, price_max_ht: 3.41 },
      { min_quantity: 12, price_min_ht: 3.85, price_max_ht: 3.85 },
      { min_quantity: 24, price_min_ht: 3.52, price_max_ht: 3.52 },
    ];
    expect(tierSavingsCents(tiers, tierForQuantity(tiers, 24), 24)).toBe(792);
    expect(tierSavingsCents(tiers, tierForQuantity(tiers, 12), 12)).toBe(0);
  });

  it("ne présente pas d'économie lorsque le barème est ambigu ou non dégressif", () => {
    const uncertain = [
      { min_quantity: 1, price_min_ht: 10, price_max_ht: 12 },
      { min_quantity: 24, price_min_ht: 9, price_max_ht: 10 },
    ];
    expect(tierSavingsCents(uncertain, uncertain[1], 24)).toBeNull();
    expect(tierSavingsCents([{ min_quantity: 1, price_ht: 10 }], null, 2)).toBeNull();
    expect(tierSavingsCents([{ min_quantity: 1, price_ht: 10 }, { min_quantity: 24, price_ht: 11 }], { min_quantity: 24, price_ht: 11 }, 24)).toBeNull();
    expect(tierSavingsCents([{ min_quantity: 1, price_ht: 10 }], { min_quantity: 1, price_ht: 10 }, 1.5)).toBeNull();
  });


  it("calcule le gain du futur palier sur le volume final, sans compter les unites ajoutees comme une economie", () => {
    const maskTiers = [
      { min_quantity: 12, price_min_ht: 3.85, price_max_ht: 3.85 },
      { min_quantity: 24, price_min_ht: 3.52, price_max_ht: 3.52 },
      { min_quantity: 40, price_min_ht: 3.41, price_max_ht: 3.41 },
    ];
    // 12 masques A + 12 masques B, ajout de 16 sur A.
    // 40 x (3,52 - 3,41) = 4,40 EUR de remise supplementaire.
    expect(nextTierDiscountCents([
      { tiers: maskTiers, quantity: 12, addedQuantity: 16 },
      { tiers: maskTiers, quantity: 12, addedQuantity: 0 },
    ], 24, 40)).toBe(440);
    expect(nextTierDiscountCents([
      { tiers: maskTiers, quantity: 24, addedQuantity: 16 },
    ], 24, 40)).toBe(440);
  });

  it("n'invente pas une economie si le palier futur est plus cher, non renseigne ou variable", () => {
    expect(nextTierDiscountCents([{
      tiers: [{ min_quantity: 1, price_ht: 10 }, { min_quantity: 12, price_ht: 12 }],
      quantity: 6, addedQuantity: 6,
    }], 6, 12)).toBeNull();
    expect(nextTierDiscountCents([{
      tiers: [{ min_quantity: 1, price_min_ht: 10, price_max_ht: 11 }, { min_quantity: 12, price_min_ht: 9, price_max_ht: 9 }],
      quantity: 6, addedQuantity: 6,
    }], 6, 12)).toBeNull();
    expect(nextTierDiscountCents([], 12, 24)).toBeNull();
    expect(nextTierDiscountCents([{ tiers: [{ min_quantity: 12, price_ht: 3.85 }], quantity: 12, addedQuantity: 0 }], 12, 12)).toBeNull();
  });

  it("ne transforme pas un prix indicatif absent en tarif ferme", () => {
    expect(indicativeRange(null)).toBe("Tarif sur demande");
    expect(indicativeRange({ min_quantity: 12, price_min_ht: 9, price_max_ht: 13 }))
      .toContain("13,00");
  });

});
