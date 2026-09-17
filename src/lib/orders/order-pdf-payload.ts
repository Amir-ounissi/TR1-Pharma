import type { Tr1OrderPdfData } from "./order-email";

type NumericValue = number | string | null;

type OrderPdfOrder = {
  id: string;
  order_number: string | null;
  external_order_id: string | null;
  order_date: string;
  subtotal_ht: NumericValue;
  discount_amount_ht: NumericValue;
  net_amount_ht: NumericValue;
  tax_amount: NumericValue;
  total_ttc: NumericValue;
  notes: string | null;
};

type OrderPdfBrand = {
  name: string;
  code: string | null;
  order_email: string | null;
};

type OrderPdfPharmacy = {
  legal_name: string | null;
  trade_name: string | null;
  cip_code: string | null;
  siret: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  city: string | null;
};

type OrderPdfItem = {
  product_id: string | null;
  product_name_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number;
  free_quantity: number | null;
  unit_price_ht: NumericValue;
  discount_rate: NumericValue;
  net_unit_price_ht: NumericValue;
  line_total_ht: NumericValue;
  tax_rate: NumericValue;
};

type OrderPdfProduct = {
  id: string;
  ean: string | null;
  units_per_case: number | null;
};

export type BuildOrderPdfPayloadInput = {
  order: OrderPdfOrder;
  brand: OrderPdfBrand;
  pharmacy: OrderPdfPharmacy;
  items: OrderPdfItem[];
  products: OrderPdfProduct[];
  commercialEmail?: string | null;
};

export function buildOrderPdfPayload(input: BuildOrderPdfPayloadInput): Tr1OrderPdfData {
  const { order, brand, pharmacy, items, products } = input;
  const productById = new Map(products.map((product) => [product.id, product]));
  const pharmacyName = pharmacy.trade_name || pharmacy.legal_name || "Pharmacie";

  return {
    reference: order.order_number || order.external_order_id || order.id.slice(0, 8),
    orderDate: order.order_date,
    brandName: brand.name,
    brandCode: brand.code,
    brandOrderEmail: brand.order_email,
    commercialEmail: input.commercialEmail ?? null,
    pharmacy: {
      name: pharmacyName,
      legalName: pharmacy.legal_name,
      code: pharmacy.cip_code,
      addressLine1: pharmacy.address_line_1,
      addressLine2: pharmacy.address_line_2,
      postalCode: pharmacy.postal_code,
      city: pharmacy.city,
      email: pharmacy.email,
      phone: pharmacy.phone,
      siret: pharmacy.siret,
      vatNumber: pharmacy.vat_number,
    },
    items: items.map((item) => {
      const product = item.product_id ? productById.get(item.product_id) : undefined;
      return {
        reference: item.sku_snapshot,
        ean: product?.ean ?? null,
        designation: item.product_name_snapshot,
        quantity: item.quantity,
        freeQuantity: item.free_quantity,
        unitPriceHt: item.unit_price_ht,
        discountRate: item.discount_rate,
        netUnitPriceHt: item.net_unit_price_ht,
        lineTotalHt: item.line_total_ht,
        taxRate: item.tax_rate,
        unitsPerCase: product?.units_per_case ?? null,
      };
    }),
    totals: {
      subtotalHt: order.subtotal_ht,
      discountAmountHt: order.discount_amount_ht,
      netAmountHt: order.net_amount_ht,
      taxAmount: order.tax_amount,
      totalTtc: order.total_ttc,
    },
    notes: order.notes,
  };
}
