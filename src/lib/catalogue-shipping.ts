/**
 * Franco de port des marques coréennes TR1 PHARMA.
 * Le seuil est calculé sur le montant HT des produits APRÈS paliers/remises.
 * Les frais de port sous le seuil ne sont pas contractualisés.
 */
export const KOREAN_FRANCO = {
  brandSlugs: ["biodance", "beauty-of-joseon", "dr-althea"] as const,
  thresholdCents: 25_000,
} as const;

export function isKoreanFrancoBrand(slug: string): boolean {
  return (KOREAN_FRANCO.brandSlugs as readonly string[]).includes(slug);
}

export type ShippingPriceLine = {
  brandSlug: string;
  quantity: number;
  unitPriceMinCents: number | null;
  unitPriceMaxCents: number | null;
};

export type KoreanFrancoProgress = {
  productCount: number;
  brands: string[];
  totalMinCents: number;
  totalMaxCents: number;
  hasUnpricedLines: boolean;
  /** Statut sur prix calcules (qui peuvent rester indicatifs). */
  status: "empty" | "reached" | "below" | "uncertain";
  missingMinCents: number | null;
  missingMaxCents: number | null;
};

export function koreanFrancoProgress(lines: readonly ShippingPriceLine[]): KoreanFrancoProgress {
  let totalMinCents = 0;
  let totalMaxCents = 0;
  let productCount = 0;
  let hasUnpricedLines = false;
  const brands = new Set<string>();
  for (const line of lines) {
    if (!isKoreanFrancoBrand(line.brandSlug) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) continue;
    productCount++;
    brands.add(line.brandSlug);
    if (line.unitPriceMinCents === null || line.unitPriceMaxCents === null ||
      !Number.isSafeInteger(line.unitPriceMinCents) || !Number.isSafeInteger(line.unitPriceMaxCents) ||
      line.unitPriceMinCents < 0 || line.unitPriceMaxCents < line.unitPriceMinCents) {
      hasUnpricedLines = true;
      continue;
    }
    totalMinCents += line.unitPriceMinCents * line.quantity;
    totalMaxCents += line.unitPriceMaxCents * line.quantity;
  }
  const threshold = KOREAN_FRANCO.thresholdCents;
  const status = productCount === 0 ? "empty"
    : totalMinCents >= threshold ? "reached"
    : hasUnpricedLines || totalMaxCents >= threshold ? "uncertain"
    : "below";

  return {
    productCount,
    brands: [...brands],
    totalMinCents,
    totalMaxCents,
    hasUnpricedLines,
    status,
    missingMinCents: status === "below" ? Math.max(0, threshold - totalMaxCents) : null,
    missingMaxCents: status === "below" ? Math.max(0, threshold - totalMinCents) : null,
  };
}
