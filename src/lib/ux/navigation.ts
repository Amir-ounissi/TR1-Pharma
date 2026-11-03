import type { SaasCapability } from "@/lib/saas/capabilities";

export type RoleFamily = "agent" | "manager" | "admin" | "direction" | "facilitator";

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
  { href: "/dashboard/agent", label: "Mon cockpit", shortLabel: "Terrain", icon: "sun", capability: "agent_day" },
  { href: "/dashboard/agenda", label: "Agenda", icon: "calendar", capability: "core_crm" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building", capability: "core_crm" },
  { href: "/dashboard/orders", label: "Mes commandes", icon: "clipboard", capability: "orders" },
  { href: "/dashboard/missions", label: "Animations & formations", icon: "users", capability: "missions" },
  { href: "/dashboard/agent/assistant", label: "Assistant terrain", icon: "sparkles", capability: "assistant_terrain" },
  { href: "/dashboard/agent/performance", label: "Ma performance", shortLabel: "Performance", icon: "chart", capability: "performance" },
  { href: "/dashboard/agent/more", label: "Plus", icon: "menu" },
];

const agentMobileItems: NavigationItem[] = [
  { href: "/dashboard/agent", label: "Mon cockpit", shortLabel: "Terrain", icon: "sun", capability: "agent_day" },
  { href: "/dashboard/agenda", label: "Agenda", shortLabel: "Agenda", icon: "calendar", capability: "core_crm" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building", capability: "core_crm" },
  { href: "/dashboard/orders", label: "Mes commandes", shortLabel: "Commandes", icon: "clipboard", capability: "orders" },
  { href: "/dashboard/agent/more", label: "Plus", icon: "menu" },
];

const agentMoreItems: NavigationItem[] = [
  { href: "/dashboard/agent/performance", label: "Ma performance", shortLabel: "Performance", icon: "chart", capability: "performance" },
  { href: "/dashboard/products", label: "Produits", icon: "boxes", capability: "core_crm" },
  { href: "/dashboard/missions", label: "Missions", icon: "calendar", capability: "missions" },
  { href: "/dashboard/tasks", label: "Tâches", icon: "clipboard", capability: "core_crm" },
  { href: "/dashboard/sell-out", label: "Sell-out", icon: "chart", capability: "sell_out" },
  { href: "/dashboard/reports", label: "Mes comptes rendus", icon: "file", capability: "missions" },
  { href: "/dashboard/agent/assistant", label: "Assistant Terrain", icon: "sparkles", capability: "assistant_terrain" },
  { href: "/dashboard/agent/settings", label: "Paramètres", icon: "badge" },
];

const managerItems: NavigationItem[] = [
  { href: "/dashboard", label: "Synthèse", shortLabel: "Synthèse", icon: "layout" },
  { href: "/dashboard/pharmacies", label: "Réseau", shortLabel: "Réseau", icon: "building", capability: "core_crm" },
  { href: "/dashboard/orders", label: "Commandes", icon: "clipboard", capability: "orders" },
  { href: "/dashboard/missions", label: "Équipe & missions", shortLabel: "Missions", icon: "users", capability: "missions" },
  { href: "/dashboard/commercial-health", label: "Plan d’action", shortLabel: "Actions", icon: "target", capability: "next_best_action" },
  { href: "/dashboard/network/commercial", label: "Performance", shortLabel: "Performance", icon: "chart", capability: "performance" },
];

const directionItems: NavigationItem[] = [
  { href: "/dashboard/direction", label: "Vue Direction", shortLabel: "Direction", icon: "layout", capability: "direction_workspace" },
];

const tenantAdminItems: NavigationItem[] = [
  { href: "/dashboard/products", label: "Produits", icon: "boxes", capability: "core_crm" },
  { href: "/dashboard/groups", label: "Groupements", icon: "network", capability: "core_crm" },
  { href: "/dashboard/territories", label: "Territoires", icon: "map", capability: "core_crm" },
  { href: "/dashboard/imports", label: "Imports", icon: "upload", capability: "core_crm" },
  { href: "/dashboard/connectors", label: "Intégrations", icon: "network", capability: "connectors" },
  { href: "/dashboard/users", label: "Utilisateurs", icon: "users", capability: "core_crm" },
  { href: "/dashboard/subscription", label: "Abonnement & usage", icon: "badge" },
];

const facilitatorItems: NavigationItem[] = [
  { href: "/dashboard/field", label: "Terrain", shortLabel: "Terrain", icon: "sun", capability: "missions" },
  { href: "/dashboard/agenda", label: "Agenda", icon: "calendar", capability: "missions" },
  { href: "/dashboard/missions", label: "Missions", icon: "route", capability: "missions" },
  { href: "/dashboard/reports", label: "Rapports", icon: "file", capability: "missions" },
  { href: "/dashboard/account", label: "Plus", icon: "menu" },
];

const facilitatorMobileItems: NavigationItem[] = [
  { href: "/dashboard/field", label: "Terrain", shortLabel: "Terrain", icon: "sun", capability: "missions" },
  { href: "/dashboard/agenda", label: "Agenda", icon: "calendar", capability: "missions" },
  { href: "/dashboard/missions", label: "Missions", icon: "route", capability: "missions" },
  { href: "/dashboard/reports", label: "Rapports", icon: "file", capability: "missions" },
  { href: "/dashboard/account", label: "Plus", shortLabel: "Plus", icon: "menu" },
];

const platformAdminItems: NavigationItem[] = [
  { href: "/dashboard", label: "Pilotage TR1", shortLabel: "Accueil", icon: "layout" },
  { href: "/dashboard/admin/leads", label: "Demandes entrantes", icon: "leads" },
  { href: "/dashboard/admin/onboarding", label: "Marques partenaires", icon: "badge" },
  { href: "/dashboard/admin/users", label: "Accès partenaires", icon: "users" },
  { href: "/dashboard/admin/access-requests", label: "Demandes d’accès", icon: "users" },
];

// Le propriétaire pilote une agence commerciale multimarque, pas un SaaS.
// Les routes historiques restent disponibles aux administrateurs mais ne
// structurent plus l'expérience quotidienne.
const ownerItems: NavigationItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "layout" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building", capability: "core_crm" },
  { href: "/dashboard/orders", label: "Commandes", icon: "clipboard", capability: "orders" },
  { href: "/dashboard/missions", label: "Prestations", icon: "calendar", capability: "missions" },
  { href: "/dashboard/network/commercial", label: "Performance", icon: "chart", capability: "performance" },
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
  if (role === "brand_direction") return "direction";
  if (role === "super_admin" || role === "brand_admin") return "admin";
  return "manager";
}

