import { describe, expect, it } from "vitest";
import { calculateOrderTotal, consolidatePdfOrderLines, hasMeaningfulTotalDifference, matchPdfPharmacy, matchPdfProduct, normalizePdfOrderDate, resolvedLinePrice } from "./pdf-order-matching";

const pharmacies = [
  { pharmacyId: "pharmacy-1", brandPharmacyId: "brand-pharmacy-1", relationStatus: "existing_brand_relation" as const, name: "Pharmacie du Centre", siret: "12345678901234", cip: "CIP-1", finess: "FIN-1", postalCode: "75001" },
  { pharmacyId: "pharmacy-2", brandPharmacyId: null, relationStatus: "global_only" as const, name: "Pharmacie du Centre", siret: "999", cip: "CIP-2", finess: "FIN-2", postalCode: "75002" },
];
const products = [
  { id: "product-1", name: "Vitamine C", sku: "VK-C", ean: "3760000000001", wholesalePriceHt: 12.5, taxRate: 5.5, references: [{ sku: "LEGACY-C", ean: "3760000000002", label: "Vitamine C" }] },
  { id: "product-2", name: "Vitamine C", sku: "VK-C-2", ean: "3760000000003", wholesalePriceHt: 15, taxRate: 20, references: [] },
];
const naaliProducts = [
  { id: "dream", name: "Dream", sku: "1dream", ean: "3770010539490", wholesalePriceHt: 24.55, taxRate: 5.5, references: [] },
  { id: "dream-voyage", name: "Dream Voyage x20", sku: "1dreamvoyage", ean: null, wholesalePriceHt: 9.38, taxRate: 5.5, references: [] },
  { id: "magnesium", name: "Magnésium +", sku: "1magnesium", ean: "3770010539483", wholesalePriceHt: 28.34, taxRate: 5.5, references: [] },
  { id: "anti-stress-fdb", name: "Sachet Gommes Anti-Stress - Fruits des Bois x 60", sku: "1antistress60fdb", ean: "3770010539650", wholesalePriceHt: 28.34, taxRate: 5.5, references: [] },
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

  it("does not auto-select an existing pharmacy when the document postal code conflicts", () => {
    expect(matchPdfPharmacy({
      name: "GRANDE PHARMACIE DE LA VALENTINE",
      siret: null,
      cip: null,
      finess: null,
      address: "13011 Marseille",
      postalCode: "13011",
    }, [{
      pharmacyId: "valentine",
      brandPharmacyId: "brand-valentine",
      relationStatus: "existing_brand_relation",
      name: "GRANDE PHARMACIE DE LA VALENTINE",
      siret: null,
      cip: null,
      finess: null,
      postalCode: "13924",
    }])).toMatchObject({
      status: "suggested",
      method: "name_postal_mismatch",
      match: { pharmacyId: "valentine" },
    });
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

  it("merges a free-unit PDF row into the paid line", () => {
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
        unitPriceHt: 17,
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

  it("does not attach free units based on a matching label when EANs disagree", () => {
    const rows = consolidatePdfOrderLines([
      { label: "Anti-Stress", sku: null, ean: "3770010539650", quantity: 12, freeQuantity: 0, unitPriceHt: 28.34, discountRate: 35 },
      { label: "Anti-Stress", sku: null, ean: "3770010539445", quantity: null, freeQuantity: 2, unitPriceHt: 28.34, discountRate: 100 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].freeQuantity).toBe(0);
    expect(rows[1].freeQuantity).toBe(2);
  });

  it("uses EAN (including registered reference EAN), never SKU or product name", () => {
    expect(matchPdfProduct({ label: "Wrong label", sku: null, ean: "3760000000001", quantity: 1, unitPriceHt: 10, discountRate: null }, products))
      .toMatchObject({ status: "matched", method: "ean", match: { id: "product-1" } });
    expect(matchPdfProduct({ label: null, sku: null, ean: "3760000000002", quantity: 1, unitPriceHt: 10, discountRate: null }, products))
      .toMatchObject({ status: "matched", method: "reference_ean", match: { id: "product-1" } });
    expect(matchPdfProduct({ label: "Vitamine C", sku: "VK-C", ean: null, quantity: 1, unitPriceHt: 10, discountRate: null }, products))
      .toMatchObject({ status: "unmatched", method: "ean_required", match: null });
    expect(matchPdfProduct({ label: "Vitamine C", sku: "LEGACY-C", ean: null, quantity: 1, unitPriceHt: 10, discountRate: null }, products))
      .toMatchObject({ status: "unmatched", method: "ean_required", match: null });
  });

  it("keeps an EAN match when the product label is consistent", () => {
    expect(matchPdfProduct({
      label: "NAALI GUMMIES ANTI STRESS FR ROUGES",
      sku: null,
      ean: "3770010539650",
      quantity: 24,
      unitPriceHt: 28.34,
      discountRate: 35,
    }, naaliProducts)).toMatchObject({
      status: "matched",
      method: "ean",
      match: { id: "anti-stress-fdb" },
    });
  });

  it("keeps the EAN authoritative even when the printed name conflicts", () => {
    expect(matchPdfProduct({
      label: "NAALI GUMMIES DREAM VOYAGE X20",
      sku: null, ean: "3770010539483", quantity: 24,
      unitPriceHt: 9.38, discountRate: 35,
    }, naaliProducts)).toMatchObject({
      status: "matched", method: "ean", match: { id: "magnesium" },
    });
  });

  it("never substitutes a label or SKU when an explicit EAN is unknown", () => {
    expect(matchPdfProduct({
      label: "Dream", sku: "1dream", ean: "9999999999999",
      quantity: 12, unitPriceHt: 24.55, discountRate: 35,
    }, naaliProducts)).toMatchObject({
      status: "unmatched", method: "ean_unknown", match: null,
    });
    expect(matchPdfProduct({
      label: "Dream", sku: null, ean: null, quantity: 12,
      unitPriceHt: 24.55, discountRate: 35,
    }, naaliProducts)).toMatchObject({
      status: "unmatched", method: "ean_required", match: null,
    });
  });

  it("uses catalog price exclusively and flags differences with document prices", () => {
    const line = { label: null, sku: null, ean: "3760000000001", quantity: 1, unitPriceHt: 10, discountRate: null };
    expect(resolvedLinePrice(line, products[0])).toEqual({
      price: 12.5, warning: "Prix du document différent : prix catalogue TR1 appliqué.",
    });
    expect(resolvedLinePrice({ ...line, unitPriceHt: null }, products[0])).toEqual({ price: 12.5, warning: null });
    expect(resolvedLinePrice(line, null)).toEqual({
      price: null, warning: "Prix catalogue TR1 indisponible : prix du document ignoré.",
    });
  });

  it("flags material total differences", () => {
    expect(calculateOrderTotal([{ quantity: 2, unitPriceHt: 10, discountRate: 5 }])).toBe(19);
    expect(hasMeaningfulTotalDifference(19.03, 19)).toBe(true);
    expect(hasMeaningfulTotalDifference(19.02, 19)).toBe(false);
  });
});
