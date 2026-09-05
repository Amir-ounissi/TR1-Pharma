import type { SaasCapability } from "@/lib/saas/capabilities";

export type RoleFamily = "agent" | "manager" | "admin" | "facilitator";

export type NavigationItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: string;
  capability?: SaasCapability;
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export type NavigationScope = "tenant" | "platform";

const agentItems: NavigationItem[] = [
  { href: "/dashboard/agent", label: "Ma journée", shortLabel: "Accueil", icon: "sun", capability: "agent_day" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building", capability: "core_crm" },
  { href: "/dashboard/orders", label: "Mes commandes", icon: "clipboard", capability: "orders" },
  { href: "/dashboard/agenda", label: "Agenda", icon: "calendar", capability: "core_crm" },
  { href: "/dashboard/agent/more", label: "Plus", icon: "menu" },
];

const agentMoreItems: NavigationItem[] = [
  { href: "/dashboard/products", label: "Produits", icon: "boxes", capability: "core_crm" },
  { href: "/dashboard/missions", label: "Missions", icon: "calendar", capability: "missions" },
  { href: "/dashboard/tasks", label: "Tâches", icon: "clipboard", capability: "core_crm" },
  { href: "/dashboard/agent/performance", label: "Ma performance", icon: "chart", capability: "performance" },
  { href: "/dashboard/reports", label: "Mes comptes rendus", icon: "file", capability: "missions" },
  { href: "/dashboard/agent/assistant", label: "Assistant Terrain", icon: "sparkles", capability: "assistant_terrain" },
];

const managerItems: NavigationItem[] = [
  { href: "/dashboard/executive", label: "Cockpit Direction", shortLabel: "Cockpit", icon: "layout", capability: "executive_cockpit" },
  { href: "/dashboard/kam-groups", label: "KAM Groupements", shortLabel: "Groupements", icon: "network", capability: "kam_groups" },
  { href: "/dashboard/trade", label: "Trade Marketing", shortLabel: "Trade", icon: "target", capability: "trade_marketing" },
  { href: "/dashboard/commercial-health", label: "Priorités", shortLabel: "Priorités", icon: "target", capability: "next_best_action" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building", capability: "core_crm" },
  { href: "/dashboard/orders", label: "Commandes", icon: "clipboard", capability: "orders" },
  { href: "/dashboard/missions", label: "Missions", icon: "calendar", capability: "missions" },
  { href: "/dashboard/network", label: "Performance", icon: "chart", capability: "performance" },
];

const tenantAdminItems: NavigationItem[] = [
  { href: "/dashboard/products", label: "Produits", icon: "boxes", capability: "core_crm" },
  { href: "/dashboard/groups", label: "Groupements", icon: "network", capability: "core_crm" },
  { href: "/dashboard/territories", label: "Territoires", icon: "map", capability: "core_crm" },
  { href: "/dashboard/imports", label: "Imports", icon: "upload", capability: "core_crm" },
  { href: "/dashboard/users", label: "Utilisateurs", icon: "users", capability: "core_crm" },
];

const facilitatorItems: NavigationItem[] = [
  { href: "/dashboard/field", label: "Aujourd’hui", shortLabel: "Aujourd’hui", icon: "sun", capability: "missions" },
  { href: "/dashboard/missions", label: "Mes missions", icon: "route", capability: "missions" },
  { href: "/dashboard/agenda", label: "Agenda", icon: "calendar", capability: "missions" },
  { href: "/dashboard/reports", label: "Mes rapports", icon: "file", capability: "missions" },
];

const platformAdminItems: NavigationItem[] = [
  { href: "/dashboard", label: "Vue globale", shortLabel: "Accueil", icon: "layout" },
  { href: "/dashboard/admin/access-requests", label: "Demandes d’accès", icon: "users" },
  { href: "/dashboard/admin/onboarding", label: "Marques & onboardings", icon: "badge" },
  { href: "/dashboard/admin/saas", label: "SaaS & capacités", icon: "boxes" },
  { href: "/dashboard/admin/users", label: "Utilisateurs & accès", icon: "users" },
  { href: "/dashboard/admin/leads", label: "Leads TR1", icon: "leads" },
];

function filterItems(items: NavigationItem[], enabledCapabilities?: readonly SaasCapability[]) {
  if (!enabledCapabilities) return items;
  const enabled = new Set(enabledCapabilities);
  return items.filter((item) => !item.capability || enabled.has(item.capability));
}

function compactSections(sections: NavigationSection[], enabledCapabilities?: readonly SaasCapability[]) {
  return sections
    .map((section) => ({ ...section, items: filterItems(section.items, enabledCapabilities) }))
    .filter((section) => section.items.length > 0);
}

export function getRoleFamily(role: string): RoleFamily {
  if (role === "agent") return "agent";
  if (role === "facilitator") return "facilitator";
  if (role === "super_admin" || role === "brand_admin") return "admin";
  return "manager";
}

export function getRoleLandingPath(role: string) {
  const family = getRoleFamily(role);
  if (family === "agent") return "/dashboard/agent";
  if (family === "facilitator") return "/dashboard/field";
  return "/dashboard";
}

export function getNavigationSections(
  role: string,
  scope: NavigationScope = "tenant",
  enabledCapabilities?: readonly SaasCapability[],
): NavigationSection[] {
  const family = getRoleFamily(role);

  if (scope === "platform") {
    return [{ label: "Plateforme TR1", items: platformAdminItems }];
  }

  if (family === "agent") {
    return compactSections([{ label: "Terrain", items: agentItems }], enabledCapabilities);
  }

  if (family === "facilitator") {
    return compactSections([{ label: "Intervenant terrain", items: facilitatorItems }], enabledCapabilities);
  }

  const sections: NavigationSection[] = [
    { label: "Pilotage", items: managerItems },
  ];

  const validationItems: NavigationItem[] = [];
  if (["brand_admin", "tr1_manager", "super_admin"].includes(role)) validationItems.push({ href: "/dashboard/missions/proposals", label: "Propositions à valider", icon: "target", capability: "missions" });
  if (role === "tr1_manager" || role === "super_admin") validationItems.push({ href: "/dashboard/reports", label: "Rapports à valider", icon: "file", capability: "missions" });
  if (validationItems.length) sections.push({ label: "Validation", items: validationItems });

  if (family === "admin") {
    sections.push({
      label: "Paramètres",
      items: tenantAdminItems,
    });
  }

  return compactSections(sections, enabledCapabilities);
}

export function getAgentMoreItems(enabledCapabilities?: readonly SaasCapability[]) {
  return filterItems(agentMoreItems, enabledCapabilities);
}

export function getMobileAgentNavigationItems(enabledCapabilities?: readonly SaasCapability[]) {
  return filterItems(agentItems, enabledCapabilities);
}

export function getNavigationItems(
  role: string,
  scope: NavigationScope = "tenant",
  enabledCapabilities?: readonly SaasCapability[],
) {
  return getNavigationSections(role, scope, enabledCapabilities).flatMap((section) => section.items);
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
