import { describe, expect, it } from "vitest";
import {
  buildPharmacyCsvRecords,
  detectCsvColumn,
  findProductMatch,
  normalizeCsvText,
  normalizeEan,
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

  it("ignores Excel separator hints and detects common LGO column headings", () => {
    const parsed = parseCsvContent("sep=;\nEAN;Désignation produit;Marque;PAMP HT\n1234567890123;Produit test;Marque A;4,25");
    expect(parsed.headers).toEqual(["EAN", "Désignation produit", "Marque", "PAMP HT"]);
    expect(detectCsvColumn(parsed.headers, "ean")).toBe(0);
    expect(detectCsvColumn(parsed.headers, "name")).toBe(1);
    expect(detectCsvColumn(parsed.headers, "brand")).toBe(2);
    expect(detectCsvColumn(parsed.headers, "price")).toBe(3);
    expect(detectCsvColumn(["Prix achat TTC"], "price")).toBeNull();
    expect(detectCsvColumn(["Code article", "Libellé produit"], "name")).toBe(1);
  });

  it("normalizes French amounts, accents and spreadsheet EAN notation", () => {
    expect(parseFrenchAmount("1 234,56 €")).toBe(1234.56);
    expect(parseFrenchAmount("1.234,56")).toBe(1234.56);
    expect(parseFrenchAmount("12.50")).toBe(12.5);
    expect(parseFrenchAmount("")).toBeNull();
    expect(normalizeCsvText("Crème Éclat & Soin")).toBe("creme eclat soin");
    expect(normalizeEan("8.809782555508E+12")).toBe("8809782555508");
  });

  it("builds pharmacy rows with EAN and optional packaging", () => {
    const parsed = parseCsvContent("EAN;Désignation;Prix achat HT;Conditionnement\n0012345678901;Produit test;4,25;30 gélules");
    const records = buildPharmacyCsvRecords(parsed.rows, {
      ean: 0, name: 1, price: 2, brand: null, format: 3,
    });
    expect(records[0]).toMatchObject({
      lineNumber: 2,
      name: "Produit test",
      ean: "0012345678901",
      format: "30 gélules",
      purchasePriceHt: 4.25,
    });
  });

  it("matches exact EANs and only suggests fuzzy or differently packaged name matches", () => {
    const products = [{
      id: "p1",
      name: "Relief Sun Rice Probiotics SPF50",
      brand_name: "Beauty of Joseon",
      ean: "8809782555508",
      format: "50 ml",
    }];
    expect(findProductMatch({
      name: "Autre désignation",
      brand: null,
      ean: "8809782555508",
      format: "50 ml",
    }, products)).toMatchObject({ productId: "p1", method: "ean" });

    expect(findProductMatch({
      name: "Relief Sun Rice Probiotic SPF50",
      brand: "Beauty of Joseon",
      ean: null,
      format: "50 ml",
    }, products)).toMatchObject({ productId: null, suggestedProductId: "p1", method: "suggested" });

    expect(findProductMatch({
      name: "Relief Sun Rice Probiotics SPF50",
      brand: "Beauty of Joseon",
      ean: null,
      format: "30 ml",
    }, products)).toMatchObject({ productId: null, suggestedProductId: "p1", method: "suggested" });

    expect(findProductMatch({
      name: "Relief Sun Rice Probiotics SPF50",
      brand: "Beauty of Joseon",
      ean: null,
      format: "50ml",
    }, products)).toMatchObject({ productId: "p1", method: "exact" });
  });

  it("does not auto-select an ambiguous exact product name", () => {
    const products = [
      { id: "p1", name: "Magnésium", brand_name: "Marque A", ean: null, format: "30 gélules" },
      { id: "p2", name: "Magnésium", brand_name: "Marque B", ean: null, format: "30 gélules" },
    ];
    expect(findProductMatch({
      name: "Magnésium",
      brand: null,
      ean: null,
      format: "30 gélules",
    }, products)).toMatchObject({ productId: null, suggestedProductId: null, method: "none" });
  });
});
