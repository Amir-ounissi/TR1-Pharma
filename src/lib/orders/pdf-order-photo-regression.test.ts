import { describe, expect, it } from "vitest";
import type { PdfOrderExtraction } from "./pdf-order-schema";
import { calculateOrderTotal, consolidatePdfOrderLines, matchPdfPharmacy, matchPdfProduct, resolvePdfOrderDate, type ProductCandidate } from "./pdf-order-matching";

const naaliProducts: ProductCandidate[] = [
  { id: "cheveux", name: "Cheveux - Pousse et Force", sku: "1cheveux", ean: "3770010539421", wholesalePriceHt: null, taxRate: 5.5, references: [] },
  { id: "fdb60", name: "Sachet Gommes Anti-Stress - Fruits des Bois x 60", sku: "1antistress60fdb", ean: "3770010539650", wholesalePriceHt: null, taxRate: 5.5, references: [] },
  { id: "stress60", name: "Gommes Anti Stress x60", sku: "1antistress60", ean: "3770010539445", wholesalePriceHt: null, taxRate: 5.5, references: [] },
  { id: "stress20", name: "Sachet découverte Gommes Anti-Stress x20", sku: "1trialantistress", ean: "3770010539391", wholesalePriceHt: null, taxRate: 5.5, references: [] },
  { id: "dream", name: "Dream", sku: "1dream", ean: "3770010539490", wholesalePriceHt: null, taxRate: 5.5, references: [] },
  { id: "dream20", name: "Sachet découverte Gommes Dream x20", sku: "1trialdream", ean: "3770010539698", wholesalePriceHt: null, taxRate: 5.5, references: [] },
];

describe("order photo regression rules", () => {
  it("rejects delivery dates as order dates", () => {
    expect(resolvePdfOrderDate({ orderDate: "09/09/2026", orderDateSource: "delivery_date", deliveryDate: "09/09/2026" })).toBeNull();
    expect(resolvePdfOrderDate({ orderDate: "06/09/2026", orderDateSource: "order_date", deliveryDate: "09/09/2026" })).toBe("2026-09-06");
    expect(resolvePdfOrderDate({ orderDate: "Le 06/09/2026", orderDateSource: "header_date", deliveryDate: "09/09/2026" })).toBe("2026-09-06");
  });

  it("suggests Grande Pharmacie de la Valentine when the printed postcode differs from the directory postcode", () => {
    expect(matchPdfPharmacy(
      {
        name: "GRANDE PHARMACIE DE LA VALENTINE MAROCCHINO CARADELLI",
        siret: null,
        cip: null,
        finess: null,
        address: "CC Auchan La Valentine Route de la Sablière 13011 MARSEILLE",
        postalCode: "13011",
      },
      [{
        pharmacyId: "valentine",
        brandPharmacyId: "naali-valentine",
        relationStatus: "existing_brand_relation",
        name: "GRANDE PHARMACIE DE LA VALENTINE",
        siret: null,
        cip: "2072452",
        finess: null,
        postalCode: "13924",
      }],
    )).toMatchObject({
      status: "suggested",
      method: "name_contains_postal_mismatch",
      match: { pharmacyId: "valentine", brandPharmacyId: "naali-valentine" },
    });
  });

  it("ignores empty references, merges UG rows and reproduces the photographed Valentine total", () => {
    const paid: Array<[string, string, number, number, number, number]> = [
      ["3770010539421", "NAALI CHEVEUX POUSSE ET FORCE 60", 12, 33.08, 35, 2],
      ["3770010539650", "NAALI GUMMIES ANTI STRESS FR ROUGES", 24, 28.34, 35, 4],
      ["3770010539445", "NAALI GUMMIES ANTI STRESS X60", 24, 28.34, 30, 4],
      ["3770010539391", "NAALI GUMMIES ANTI-STRESS 20 GOMMES", 36, 10.33, 35, 6],
      ["3770010539490", "NAALI GUMMIES DREAM SAFRAN MELAT 60", 24, 24.55, 35, 4],
      ["3770010539698", "NAALI GUMMIES DREAM VOYAGE X20", 24, 9.38, 35, 4],
    ];

    const rows: PdfOrderExtraction["lines"] = paid.flatMap(([ean, label, quantity, price, discountRate, freeQuantity]) => [
      { label, sku: null, ean, quantity, freeQuantity: 0, unitPriceHt: price, discountRate, taxRate: 5.5 },
      { label, sku: null, ean, quantity: null, freeQuantity, unitPriceHt: price, discountRate: 100, taxRate: 5.5 },
    ]);

    rows.splice(2, 0,
      { label: "NAALI COLLAGENE CIT V.M. 186G", sku: null, ean: "3770010539278", quantity: null, freeQuantity: 0, unitPriceHt: 40.66, discountRate: 35, taxRate: 5.5 },
      { label: "NAALI ECLAT GELU60", sku: null, ean: "3770010539438", quantity: null, freeQuantity: null, unitPriceHt: 33.08, discountRate: 35, taxRate: 5.5 },
    );

    const cleaned = consolidatePdfOrderLines(rows);

    expect(cleaned).toHaveLength(6);
    expect(cleaned.reduce((sum, line) => sum + (line.quantity ?? 0), 0)).toBe(144);
    expect(cleaned.reduce((sum, line) => sum + (line.freeQuantity ?? 0), 0)).toBe(24);
    expect(cleaned.reduce((sum, line) => sum + (line.quantity ?? 0) + (line.freeQuantity ?? 0), 0)).toBe(168);
    expect(cleaned.find((line) => line.ean === "3770010539278")).toBeUndefined();
    expect(cleaned.find((line) => line.label === "NAALI ECLAT GELU60")).toBeUndefined();
    expect(cleaned.find((line) => line.ean === "3770010539421")).toMatchObject({ quantity: 12, freeQuantity: 2, unitPriceHt: 33.08, discountRate: 35, taxRate: 5.5 });
    expect(calculateOrderTotal(cleaned)).toBe(1947.26);
  });

  it("matches the photographed Naali rows by barcode even if vision puts the code in the wrong identifier field", () => {
    expect(matchPdfProduct({ label: "NAALI CHEVEUX POUSSE ET FORCE 60", sku: "3770010539421", ean: null, quantity: 12, freeQuantity: 2, unitPriceHt: 33.08, discountRate: 35, taxRate: 5.5 }, naaliProducts)).toMatchObject({ status: "matched", method: "barcode", match: { id: "cheveux", taxRate: 5.5 } });
    expect(matchPdfProduct({ label: "NAALI GUMMIES DREAM VOYAGE X20", sku: null, ean: null, quantity: 24, freeQuantity: 4, unitPriceHt: 9.38, discountRate: 35, taxRate: 5.5 }, naaliProducts)).toMatchObject({ status: "matched", method: "label_tokens", match: { id: "dream20", taxRate: 5.5 } });
  });
});
