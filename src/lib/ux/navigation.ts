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

const agentItems: NavigationItem[] = [
  { href: "/dashboard/agent", label: "Ma journée", shortLabel: "Accueil", icon: "sun" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building" },
  { href: "/dashboard/missions", label: "Missions", icon: "calendar" },
  { href: "/dashboard/tasks", label: "Agenda", icon: "clipboard" },
  { href: "/dashboard/reports", label: "Documents", icon: "file" },
  { href: "/dashboard/agent/assistant", label: "Assistant Terrain", icon: "sparkles" },
];

const managerItems: NavigationItem[] = [
  { href: "/dashboard", label: "Vue d’ensemble", shortLabel: "Accueil", icon: "layout" },
  { href: "/dashboard/commercial-health", label: "Priorités", icon: "target" },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: "building" },
  { href: "/dashboard/missions", label: "Missions", icon: "calendar" },
  { href: "/dashboard/network", label: "Performance", icon: "chart" },
  { href: "/dashboard/users", label: "Équipe", icon: "users" },
];

const adminItems: NavigationItem[] = [
  { href: "/dashboard/products", label: "Produits", icon: "boxes" },
  { href: "/dashboard/groups", label: "Groupements", icon: "network" },
  { href: "/dashboard/territories", label: "Territoires", icon: "map" },
  { href: "/dashboard/imports", label: "Imports", icon: "upload" },
  { href: "/dashboard/users", label: "Utilisateurs", icon: "users" },
  { href: "/dashboard/admin/design-system", label: "Configuration UI", icon: "activity" },
  { href: "/dashboard/admin/onboarding", label: "Onboarding marques", icon: "badge" },
];

export function getRoleFamily(role: string): RoleFamily {
  if (role === "agent") return "agent";
  if (role === "facilitator") return "facilitator";
  if (role === "super_admin" || role === "brand_admin") return "admin";
  return "manager";
}

export function getNavigationSections(role: string): NavigationSection[] {
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

  const sections: NavigationSection[] = [{ label: "Pilotage", items: managerItems }];
  if (family === "admin") sections.push({ label: "Administration", items: adminItems });
  return sections;
}

export function getNavigationItems(role: string) {
  return getNavigationSections(role).flatMap((section) => section.items);
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
