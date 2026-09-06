import { describe, expect, it } from "vitest";
import { calculateOrderTotal, consolidatePdfOrderLines, hasMeaningfulTotalDifference, matchPdfPharmacy, matchPdfProduct, normalizePdfOrderDate, resolvePdfOrderDate, resolvedLinePrice } from "./pdf-order-matching";

const pharmacies = [
  { pharmacyId: "pharmacy-1", brandPharmacyId: "brand-pharmacy-1", relationStatus: "existing_brand_relation" as const, name: "Pharmacie du Centre", siret: "12345678901234", cip: "CIP-1", finess: "FIN-1", postalCode: "75001" },
  { pharmacyId: "pharmacy-2", brandPharmacyId: null, relationStatus: "global_only" as const, name: "Pharmacie du Centre", siret: "999", cip: "CIP-2", finess: "FIN-2", postalCode: "75002" },
];
const products = [
  { id: "product-1", name: "Vitamine C", sku: "VK-C", ean: "3760000000001", wholesalePriceHt: 12.5, taxRate: 5.5, references: [{ sku: "LEGACY-C", ean: "3760000000002", label: "Vitamine C" }] },
  { id: "product-2", name: "Vitamine C", sku: "VK-C-2", ean: "3760000000003", wholesalePriceHt: 15, taxRate: 20, references: [] },
];

