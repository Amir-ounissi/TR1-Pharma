import { describe, expect, it } from "vitest";
import type { PdfOrderExtraction } from "./pdf-order-schema";
import { consolidatePdfOrderLines, resolvePdfOrderDate } from "./pdf-order-matching";

describe("order photo regression rules", () => {
  it("rejects delivery dates as order dates", () => {
    expect(resolvePdfOrderDate({ orderDate: "09/09/2026", orderDateSource: "delivery_date", deliveryDate: "09/09/2026" })).toBeNull();
    expect(resolvePdfOrderDate({ orderDate: "06/09/2026", orderDateSource: "order_date", deliveryDate: "09/09/2026" })).toBe("2026-09-06");
    expect(resolvePdfOrderDate({ orderDate: "Le 06/09/2026", orderDateSource: "header_date", deliveryDate: "09/09/2026" })).toBe("2026-09-06");
  });

  it("ignores empty references and merges Valentine-style paid and UG rows", () => {
    const paid: Array<[string | null, string, number, number, number]> = [
      ["3770010539421", "NAALI CHEVEUX POUSSE ET FORCE 60", 12, 21.5, 2],
      ["3770010539650", "NAALI GUMMIES ANTI STRESS FR ROUGES", 24, 18.42, 4],
      ["3770010539445", "NAALI GUMMIES ANTI STRESS X60", 24, 19.84, 4],
      ["3770010539391", "NAALI GUMMIES ANTI-STRESS 20 GOMMES", 36, 6.71, 6],
      ["3770010539490", "NAALI GUMMIES DREAM SAFRAN MELAT", 24, 15.96, 4],
      [null, "NAALI GUMMIES DREAM VOYAGE X20", 24, 6.1, 4],
    ];

    const rows: PdfOrderExtraction["lines"] = paid.flatMap(([ean, label, quantity, price, freeQuantity]) => [
      { label, sku: null, ean, quantity, freeQuantity: 0, unitPriceHt: price, discountRate: 35 },
      { label, sku: null, ean, quantity: null, freeQuantity, unitPriceHt: 0, discountRate: 100 },
    ]);

    rows.splice(2, 0,
      { label: "NAALI COLLAGENE CIT V.M. 186G", sku: null, ean: "3770010539278", quantity: null, freeQuantity: 0, unitPriceHt: 26.43, discountRate: 35 },
      { label: "NAALI ECLAT GELU60", sku: null, ean: "3770010539438", quantity: null, freeQuantity: null, unitPriceHt: 21.5, discountRate: 35 },
    );

    const cleaned = consolidatePdfOrderLines(rows);

    expect(cleaned).toHaveLength(6);
    expect(cleaned.reduce((sum, line) => sum + (line.quantity ?? 0), 0)).toBe(144);
    expect(cleaned.reduce((sum, line) => sum + (line.freeQuantity ?? 0), 0)).toBe(24);
    expect(cleaned.reduce((sum, line) => sum + (line.quantity ?? 0) + (line.freeQuantity ?? 0), 0)).toBe(168);
    expect(cleaned.find((line) => line.ean === "3770010539278")).toBeUndefined();
    expect(cleaned.find((line) => line.label === "NAALI ECLAT GELU60")).toBeUndefined();
    expect(cleaned.find((line) => line.ean === "3770010539421")).toMatchObject({ quantity: 12, freeQuantity: 2, unitPriceHt: 21.5, discountRate: 35 });
  });
});
