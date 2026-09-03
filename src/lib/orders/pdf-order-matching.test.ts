import { describe, expect, it } from "vitest";
import { calculateOrderTotal, hasMeaningfulTotalDifference, matchPdfPharmacy, matchPdfProduct, resolvedLinePrice } from "./pdf-order-matching";

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