describe("PDF order deterministic matching", () => {
  it("matches a pharmacy by SIRET before other information", () => {
    expect(matchPdfPharmacy({ name: "Other", siret: "123 456 789 01234", cip: null, finess: null, address: null, postalCode: null }, pharmacies)).toMatchObject({ status: "matched", method: "siret", match: { pharmacyId: "pharmacy-1" } });
  });

  it("matches a pharmacy by CIP or FINESS", () => {
    expect(matchPdfPharmacy({ name: null, siret: null, cip: "cip-2", finess: null, address: null, postalCode: null }, pharmacies)).toMatchObject({ status: "matched", method: "cip", match: { pharmacyId: "pharmacy-2", relationStatus: "global_only" } });
    expect(matchPdfPharmacy({ name: null, siret: null, cip: null, finess: "fin-1", address: null, postalCode: null }, pharmacies)).toMatchObject({ status: "matched", method: "finess", match: { pharmacyId: "pharmacy-1" } });
  });

  it("requires manual selection when a pharmacy match is ambiguous", () => {
    expect(matchPdfPharmacy({ name: "Pharmacie du Centre", siret: null, cip: null, finess: null, address: null, postalCode: "75001" }, [{ ...pharmacies[0] }, { ...pharmacies[0], pharmacyId: "duplicate" }])).toMatchObject({ status: "ambiguous", match: null });
  });

  it("requires explicit confirmation for a global-only name and postal-code suggestion", () => {
    expect(matchPdfPharmacy({ name: "Pharmacie du Centre", siret: null, cip: null, finess: null, address: null, postalCode: "75002" }, pharmacies)).toMatchObject({ status: "suggested", method: "name_postal_code", match: { pharmacyId: "pharmacy-2" } });
  });

  it("suggests a pharmacy when the PDF adds titulaire names to the directory name", () => {
    expect(
      matchPdfPharmacy(
        {
          name: "PHARMACIE PLEIN SUD M. ESCOJIDO & Mme MONTGAILLARD",
          siret: null,
          cip: null,
          finess: null,
          address: "CENTRE COMMERCIAL AUCHAN PLEIN SUD",
          postalCode: "34470",
        },
        [
          {
            pharmacyId: "perols",
            brandPharmacyId: null,
            relationStatus: "global_only",
            name: "PHARMACIE PLEIN SUD",
            siret: null,
            cip: "2107715",
            finess: null,
            postalCode: "34470",
          },
        ],
      ),
    ).toMatchObject({
      status: "suggested",
      method: "name_contains_postal_code",
      match: { pharmacyId: "perols" },
    });
  });

  it("normalizes a French document date for the HTML date field", () => {
    expect(normalizePdfOrderDate("Le 31/08/2026 à 11:42")).toBe("2026-08-31");
    expect(normalizePdfOrderDate("2026-08-31")).toBe("2026-08-31");
  });

  it("never accepts a delivery date as the order date", () => {
    expect(resolvePdfOrderDate({ orderDate: "09/09/2026", orderDateSource: "delivery_date", deliveryDate: "09/09/2026" })).toBeNull();
    expect(resolvePdfOrderDate({ orderDate: "06/09/2026", orderDateSource: "order_date", deliveryDate: "09/09/2026" })).toBe("2026-09-06");
    expect(resolvePdfOrderDate({ orderDate: "Le 06/09/2026", orderDateSource: "header_date", deliveryDate: "09/09/2026" })).toBe("2026-09-06");
  });

  it("merges a free-unit PDF row into the paid line even when the free row has price zero", () => {
    const lines = consolidatePdfOrderLines([
      {
        label: "VK SWISS ASHWAGANDHA BTE 30",
        sku: null,
        ean: "7629999810969",
        quantity: 8,
        freeQuantity: 0,
        unitPriceHt: 17,
        discountRate: 0,
      },
      {
        label: "VK SWISS ASHWAGANDHA BTE 30",
        sku: null,
        ean: "7629999810969",
        quantity: null,
        freeQuantity: 2,
        unitPriceHt: 0,
        discountRate: 100,
      },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      quantity: 8,
      freeQuantity: 2,
      unitPriceHt: 17,
      discountRate: 0,
    });
  });

  it("cleans a Valentine-style order: ignores empty references and merges the six UG rows", () => {
    const paid = [
      ["3770010539421", "NAALI CHEVEUX POUSSE ET FORCE 60", 12, 21.5, 2],
      ["3770010539650", "NAALI GUMMIES ANTI STRESS FR ROUGES", 24, 18.42, 4],
      ["3770010539445", "NAALI GUMMIES ANTI STRESS X60", 24, 19.84, 4],
      ["3770010539391", "NAALI GUMMIES ANTI-STRESS 20 GOMMES", 36, 6.71, 6],
      ["3770010539490", "NAALI GUMMIES DREAM SAFRAN MELAT", 24, 15.96, 4],
      [null, "NAALI GUMMIES DREAM VOYAGE X20", 24, 6.1, 4],
    ] as const;

    const rows = paid.flatMap(([ean, label, quantity, price, freeQuantity]) => [
      { label, sku: null, ean, quantity, freeQuantity: 0, unitPriceHt: price, discountRate: 35 },
      { label, sku: null, ean, quantity: null, freeQuantity, unitPriceHt: 0, discountRate: 100 },
    ]);

    rows.splice(2, 0,
      { label: "NAALI COLLAGENE CIT V.M. 186G", sku: null, ean: "3770010539278", quantity: null, freeQuantity: 0, unitPriceHt: 26.43, discountRate: 35 },
      { label: "NAALI ECLAT GELU60", sku: null, ean: "3770010539438", quantity: null, freeQuantity: null, unitPriceHt: 21.5, discountRate: 35 },
    );

    const cleaned = consolidatePdfOrderLines(rows);
    expect(cleaned).toHaveLength(6);
    expect(cleaned.reduce((sum, line) => sum + (line.quantity ?? 0), 0)).toBe(144);
    expect(cleaned.reduce((sum, line) => sum + (line.freeQuantity ?? 0), 0)).toBe(24);
    expect(cleaned.find((line) => line.ean === "3770010539278")).toBeUndefined();
    expect(cleaned.find((line) => line.label === "NAALI ECLAT GELU60")).toBeUndefined();
  });

  it("matches products by EAN, SKU, and a reference", () => {
    expect(matchPdfProduct({ label: null, sku: null, ean: "3760000000001", quantity: 1, unitPriceHt: 10, discountRate: null }, products)).toMatchObject({ status: "matched", method: "ean", match: { id: "product-1" } });
    expect(matchPdfProduct({ label: null, sku: "VK-C", ean: null, quantity: 1, unitPriceHt: 10, discountRate: null }, products)).toMatchObject({ status: "matched", method: "sku", match: { id: "product-1" } });
    expect(matchPdfProduct({ label: null, sku: "LEGACY-C", ean: null, quantity: 1, unitPriceHt: 10, discountRate: null }, products)).toMatchObject({ status: "matched", method: "reference_sku", match: { id: "product-1" } });
  });

  it("requires manual selection for an ambiguous product name", () => {
    expect(matchPdfProduct({ label: "Vitamine C", sku: null, ean: null, quantity: 1, unitPriceHt: 10, discountRate: null }, products)).toMatchObject({ status: "ambiguous", match: null });
  });

  it("uses the catalogue price only when the PDF price is absent", () => {
    expect(resolvedLinePrice({ label: null, sku: null, ean: null, quantity: 1, unitPriceHt: null, discountRate: null }, products[0])).toEqual({ price: 12.5, warning: "Prix PDF absent : prix catalogue proposé." });
  });

  it("flags material total differences", () => {
    expect(calculateOrderTotal([{ quantity: 2, unitPriceHt: 10, discountRate: 5 }])).toBe(19);
    expect(hasMeaningfulTotalDifference(19.03, 19)).toBe(true);
    expect(hasMeaningfulTotalDifference(19.02, 19)).toBe(false);
  });
});
