import { describe, expect, it } from "vitest";

import {
  parseSellOutDocumentExtraction,
  sellOutExtractionHasPotentialPii,
} from "@/lib/sell-out/document-schema";

function extraction(overrides: Record<string, unknown> = {}) {
  return parseSellOutDocumentExtraction({
    periodStart: "2026-09-07",
    periodEnd: "2026-09-07",
    personalDataDetected: false,
    lines: [{
      label: "Produit test",
      sourceProductCode: "SKU-1",
      ean: "3400000000001",
      unitsSold: 4,
      revenueHt: null,
      revenueTtc: 42,
      unitPriceTtc: 10.5,
      taxRate: null,
      confidence: 0.9,
    }],
    totalUnits: 4,
    totalRevenueHt: null,
    totalRevenueTtc: 42,
    confidence: 0.9,
    warnings: [],
    ...overrides,
  });
}

describe("sell-out document schema", () => {
  it("accepte une extraction agrégée sans donnée personnelle", () => {
    expect(sellOutExtractionHasPotentialPii(extraction())).toBe(false);
  });

  it("bloque une extraction marquée comme contenant des données personnelles", () => {
    expect(sellOutExtractionHasPotentialPii(extraction({ personalDataDetected: true }))).toBe(true);
  });

  it("détecte aussi un email qui aurait échappé au marqueur du modèle", () => {
    const value = extraction({ warnings: ["client test@example.com présent dans le document"] });
    expect(sellOutExtractionHasPotentialPii(value)).toBe(true);
  });

  it("refuse une quantité négative", () => {
    expect(() => extraction({
      lines: [{
        label: "Produit test",
        sourceProductCode: null,
        ean: null,
        unitsSold: -1,
        revenueHt: null,
        revenueTtc: null,
        unitPriceTtc: null,
        taxRate: null,
        confidence: null,
      }],
    })).toThrow();
  });
});