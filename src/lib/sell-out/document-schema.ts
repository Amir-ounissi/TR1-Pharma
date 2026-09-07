import { z } from "zod";

const optionalText = z.string().trim().max(300).nullable();
const optionalAmount = z.number().finite().nonnegative().nullable();
const optionalConfidence = z.number().finite().min(0).max(1).nullable();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const sellOutDocumentExtractionSchema = z.object({
  periodStart: optionalDate,
  periodEnd: optionalDate,
  personalDataDetected: z.boolean(),
  lines: z.array(z.object({
    label: optionalText,
    sourceProductCode: optionalText,
    ean: optionalText,
    unitsSold: z.number().int().nonnegative().nullable(),
    revenueHt: optionalAmount,
    revenueTtc: optionalAmount,
    unitPriceTtc: optionalAmount,
    taxRate: z.number().finite().min(0).max(100).nullable(),
    confidence: optionalConfidence,
  })).max(150),
  totalUnits: z.number().int().nonnegative().nullable(),
  totalRevenueHt: optionalAmount,
  totalRevenueTtc: optionalAmount,
  confidence: optionalConfidence,
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
});

export type SellOutDocumentExtraction = z.infer<typeof sellOutDocumentExtractionSchema>;

export const SELL_OUT_DOCUMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "periodStart",
    "periodEnd",
    "personalDataDetected",
    "lines",
    "totalUnits",
    "totalRevenueHt",
    "totalRevenueTtc",
    "confidence",
    "warnings",
  ],
  properties: {
    periodStart: { type: ["string", "null"] },
    periodEnd: { type: ["string", "null"] },
    personalDataDetected: { type: "boolean" },
    lines: {
      type: "array",
      maxItems: 150,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "label",
          "sourceProductCode",
          "ean",
          "unitsSold",
          "revenueHt",
          "revenueTtc",
          "unitPriceTtc",
          "taxRate",
          "confidence",
        ],
        properties: {
          label: { type: ["string", "null"] },
          sourceProductCode: { type: ["string", "null"] },
          ean: { type: ["string", "null"] },
          unitsSold: { type: ["integer", "null"] },
          revenueHt: { type: ["number", "null"] },
          revenueTtc: { type: ["number", "null"] },
          unitPriceTtc: { type: ["number", "null"] },
          taxRate: { type: ["number", "null"] },
          confidence: { type: ["number", "null"] },
        },
      },
    },
    totalUnits: { type: ["integer", "null"] },
    totalRevenueHt: { type: ["number", "null"] },
    totalRevenueTtc: { type: ["number", "null"] },
    confidence: { type: ["number", "null"] },
    warnings: { type: "array", items: { type: "string" }, maxItems: 20 },
  },
} as const;

export function parseSellOutDocumentExtraction(value: unknown): SellOutDocumentExtraction {
  return sellOutDocumentExtractionSchema.parse(value);
}

export function sellOutExtractionHasPotentialPii(extraction: SellOutDocumentExtraction) {
  if (extraction.personalDataDetected) return true;
  const text = JSON.stringify(extraction).toLowerCase();
  return /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/.test(text)
    || /\b(patient|patiente|client|cliente|nom patient|nom client|fidélité|fidelite)\b/.test(text);
}
