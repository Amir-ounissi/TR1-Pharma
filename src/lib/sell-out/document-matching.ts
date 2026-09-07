import { matchPdfProduct, type ProductCandidate } from "@/lib/orders/pdf-order-matching";
import type { SellOutDocumentExtraction } from "@/lib/sell-out/document-schema";

export type SellOutMatchedLine = {
  index: number;
  label: string | null;
  sourceProductCode: string | null;
  ean: string | null;
  unitsSold: number | null;
  revenueHt: number | null;
  revenueTtc: number | null;
  revenueHtSource: "document" | "derived_from_ttc" | null;
  taxRate: number | null;
  confidence: number | null;
  warning: string | null;
  product: {
    status: "matched" | "unmatched" | "ambiguous";
    method: string | null;
    selectedId: string | null;
    selectedName: string | null;
    candidates: Array<{
      id: string;
      name: string;
      sku: string | null;
      ean: string | null;
      taxRate: number | null;
    }>;
  };
};

function money(value: number) {
  return Number(value.toFixed(2));
}

function deriveRevenueHt(
  line: SellOutDocumentExtraction["lines"][number],
  product: ProductCandidate | null,
) {
  if (line.revenueHt != null) {
    return { revenueHt: money(line.revenueHt), revenueHtSource: "document" as const, taxRate: line.taxRate, warning: null };
  }

  const revenueTtc = line.revenueTtc
    ?? (line.unitsSold != null && line.unitPriceTtc != null ? line.unitsSold * line.unitPriceTtc : null);
  const taxRate = line.taxRate ?? product?.taxRate ?? null;
  if (revenueTtc == null) {
    return { revenueHt: null, revenueHtSource: null, taxRate, warning: "CA absent sur cette ligne." };
  }
  if (taxRate == null) {
    return { revenueHt: null, revenueHtSource: null, taxRate: null, warning: "CA TTC lisible mais TVA inconnue : CA HT à confirmer." };
  }
  return {
    revenueHt: money(revenueTtc / (1 + taxRate / 100)),
    revenueHtSource: "derived_from_ttc" as const,
    taxRate,
    warning: line.taxRate == null ? "CA HT calculé depuis le TTC avec la TVA catalogue." : "CA HT calculé depuis le TTC avec la TVA du document.",
  };
}

export function matchSellOutDocument(
  extraction: SellOutDocumentExtraction,
  products: ProductCandidate[],
): SellOutMatchedLine[] {
  return extraction.lines.map((line, index) => {
    const match = matchPdfProduct({
      label: line.label,
      sku: line.sourceProductCode,
      ean: line.ean,
      quantity: line.unitsSold != null && line.unitsSold > 0 ? line.unitsSold : null,
      freeQuantity: null,
      unitPriceHt: null,
      discountRate: null,
      taxRate: line.taxRate,
    }, products);
    const revenue = deriveRevenueHt(line, match.match);
    const warnings = [
      line.unitsSold == null ? "Quantité vendue à confirmer." : null,
      revenue.warning,
      match.status === "unmatched" ? "Produit non rapproché du catalogue TR1." : null,
      match.status === "ambiguous" ? "Plusieurs produits TR1 possibles." : null,
    ].filter(Boolean);

    return {
      index,
      label: line.label,
      sourceProductCode: line.sourceProductCode,
      ean: line.ean,
      unitsSold: line.unitsSold,
      revenueHt: revenue.revenueHt,
      revenueTtc: line.revenueTtc ?? (line.unitsSold != null && line.unitPriceTtc != null ? money(line.unitsSold * line.unitPriceTtc) : null),
      revenueHtSource: revenue.revenueHtSource,
      taxRate: revenue.taxRate,
      confidence: line.confidence,
      warning: warnings.length ? warnings.join(" ") : null,
      product: {
        status: match.status,
        method: match.method,
        selectedId: match.match?.id ?? null,
        selectedName: match.match?.name ?? null,
        candidates: match.candidates.slice(0, 5).map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          sku: candidate.sku,
          ean: candidate.ean,
          taxRate: candidate.taxRate,
        })),
      },
    };
  });
}
