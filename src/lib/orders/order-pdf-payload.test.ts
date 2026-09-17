import { describe, expect, it } from "vitest";
import { buildOrderPdfPayload, type BuildOrderPdfPayloadInput } from "./order-pdf-payload";

function buildValentineFixture(): BuildOrderPdfPayloadInput {
  return {
    order: {
      id: "order-valentine-155860",
      order_number: "155860",
      external_order_id: null,
      order_date: "2026-09-15",
      subtotal_ht: 884,
      discount_amount_ht: 0,
      net_amount_ht: 884,
      tax_amount: 48.62,
      total_ttc: 932.62,
      notes: null,
    },
    brand: {
      name: "VK Swiss",
      code: "VK",
      order_email: "commandes@example.test",
    },
    pharmacy: {
      legal_name: "Grande Pharmacie de la Valentine",
      trade_name: "Grande Pharmacie de la Valentine",
      cip_code: "132060567",
      siret: null,
      vat_number: null,
      email: null,
      phone: null,
      address_line_1: null,
      address_line_2: null,
      postal_code: "13011",
      city: "Marseille",
    },
    items: Array.from({ length: 6 }, (_, index) => ({
      product_id: `product-${index + 1}`,
      product_name_snapshot: `Produit VK ${index + 1}`,
      sku_snapshot: `VK-${index + 1}`,
      quantity: 8,
      free_quantity: 0,
      unit_price_ht: 18 + index,
      discount_rate: 0,
      net_unit_price_ht: 18 + index,
      line_total_ht: (18 + index) * 8,
      tax_rate: 5.5,
    })),
    products: [
      { id: "product-1", ean: "3760000000010", units_per_case: 6 },
      { id: "product-2", ean: "3760000000027", units_per_case: 12 },
    ],
    commercialEmail: "amir@example.test",
  };
}

describe("buildOrderPdfPayload", () => {
  it("préserve strictement les quantités, UG et totaux de la commande validée", () => {
    const input = buildValentineFixture();
    const payload = buildOrderPdfPayload(input);

    expect(payload.reference).toBe("155860");
    expect(payload.pharmacy.name).toBe("Grande Pharmacie de la Valentine");
    expect(payload.brandName).toBe("VK Swiss");
    expect(payload.items).toHaveLength(6);
    expect(payload.items.map((item) => item.quantity)).toEqual([8, 8, 8, 8, 8, 8]);
    expect(payload.items.map((item) => item.freeQuantity)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(payload.totals.subtotalHt).toBe(884);
    expect(payload.totals.netAmountHt).toBe(884);
    expect(payload.totals.taxAmount).toBe(48.62);
    expect(payload.totals.totalTtc).toBe(932.62);
  });

  it("utilise le catalogue uniquement pour enrichir EAN et PCB", () => {
    const input = buildValentineFixture();
    input.items[0] = {
      ...input.items[0],
      quantity: 8,
      free_quantity: 0,
      unit_price_ht: 21.75,
      discount_rate: 7.5,
      net_unit_price_ht: 20.11875,
      line_total_ht: 160.95,
    };

    const payload = buildOrderPdfPayload(input);
    const first = payload.items[0];

    expect(first.ean).toBe("3760000000010");
    expect(first.unitsPerCase).toBe(6);
    expect(first.quantity).toBe(8);
    expect(first.freeQuantity).toBe(0);
    expect(first.unitPriceHt).toBe(21.75);
    expect(first.discountRate).toBe(7.5);
    expect(first.netUnitPriceHt).toBe(20.11875);
    expect(first.lineTotalHt).toBe(160.95);
  });

  it("ne crée aucune donnée commerciale quand un produit n'est pas retrouvé dans le catalogue", () => {
    const input = buildValentineFixture();
    input.products = [];

    const payload = buildOrderPdfPayload(input);

    expect(payload.items[0].ean).toBeNull();
    expect(payload.items[0].unitsPerCase).toBeNull();
    expect(payload.items[0].quantity).toBe(8);
    expect(payload.items[0].freeQuantity).toBe(0);
  });
});
