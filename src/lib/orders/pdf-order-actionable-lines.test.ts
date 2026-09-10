import { describe, expect, it } from "vitest";
import { calculateOrderTotal, consolidatePdfOrderLines } from "./pdf-order-matching";
import { parsePdfOrderExtraction } from "./pdf-order-schema";

function line(
  label: string,
  quantity: number | null,
  freeQuantity: number,
  unitPriceHt: number | null,
  discountRate: number | null,
  ean: string | null = null,
) {
  return {
    label,
    sku: null,
    ean,
    quantity,
    freeQuantity,
    unitPriceHt,
    discountRate,
    taxRate: 5.5,
  };
}

describe("pharmacy order table with paid and UG rows", () => {
  it("keeps only ordered rows, merges UG rows and preserves the document totals", () => {
    const extraction = parsePdfOrderExtraction({
      orderNumber: "155045",
      orderDate: null,
      orderDateSource: "delivery_date",
      deliveryDate: "2026-09-09",
      pharmacy: {
        name: "Pharmacie test",
        siret: null,
        cip: null,
        finess: null,
        address: null,
        postalCode: "13011",
      },
      lines: [
        line("NAALI CHEVEUX POUSSE ET FORCE 60", 12, 0, 33.08, 35, "3770010539421"),
        line("NAALI CHEVEUX POUSSE ET FORCE 60", null, 2, 33.08, 100, "3770010539421"),
        line("NAALI COLLAGENE CIT V.M. 186G", null, 0, 40.66, 35, "3770010539278"),
        line("NAALI COMPTE GOUTTE CYCLE 18ML", null, 0, 18.86, 35, "3770010539254"),
        line("NAALI ECLAT GELU60", null, 0, 33.08, 35, "3770010539438"),
        line("NAALI GUMMIES ANTI STRESS FR ROUGES", 24, 0, 28.34, 35, "3770010539650"),
        line("NAALI GUMMIES ANTI STRESS FR ROUGES", null, 4, 28.34, 100, "3770010539650"),
        line("NAALI GUMMIES ANTI STRESS X42", null, 0, 23.6, 30, "3770010539360"),
        line("NAALI GUMMIES ANTI STRESS X60", 24, 0, 28.34, 30, "3770010539445"),
        line("NAALI GUMMIES ANTI STRESS X60", null, 4, 28.34, 100, "3770010539445"),
        line("NAALI GUMMIES ANTI-STRESS 20 GOMMES", 36, 0, 10.33, 35, "3770010539391"),
        line("NAALI GUMMIES ANTI-STRESS 20 GOMMES", null, 6, 10.33, 100, "3770010539391"),
        line("NAALI GUMMIES DREAM SAFRAN MELAT 60", 24, 0, 24.55, 35, "3770010539490"),
        line("NAALI GUMMIES DREAM SAFRAN MELAT 60", null, 4, 24.55, 100, "3770010539490"),
        // Some pharmacy ERP exports omit the barcode on both rows: label identity must still merge UG.
        line("NAALI GUMMIES DREAM VOYAGE X20", 24, 0, 9.38, 35),
        line("NAALI GUMMIES DREAM VOYAGE X20", null, 4, 9.38, 100),
        line("NAALI GUMMIES MAGNESIUM SAFRAN", null, 0, 28.34, 35, "3770010539483"),
        line("NAALI GUMMIES ZENKIDS TDAH X90", null, 0, 31.18, 30, "3770010539407"),
        line("NAALI KIDS SAFRAN PDRE", null, 0, 28.34, 35, "3770010539667"),
        line("NAALI MENOPAUSE TRANSITION GELU60", null, 0, 36.97, 35, "3770010539353"),
      ],
      totalHt: 1947.26,
      totalVat: 107.1,
      totalTtc: 2054.36,
      warnings: [],
    });

    // 20 catalog rows in the source document -> only the 12 rows carrying paid or free units survive extraction.
    expect(extraction.lines).toHaveLength(12);
    expect(extraction.lines.every((item) => (item.quantity ?? 0) > 0 || (item.freeQuantity ?? 0) > 0)).toBe(true);

    // Paid + 100%-discount UG rows are one commercial product line in TR1.
    const consolidated = consolidatePdfOrderLines(extraction.lines);
    expect(consolidated).toHaveLength(6);

    const paidUnits = consolidated.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const freeUnits = consolidated.reduce((sum, item) => sum + (item.freeQuantity ?? 0), 0);
    expect({ paidUnits, freeUnits, totalUnits: paidUnits + freeUnits }).toEqual({
      paidUnits: 144,
      freeUnits: 24,
      totalUnits: 168,
    });

    expect(consolidated.find((item) => item.label === "NAALI GUMMIES DREAM VOYAGE X20")).toMatchObject({
      quantity: 24,
      freeQuantity: 4,
    });

    expect(calculateOrderTotal(consolidated.map((item) => ({
      quantity: item.quantity,
      unitPriceHt: item.unitPriceHt,
      discountRate: item.discountRate,
    })))).toBe(1947.26);

    expect(consolidated.some((item) => item.label === "NAALI COLLAGENE CIT V.M. 186G")).toBe(false);
    expect(consolidated.some((item) => item.label === "NAALI GUMMIES ANTI STRESS X42")).toBe(false);
  });
});
