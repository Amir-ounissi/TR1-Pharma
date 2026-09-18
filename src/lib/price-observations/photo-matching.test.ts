import { describe, expect, it } from "vitest";
import { matchPricePhotoProduct } from "./photo-matching";

const products = [
  {
    id: "p1",
    name: "Dermacalm",
    sku: "DV-DC-50",
    ean: "3400000000001",
    wholesalePriceHt: 18.5,
    taxRate: 5.5,
    references: [],
  },
  {
    id: "p2",
    name: "Dermacalm Plus",
    sku: "DV-DC-PLUS",
    ean: "3400000000002",
    wholesalePriceHt: 20,
    taxRate: 5.5,
    references: [],
  },
];

describe("price photo product matching", () => {
  it("matches an exact EAN", () => {
    expect(matchPricePhotoProduct({
      personalDataDetected: false,
      productLabel: "Dermacalm",
      ean: "3400000000001",
      priceTtc: 29.9,
      priceType: "regular",
      bundleQuantity: null,
      confidence: 0.98,
      warnings: [],
    }, products)).toMatchObject({
      status: "matched",
      method: "ean",
      selectedId: "p1",
    });
  });

  it("does not auto-select an ambiguous label", () => {
    expect(matchPricePhotoProduct({
      personalDataDetected: false,
      productLabel: "Dermacalm",
      ean: null,
      priceTtc: 29.9,
      priceType: "regular",
      bundleQuantity: null,
      confidence: 0.75,
      warnings: [],
    }, [
      products[0],
      { ...products[0], id: "p3", sku: "OTHER", ean: null },
    ])).toMatchObject({
      status: "ambiguous",
      selectedId: null,
    });
  });
});
