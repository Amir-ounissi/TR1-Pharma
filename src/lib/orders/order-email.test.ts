import { describe, expect, it } from "vitest";
import { buildTr1OrderPdf } from "./order-email";

function sampleOrder(overrides: Partial<Parameters<typeof buildTr1OrderPdf>[0]> = {}) {
  return {
    reference: "BDC-TEST-001",
    orderDate: "2026-09-17T10:00:00.000Z",
    brandName: "VK SWISS",
    brandCode: "VKSWISS",
    brandOrderEmail: "orders@example.test",
    commercialEmail: "commercial@example.test",
    pharmacy: {
      name: "PHARMACIE TEST",
      code: "1234567",
      addressLine1: "1 rue de la Pharmacie",
      postalCode: "34000",
      city: "Montpellier",
      email: "pharmacie@example.test",
      vatNumber: "FR00123456789",
    },
    items: [
      {
        reference: "6467333",
        ean: "7629999810969",
        designation: "Ashwagandha KSM-66",
        quantity: 12,
        freeQuantity: 1,
        unitPriceHt: 17,
        discountRate: 0,
        netUnitPriceHt: 17,
        lineTotalHt: 204,
        taxRate: 5.5,
        unitsPerCase: 1,
      },
    ],
    totals: {
      subtotalHt: 204,
      discountAmountHt: 0,
      netAmountHt: 204,
      taxAmount: 11.22,
      totalTtc: 215.22,
    },
    notes: "Commande test",
    ...overrides,
  };
}

describe("buildTr1OrderPdf", () => {
  it("renders the validated commercial data and catalogue metadata", () => {
    const pdf = buildTr1OrderPdf(sampleOrder());
    const content = pdf.toString("latin1");

    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content).toContain("BDC-TEST-001");
    expect(content).toContain("VK SWISS");
    expect(content).toContain("PHARMACIE TEST");
    expect(content).toContain("Ashwagandha KSM-66");
    expect(content).toContain("6467333");
    expect(content).toContain("7629999810969");
    expect(content).toContain("PCB : 1");
    expect(content).toContain("UG offerte(s)");
    expect(content).toContain("100 %");
  });

  it("does not invent a free unit when none was validated", () => {
    const input = sampleOrder({
      items: [
        {
          reference: "6467333",
          ean: "7629999810969",
          designation: "Ashwagandha KSM-66",
          quantity: 8,
          freeQuantity: 0,
          unitPriceHt: 17,
          discountRate: 0,
          netUnitPriceHt: 17,
          lineTotalHt: 136,
          taxRate: 5.5,
          unitsPerCase: 1,
        },
      ],
      totals: {
        subtotalHt: 136,
        discountAmountHt: 0,
        netAmountHt: 136,
        taxAmount: 7.48,
        totalTtc: 143.48,
      },
    });

    const content = buildTr1OrderPdf(input).toString("latin1");
    expect(content).not.toContain("UG offerte(s)");
    expect(content).not.toContain("100 %");
  });

  it("keeps long orders paginated while retaining the order reference", () => {
    const items = Array.from({ length: 18 }, (_, index) => ({
      reference: `REF-${String(index + 1).padStart(2, "0")}`,
      ean: null,
      designation: `Produit ${index + 1}`,
      quantity: 1,
      freeQuantity: 0,
      unitPriceHt: 10,
      discountRate: 0,
      netUnitPriceHt: 10,
      lineTotalHt: 10,
      taxRate: 5.5,
      unitsPerCase: 1,
    }));

    const content = buildTr1OrderPdf(sampleOrder({
      reference: "BDC-MULTIPAGE",
      items,
      totals: {
        subtotalHt: 180,
        discountAmountHt: 0,
        netAmountHt: 180,
        taxAmount: 9.9,
        totalTtc: 189.9,
      },
    })).toString("latin1");

    expect(content).toContain("BDC-MULTIPAGE");
    expect(content).toContain("page 1 / 2");
    expect(content).toContain("page 2 / 2");
  });
});
