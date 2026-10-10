/**
 * The agenda RPC can return field visits owned by a user even after a brand
 * membership has been revoked. Keep only visits whose every brand is still
 * authorized for the agent. Fail closed for missing brand arrays.
 *
 * We intentionally do not display a partial multi-brand visit because the
 * source's brand names and brand IDs may not be in the same order.
 */
export function authorizedAgentVisit<T extends { brand_ids: string[] | null; source_kind: string }>(
  event: T,
  allowedBrandIds: ReadonlySet<string>,
): boolean {
  if (event.source_kind !== "field_visit") return false;
  const brandIds = event.brand_ids;
  return Array.isArray(brandIds)
    && brandIds.length > 0
    && brandIds.every((id) => allowedBrandIds.has(id));
}
