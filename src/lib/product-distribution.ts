export type ProductPresenceRow = {
  product_id: string;
  brand_pharmacy_id: string;
  order_presence: boolean;
  status: string;
  manually_confirmed_present: boolean;
  removed_at: string | null;
};

const PRESENT_STATUSES = new Set([
  "implanted",
  "active",
  "temporarily_unavailable",
]);

export function isProductPresent(row: ProductPresenceRow) {
  return row.removed_at === null && (
    row.order_presence ||
    row.manually_confirmed_present ||
    PRESENT_STATUSES.has(row.status)
  );
}

export function countProductPresence(rows: ProductPresenceRow[]) {
  const pharmacyIdsByProduct = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!isProductPresent(row)) continue;

    const pharmacyIds = pharmacyIdsByProduct.get(row.product_id) ?? new Set<string>();
    pharmacyIds.add(row.brand_pharmacy_id);
    pharmacyIdsByProduct.set(row.product_id, pharmacyIds);
  }

  return new Map(
    [...pharmacyIdsByProduct].map(([productId, pharmacyIds]) => [
      productId,
      pharmacyIds.size,
    ]),
  );
}

export function productDistributionPercent(presentCount: number, portfolioCount: number) {
  if (portfolioCount === 0) return null;
  return Math.round((presentCount * 1000) / portfolioCount) / 10;
}
