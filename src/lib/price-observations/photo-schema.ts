import { z } from "zod";

const optionalText = z.string().trim().max(300).nullable();
const optionalAmount = z.number().finite().positive().max(10000).nullable();
const optionalConfidence = z.number().finite().min(0).max(1).nullable();

export const pricePhotoExtractionSchema = z.object({
  personalDataDetected: z.boolean(),
  productLabel: optionalText,
  ean: optionalText,
  priceTtc: optionalAmount,
  priceType: z.enum(["regular", "promotion", "bundle", "other"]).nullable(),
  bundleQuantity: z.number().int().min(2).max(100).nullable(),
  confidence: optionalConfidence,
  warnings: z.array(z.string().trim().min(1).max(300)).max(10),
}).superRefine((value, ctx) => {
  if (value.priceType === "bundle" && value.bundleQuantity == null) {
    ctx.addIssue({ code: "custom", message: "Un lot doit inclure sa quantité.", path: ["bundleQuantity"] });
  }
});

export type PricePhotoExtraction = z.infer<typeof pricePhotoExtractionSchema>;

export const PRICE_PHOTO_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "personalDataDetected",
    "productLabel",
    "ean",
    "priceTtc",
    "priceType",
    "bundleQuantity",
    "confidence",
    "warnings",
  ],
  properties: {
    personalDataDetected: { type: "boolean" },
    productLabel: { type: ["string", "null"] },
    ean: { type: ["string", "null"] },
    priceTtc: { type: ["number", "null"] },
    priceType: { type: ["string", "null"], enum: ["regular", "promotion", "bundle", "other", null] },
    bundleQuantity: { type: ["integer", "null"] },
    confidence: { type: ["number", "null"] },
    warnings: { type: "array", maxItems: 10, items: { type: "string" } },
  },
} as const;

export function parsePricePhotoExtraction(value: unknown) {
  return pricePhotoExtractionSchema.parse(value);
}
