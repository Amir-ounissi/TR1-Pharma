import { describe, expect, it } from "vitest";
import { stockPhotoSchema } from "./extraction";

describe("TR1 Vision shelf label extraction", () => {
  const base = {
    personalDataDetected: false,
    productLabel: "NAALI DREAM SACHET 20",
    ean: "3770010539698",
    stockShelf: 10,
    stockBackroom: 2,
    facings: 3,
    labelLayout: "hyphen_and_facings",
    rawStockText: "10-2 | 3",
    confidence: 0.76,
    warnings: ["Convention de l'étiquette à confirmer."],
  } as const;

  it("keeps shelf, backroom and facings independent", () => {
    const parsed = stockPhotoSchema.parse(base);
    expect(parsed.stockShelf).toBe(10);
    expect(parsed.stockBackroom).toBe(2);
    expect(parsed.facings).toBe(3);
    // Total stock = 10 + 2; facing is a display count, not inventory.
    expect(parsed.stockShelf! + parsed.stockBackroom!).toBe(12);
  });

  it("allows missing quantities on promotional labels without replacing them with zero", () => {
    const parsed = stockPhotoSchema.parse({
      ...base, stockShelf: null, stockBackroom: null, facings: null,
      labelLayout: "promotion", rawStockText: null,
    });
    expect(parsed.stockShelf).toBeNull();
    expect(parsed.stockBackroom).toBeNull();
    expect(parsed.facings).toBeNull();
  });

  it("does not accept negative quantities or non-integer facings", () => {
    expect(stockPhotoSchema.safeParse({ ...base, stockShelf: -1 }).success).toBe(false);
    expect(stockPhotoSchema.safeParse({ ...base, facings: 1.5 }).success).toBe(false);
  });

  it("does not accept unstructured personal fields or unrecognized output properties", () => {
    expect(stockPhotoSchema.safeParse({ ...base, patient_name: "Patient" }).success).toBe(false);
  });
});
