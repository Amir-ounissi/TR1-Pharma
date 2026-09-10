import { describe, expect, it } from "vitest";
import { assessPdfOrderExtraction, canonicalizePdfOrderExtraction } from "./pdf-order-extraction-quality";
import type { PdfOrderExtraction } from "./pdf-order-schema";

function order(lines: PdfOrderExtraction["lines"], totalHt = 1947.26): PdfOrderExtraction {
  return {
    orderNumber: "TEST",
    orderDate: "2026-09-10",
    orderDateSource: "order_date",
    deliveryDate: null,
    pharmacy: { name: "Pharmacie Test", siret: null, cip: null, finess: null, address: null, postalCode: "13011" },
    lines,
    totalHt,
    totalVat: 107.1,
    totalTtc: 2054.36,
    warnings: [],
  };
}

describe("PDF order extraction quality", () => {
  it("accepts the Valentine-style structure when paid lines, UG and totals reconcile", () => {
    const extraction = order([
      { label: "A", sku: null, ean: "1111111111111", quantity: 12, freeQuantity: 0, unitPriceHt: 33.08, discountRate: 35, taxRate: 5.5 },
      { label: "A", sku: null, ean: "1111111111111", quantity: null, freeQuantity: 2, unitPriceHt: 33.08, discountRate: 100, taxRate: 5.5 },
      { label: "B", sku: null, ean: "2222222222222", quantity: 24, freeQuantity: 4, unitPriceHt: 28.34, discountRate: 35, taxRate: 5.5 },
      { label: "C", sku: null, ean: "3333333333333", quantity: 24, freeQuantity: 4, unitPriceHt: 28.34, discountRate: 30, taxRate: 5.5 },
      { label: "D", sku: null, ean: "4444444444444", quantity: 36, freeQuantity: 6, unitPriceHt: 10.33, discountRate: 35, taxRate: 5.5 },
      { label: "E", sku: null, ean: "5555555555555", quantity: 24, freeQuantity: 4, unitPriceHt: 24.55, discountRate: 35, taxRate: 5.5 },
      { label: "F", sku: null, ean: null, quantity: 24, freeQuantity: 4, unitPriceHt: 9.38, discountRate: 35, taxRate: 5.5 },
    ]);

    const quality = assessPdfOrderExtraction(extraction);
    expect(quality).toMatchObject({ reliable: true, calculatedHt: 1947.26, lineCount: 6 });
    expect(canonicalizePdfOrderExtraction(extraction).lines[0]).toMatchObject({ quantity: 12, freeQuantity: 2 });
  });

  it("rejects an extraction whose recalculated HT differs from the printed total", () => {
    const extraction = order([
      { label: "Produit", sku: null, ean: null, quantity: 10, freeQuantity: 0, unitPriceHt: 10, discountRate: 0, taxRate: 5.5 },
    ], 200);

    const quality = assessPdfOrderExtraction(extraction);
    expect(quality.reliable).toBe(false);
    expect(quality.issues.join(" ")).toContain("total HT recalculé");
  });

  it("rejects unresolved UG and missing paid prices", () => {
    const extraction = order([
      { label: "UG isolées", sku: null, ean: null, quantity: null, freeQuantity: 4, unitPriceHt: 10, discountRate: 100, taxRate: 5.5 },
      { label: "Produit", sku: null, ean: null, quantity: 12, freeQuantity: 0, unitPriceHt: null, discountRate: 35, taxRate: 5.5 },
    ], 100);

    const quality = assessPdfOrderExtraction(extraction);
    expect(quality.reliable).toBe(false);
    expect(quality.issues.join(" ")).toContain("UG");
    expect(quality.issues.join(" ")).toContain("prix unitaire HT");
  });

  it("rejects inconsistent HT + TVA != TTC totals", () => {
    const extraction = order([
      { label: "Produit", sku: null, ean: null, quantity: 2, freeQuantity: 0, unitPriceHt: 10, discountRate: 0, taxRate: 5.5 },
    ], 20);
    extraction.totalVat = 1.1;
    extraction.totalTtc = 50;

    const quality = assessPdfOrderExtraction(extraction);
    expect(quality.reliable).toBe(false);
    expect(quality.issues.join(" ")).toContain("TVA");
  });
});
