import { matchPdfProduct, type ProductCandidate } from "@/lib/orders/pdf-order-matching";
import type { PricePhotoExtraction } from "@/lib/price-observations/photo-schema";

export type PricePhotoProductMatch = {
  status: "matched" | "unmatched" | "ambiguous";
  method: string | null;
  selectedId: string | null;
  candidates: Array<{
    id: string;
    name: string;
    sku: string | null;
    ean: string | null;
  }>;
};

export function matchPricePhotoProduct(
  extraction: PricePhotoExtraction,
  products: ProductCandidate[],
): PricePhotoProductMatch {
  const result = matchPdfProduct({
    label: extraction.productLabel,
    sku: null,
    ean: extraction.ean,
    quantity: 1,
    freeQuantity: null,
    unitPriceHt: null,
    discountRate: null,
    taxRate: null,
  }, products);

  return {
    status: result.status,
    method: result.method,
    selectedId: result.status === "matched" ? result.match?.id ?? null : null,
    candidates: result.candidates.slice(0, 8).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      sku: candidate.sku,
      ean: candidate.ean,
    })),
  };
}
