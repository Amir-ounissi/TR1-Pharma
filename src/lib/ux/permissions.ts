export function canAccessDesignSystem(role: string, environment = process.env.NODE_ENV) {
  return environment === "development" || role === "super_admin" || role === "brand_admin";
}

export function canUseManagerNavigation(role: string) {
  return ["super_admin", "brand_admin", "tr1_manager", "brand_user"].includes(role);
}

export function canUseAdministrationNavigation(role: string) {
  return role === "super_admin" || role === "brand_admin";
}
