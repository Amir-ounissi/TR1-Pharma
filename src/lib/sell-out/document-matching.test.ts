import { describe, expect, it } from "vitest";

import type { ProductCandidate } from "@/lib/orders/pdf-order-matching";
import { matchSellOutDocument } from "@/lib/sell-out/document-matching";
import { parseSellOutDocumentExtraction } from "@/lib/sell-out/document-schema";

const product: ProductCandidate = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Naali Sommeil",
  sku: "SOMMEIL-01",
  ean: "3400000000001",
  wholesalePriceHt: 12,
  taxRate: 5.5,
  references: [],
};

function extraction(line: Record<string, unknown>) {
  return parseSellOutDocumentExtraction({
    periodStart: "2026-09-07",
    periodEnd: "2026-09-07",
    personalDataDetected: false,
    lines: [{
      label: "Naali Sommeil",
      sourceProductCode: null,
      ean: "3400000000001",
      unitsSold: 4,
      revenueHt: null,
      revenueTtc: null,
      unitPriceTtc: null,
      taxRate: null,
      confidence: 0.95,
      ...line,
    }],
    totalUnits: 4,
    totalRevenueHt: null,
    totalRevenueTtc: null,
    confidence: 0.95,
    warnings: [],
  });
}

describe("sell-out document matching", () => {
  it("rapproche un produit par EAN et conserve un CA HT explicite", () => {
    const [line] = matchSellOutDocument(extraction({ revenueHt: 40 }), [product]);
    expect(line.product.selectedId).toBe(product.id);
    expect(line.product.status).toBe("matched");
    expect(line.revenueHt).toBe(40);
    expect(line.revenueHtSource).toBe("document");
  });

  it("convertit un CA TTC uniquement avec une TVA connue", () => {
    const [line] = matchSellOutDocument(extraction({ revenueTtc: 42.2 }), [product]);
    expect(line.revenueHt).toBe(40);
    expect(line.revenueHtSource).toBe("derived_from_ttc");
    expect(line.taxRate).toBe(5.5);
    expect(line.warning).toContain("TVA catalogue");
  });

  it("laisse le CA HT vide si le TTC est lisible mais la TVA inconnue", () => {
    const unknownProduct: ProductCandidate = { ...product, taxRate: null };
    const [line] = matchSellOutDocument(extraction({ revenueTtc: 42.2 }), [unknownProduct]);
    expect(line.revenueHt).toBeNull();
    expect(line.revenueHtSource).toBeNull();
    expect(line.warning).toContain("TVA inconnue");
  });

  it("signale une quantité absente au lieu de l'inventer", () => {
    const [line] = matchSellOutDocument(extraction({ unitsSold: null }), [product]);
    expect(line.unitsSold).toBeNull();
    expect(line.warning).toContain("Quantité vendue à confirmer");
  });
});