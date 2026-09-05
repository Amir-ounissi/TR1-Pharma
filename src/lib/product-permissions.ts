const PRODUCT_ADMINISTRATION_ROLES = new Set([
  "brand_admin",
  "tr1_manager",
  "super_admin",
]);

export function canAdministerProducts(role: string | null | undefined) {
  return role != null && PRODUCT_ADMINISTRATION_ROLES.has(role);
}