export function getRoleLandingPath(role: string) {
  const family = getRoleFamily(role);
  if (family === "agent") return "/dashboard/agent";
  if (family === "facilitator") return "/dashboard/field";
  if (family === "direction") return "/dashboard/direction";
  return "/dashboard";
}

export function getNavigationSections(
  role: string,
  scope: NavigationScope = "tenant",
  enabledCapabilities?: readonly SaasCapability[],
): NavigationSection[] {
  const family = getRoleFamily(role);

  if (scope === "platform") {
    return compactSections([
      { label: "TR1 PHARMA", items: platformAdminItems.slice(0, 2) },
      { label: "Partenaires", items: platformAdminItems.slice(2) },
    ], enabledCapabilities);
  }

  if (role === "super_admin") {
    return compactSections([{ label: "Mon activité", items: ownerItems }], enabledCapabilities);
  }

  if (family === "agent") {
    return compactSections([{ label: "Terrain", items: agentItems }], enabledCapabilities);
  }

  if (family === "facilitator") {
    return compactSections([{ label: "Intervenant terrain", items: facilitatorItems }], enabledCapabilities);
  }

  if (family === "direction") {
    return compactSections([{ label: "Pilotage Direction", items: directionItems }], enabledCapabilities);
  }

  const sections: NavigationSection[] = [
    { label: "Pilotage", items: [managerItems[0], managerItems[1], managerItems[5]] },
    { label: "Exécution", items: [managerItems[2], managerItems[3], managerItems[4]] },
  ];

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
  return filterItems(agentMobileItems, enabledCapabilities);
}

export function getMobileFacilitatorNavigationItems(enabledCapabilities?: readonly SaasCapability[]) {
  return filterItems(facilitatorMobileItems, enabledCapabilities);
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
