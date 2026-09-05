export type RoleFamily = "agent" | "manager" | "admin" | "facilitator";

export type NavigationItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: string;
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export type NavigationScope = "tenant" | "platform";

const agentItems: NavigationItem[] = [
  { href: "/dashboard/agent", label: "Ma journée", shortLabel: "Accueil", icon: "sun" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building" },
  { href: "/dashboard/orders", label: "Mes commandes", icon: "clipboard" },
  { href: "/dashboard/agenda", label: "Agenda", icon: "calendar" },
  { href: "/dashboard/agent/more", label: "Plus", icon: "menu" },
];

const agentMoreItems: NavigationItem[] = [
  { href: "/dashboard/products", label: "Produits", icon: "boxes" },
  { href: "/dashboard/missions", label: "Missions", icon: "calendar" },
  { href: "/dashboard/tasks", label: "Tâches", icon: "clipboard" },
  { href: "/dashboard/agent/performance", label: "Ma performance", icon: "chart" },
  { href: "/dashboard/reports", label: "Mes comptes rendus", icon: "file" },
  { href: "/dashboard/agent/assistant", label: "Assistant Terrain", icon: "sparkles" },
];

const managerItems: NavigationItem[] = [
  { href: "/dashboard/commercial-health", label: "Priorités", shortLabel: "Priorités", icon: "target" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building" },
  { href: "/dashboard/orders", label: "Commandes", icon: "clipboard" },
  { href: "/dashboard/missions", label: "Missions", icon: "calendar" },
  { href: "/dashboard/network", label: "Performance", icon: "chart" },
];

const tenantAdminItems: NavigationItem[] = [
  { href: "/dashboard/products", label: "Produits", icon: "boxes" },
  { href: "/dashboard/groups", label: "Groupements", icon: "network" },
  { href: "/dashboard/territories", label: "Territoires", icon: "map" },
  { href: "/dashboard/imports", label: "Imports", icon: "upload" },
  { href: "/dashboard/users", label: "Utilisateurs", icon: "users" },
];

const platformAdminItems: NavigationItem[] = [
  { href: "/dashboard", label: "Vue globale", shortLabel: "Accueil", icon: "layout" },
  { href: "/dashboard/admin/access-requests", label: "Demandes d’accès", icon: "users" },
  { href: "/dashboard/admin/onboarding", label: "Marques & onboardings", icon: "badge" },
  { href: "/dashboard/admin/users", label: "Utilisateurs & accès", icon: "users" },
  { href: "/dashboard/admin/leads", label: "Leads TR1", icon: "leads" },
];

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
): NavigationSection[] {
  const family = getRoleFamily(role);

  if (family === "agent") {
    return [{ label: "Terrain", items: agentItems }];
  }

  if (family === "facilitator") {
    return [{
      label: "Intervenant terrain",
      items: [
        { href: "/dashboard/field", label: "Aujourd’hui", shortLabel: "Aujourd’hui", icon: "sun" },
        { href: "/dashboard/missions", label: "Mes missions", icon: "route" },
        { href: "/dashboard/agenda", label: "Agenda", icon: "calendar" },
        { href: "/dashboard/reports", label: "Mes rapports", icon: "file" },
      ],
    }];
  }

  if (scope === "platform") {
    return [{ label: "Plateforme TR1", items: platformAdminItems }];
  }

  const sections: NavigationSection[] = [
    { label: "Pilotage", items: managerItems },
  ];

  const validationItems: NavigationItem[] = [];
  if (["brand_admin", "tr1_manager", "super_admin"].includes(role)) validationItems.push({ href: "/dashboard/missions/proposals", label: "Propositions à valider", icon: "target" });
  if (role === "tr1_manager" || role === "super_admin") validationItems.push({ href: "/dashboard/reports", label: "Rapports à valider", icon: "file" });
  if (validationItems.length) sections.push({ label: "Validation", items: validationItems });

  if (family === "admin") {
    sections.push({
      label: "Paramètres",
      items: tenantAdminItems,
    });
  }

  return sections;
}

export function getAgentMoreItems() {
  return agentMoreItems;
}

export function getMobileAgentNavigationItems() {
  return agentItems.filter((item) => item.href !== "/dashboard/agent/more");
}

export function getNavigationItems(
  role: string,
  scope: NavigationScope = "tenant",
) {
  return getNavigationSections(role, scope).flatMap((section) => section.items);
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
