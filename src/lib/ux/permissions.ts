export function canAccessDesignSystem(role: string) {
  return role === "super_admin";
}

export const referenceAdministrationRoles = ["super_admin", "brand_admin", "tr1_manager"] as const;

export function canAccessReferenceAdministration(role: string) {
  return referenceAdministrationRoles.some((allowedRole) => allowedRole === role);
}

export function canUseManagerNavigation(role: string) {
  return ["super_admin", "brand_admin", "tr1_manager", "brand_user"].includes(role);
}

export function canUseAdministrationNavigation(role: string) {
  return role === "super_admin" || role === "brand_admin";
}
