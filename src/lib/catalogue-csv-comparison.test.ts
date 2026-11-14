import { describe, expect, it } from "vitest";
import {
  buildPharmacyCsvRecords,
  detectCsvColumn,
  findProductMatch,
  normalizeCsvText,
  parseCsvContent,
  parseFrenchAmount,
} from "./catalogue-csv-comparison";

describe("catalogue CSV comparison helpers", () => {
  it("parses French semicolon CSV, quoted separators and escaped quotes", () => {
    const parsed = parseCsvContent(
      'EAN;Désignation;Prix achat HT\r\n"1234567890123";"Crème; nuit";"12,50"\r\n"1234567890124";"Soin ""premium""";"9,90"'
    );
    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows).toEqual([
      ["1234567890123", "Crème; nuit", "12,50"],
      ["1234567890124", 'Soin "premium"', "9,90"],
    ]);
  });

  it("detects common LGO column headings", () => {
    const headers = ["Code barre", "Désignation produit", "Marque", "PAMP HT"];
    expect(detectCsvColumn(headers, "ean")).toBe(0);
    expect(detectCsvColumn(headers, "name")).toBe(1);
    expect(detectCsvColumn(headers, "brand")).toBe(2);
    expect(detectCsvColumn(headers, "price")).toBe(3);
  });

  it("normalizes French amounts and accents", () => {
    expect(parseFrenchAmount("1 234,56 €")).toBe(1234.56);
    expect(parseFrenchAmount("1.234,56")).toBe(1234.56);
    expect(parseFrenchAmount("12.50")).toBe(12.5);
    expect(parseFrenchAmount("")).toBeNull();
    expect(normalizeCsvText("Crème Éclat & Soin")).toBe("creme eclat soin");
  });

  it("builds pharmacy rows without losing EAN values", () => {
    const parsed = parseCsvContent("EAN;Désignation;Prix achat HT\n0012345678901;Produit test;4,25");
    const records = buildPharmacyCsvRecords(parsed.rows, {
      ean: 0, name: 1, price: 2, brand: null,
    });
    expect(records[0]).toMatchObject({
      lineNumber: 2,
      name: "Produit test",
      ean: "0012345678901",
      purchasePriceHt: 4.25,
    });
  });

  it("matches exact EANs and only suggests fuzzy name matches", () => {
    const products = [{
      id: "p1",
      name: "Relief Sun Rice Probiotics SPF50",
      brand_name: "Beauty of Joseon",
      ean: "8809782555508",
    }];
    expect(findProductMatch({
      name: "Autre désignation",
      brand: null,
      ean: "8809782555508",
    }, products)).toMatchObject({ productId: "p1", method: "ean" });

    expect(findProductMatch({
      name: "Relief Sun Rice Probiotic SPF50",
      brand: "Beauty of Joseon",
      ean: null,
    }, products)).toMatchObject({ productId: null, suggestedProductId: "p1", method: "suggested" });
  });
});
