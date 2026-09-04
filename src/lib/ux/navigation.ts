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
  { href: "/dashboard/missions", label: "Missions", icon: "calendar" },
  { href: "/dashboard/tasks", label: "Agenda", icon: "clipboard" },
  { href: "/dashboard/agent/performance", label: "Ma performance", icon: "chart" },
  { href: "/dashboard/reports", label: "Documents", icon: "file" },
  { href: "/dashboard/agent/assistant", label: "Assistant Terrain", icon: "sparkles" },
];

const managerItems: NavigationItem[] = [
  { href: "/dashboard", label: "Vue d’ensemble", shortLabel: "Accueil", icon: "layout" },
  { href: "/dashboard/commercial-health", label: "Priorités", icon: "target" },
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
  { href: "/dashboard/admin/design-system", label: "Configuration UI", icon: "activity" },
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

export function getNavigationSections(role: string, scope: NavigationScope = "tenant"): NavigationSection[] {
  const family = getRoleFamily(role);

  if (family === "agent") return [{ label: "Terrain", items: agentItems }];
  if (family === "facilitator") {
    return [{
      label: "Missions",
      items: [
        { href: "/dashboard/field", label: "Mes missions", shortLabel: "Accueil", icon: "route" },
        { href: "/dashboard/reports", label: "Mes rapports", icon: "file" },
      ],
    }];
  }

  if (scope === "platform") {
    return [{ label: "Plateforme TR1", items: platformAdminItems }];
  }

  const sections: NavigationSection[] = [{ label: "Pilotage", items: managerItems }];
  if (family === "admin") {
    sections.push({
      label: "Administration marque",
      items: tenantAdminItems,
    });
  }
  return sections;
}

export function getNavigationItems(role: string, scope: NavigationScope = "tenant") {
  return getNavigationSections(role, scope).flatMap((section) => section.items);
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
