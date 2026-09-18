import { afterEach, describe, expect, it } from "vitest";
import {
  extractPricePhoto,
  parsePricePhotoExtraction,
  PricePhotoImportError,
} from "@/lib/field-data/price-photo-extraction";

const originalMock = process.env.PRICE_PHOTO_E2E_MOCK;
const originalAppEnv = process.env.APP_ENV;

afterEach(() => {
  process.env.PRICE_PHOTO_E2E_MOCK = originalMock;
  process.env.APP_ENV = originalAppEnv;
});

describe("price photo extraction", () => {
  it("validates a regular price observation", () => {
    expect(parsePricePhotoExtraction({
      personalDataDetected: false,
      productLabel: "Dermacalm 50 ml",
      ean: "3400000000001",
      priceTtc: 31.9,
      priceType: "regular",
      bundleQuantity: null,
      confidence: 0.96,
      warnings: [],
    })).toMatchObject({
      priceTtc: 31.9,
      priceType: "regular",
      confidence: 0.96,
    });
  });

  it("requires bundle quantity for a bundle offer", () => {
    expect(() => parsePricePhotoExtraction({
      personalDataDetected: false,
      productLabel: "Dermacalm",
      ean: null,
      priceTtc: 49.8,
      priceType: "bundle",
      bundleQuantity: null,
      confidence: 0.9,
      warnings: [],
    })).toThrow();
  });

  it("uses the test preview without calling a provider", async () => {
    process.env.APP_ENV = "test";
    process.env.PRICE_PHOTO_E2E_MOCK = JSON.stringify({
      personalDataDetected: false,
      productLabel: "Dermacalm",
      ean: "3400000000001",
      priceTtc: 29.9,
      priceType: "promotion",
      bundleQuantity: null,
      confidence: 0.93,
      warnings: ["Prix promotionnel à confirmer."],
    });

    const result = await extractPricePhoto(
      new File(["photo"], "prix.jpg", { type: "image/jpeg" }),
      async () => {
        throw new Error("provider should not be called");
      },
    );

    expect(result).toMatchObject({
      productLabel: "Dermacalm",
      ean: "3400000000001",
      priceTtc: 29.9,
      priceType: "promotion",
    });
  });

  it("rejects a preview that reports personal data", async () => {
    process.env.APP_ENV = "test";
    process.env.PRICE_PHOTO_E2E_MOCK = JSON.stringify({
      personalDataDetected: true,
      productLabel: null,
      ean: null,
      priceTtc: null,
      priceType: "other",
      bundleQuantity: null,
      confidence: 0.2,
      warnings: [],
    });

    await expect(
      extractPricePhoto(new File(["photo"], "prix.jpg", { type: "image/jpeg" })),
    ).rejects.toBeInstanceOf(PricePhotoImportError);
  });
});
