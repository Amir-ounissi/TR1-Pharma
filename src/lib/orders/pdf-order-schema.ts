import { z } from "zod";

const optionalText = z.string().trim().max(500).nullable();
const optionalAmount = z.number().finite().nonnegative().nullable();

export const pdfOrderExtractionSchema = z.object({
  orderNumber: optionalText,
  orderDate: optionalText,
  orderDateSource: z.enum(["order_date", "header_date", "delivery_date", "other"]).nullable().optional(),
  deliveryDate: optionalText.optional(),
  pharmacy: z.object({
    name: optionalText,
    siret: optionalText,
    cip: optionalText,
    finess: optionalText,
    address: optionalText,
    postalCode: optionalText,
  }),
  lines: z.array(z.object({
    label: optionalText,
    sku: optionalText,
    ean: optionalText,
    quantity: z.number().finite().positive().nullable(),
    freeQuantity: z.number().int().nonnegative().nullable().optional(),
    unitPriceHt: optionalAmount,
    discountRate: z.number().finite().min(0).max(100).nullable(),
    taxRate: z.number().finite().min(0).max(100).nullable().optional(),
  })).max(100),
  totalHt: optionalAmount,
  totalVat: optionalAmount.optional(),
  totalTtc: optionalAmount,
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
});

export type PdfOrderExtraction = z.infer<typeof pdfOrderExtractionSchema>;
export type PdfOrderLine = PdfOrderExtraction["lines"][number];

export function isActionablePdfOrderLine(line: PdfOrderLine) {
  return (line.quantity ?? 0) > 0 || (line.freeQuantity ?? 0) > 0;
}

export const PDF_ORDER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["orderNumber", "orderDate", "orderDateSource", "deliveryDate", "pharmacy", "lines", "totalHt", "totalVat", "totalTtc", "warnings"],
  properties: {
    orderNumber: { type: ["string", "null"] },
    orderDate: { type: ["string", "null"] },
    orderDateSource: { type: ["string", "null"], enum: ["order_date", "header_date", "delivery_date", "other", null] },
    deliveryDate: { type: ["string", "null"] },
    pharmacy: {
      type: "object",
      additionalProperties: false,
      required: ["name", "siret", "cip", "finess", "address", "postalCode"],
      properties: {
        name: { type: ["string", "null"] },
        siret: { type: ["string", "null"] },
        cip: { type: ["string", "null"] },
        finess: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        postalCode: { type: ["string", "null"] },
      },
    },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "sku", "ean", "quantity", "freeQuantity", "unitPriceHt", "discountRate", "taxRate"],
        properties: {
          label: { type: ["string", "null"] },
          sku: { type: ["string", "null"] },
          ean: { type: ["string", "null"] },
          quantity: { type: ["number", "null"] },
          freeQuantity: { type: ["number", "null"] },
          unitPriceHt: { type: ["number", "null"] },
          discountRate: { type: ["number", "null"] },
          taxRate: { type: ["number", "null"] },
        },
      },
    },
    totalHt: { type: ["number", "null"] },
    totalVat: { type: ["number", "null"] },
    totalTtc: { type: ["number", "null"] },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

export function parsePdfOrderExtraction(value: unknown): PdfOrderExtraction {
  const parsed = pdfOrderExtractionSchema.parse(value);
  return {
    ...parsed,
    lines: parsed.lines.filter(isActionablePdfOrderLine),
  };
}
