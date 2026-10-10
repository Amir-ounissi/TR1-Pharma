import { redirect } from "next/navigation";
import { searchDashboardAction } from "@/app/(protected)/dashboard/actions";
import { AppShell } from "@/components/app-shell";
import { OfflineScopeRuntime } from "@/components/pwa/offline-scope-runtime";
import { getBrandContexts, getOptionalActiveBrand, isPlatformAdmin } from "@/lib/auth";
import { getActiveBrandSaasContext } from "@/lib/saas/server";
import { getNavigationItems, getRoleFamily } from "@/lib/ux/navigation";
import type { SearchItem } from "@/lib/ux/search";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, contexts] = await Promise.all([
    getOptionalActiveBrand(),
    getBrandContexts(),
  ]);
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");

  if (facilitatorOnly) {
    const navigationItems: SearchItem[] = getNavigationItems("facilitator").map((item) => ({
      id: `navigation-${item.href}`,
      kind: "navigation",
      label: item.label,
      href: item.href,
    }));
    return (
      <>
        <OfflineScopeRuntime userId={session.userId} brandId={null} />
        <AppShell
          brandHint="Espace terrain"
          brandName="Toutes mes marques"
          role="facilitator"
          searchItems={navigationItems}
          userName={session.profile.full_name}
        >
          {children}
        </AppShell>
      </>
    );
  }

  if (!session.brand) {
    const platformAdmin = await isPlatformAdmin();
    if (!platformAdmin) {
      redirect("/auth/activate-brand");
    }

    const globalNavigation: SearchItem[] = [
      { id: "navigation-dashboard", kind: "navigation", label: "Vue d’ensemble TR1", href: "/dashboard" },
      { id: "navigation-prestations", kind: "navigation", label: "Prestations commerciales", href: "/dashboard/admin/prestations" },
      { id: "navigation-access-requests", kind: "navigation", label: "Demandes d’accès", href: "/dashboard/admin/access-requests" },
      { id: "navigation-onboarding", kind: "navigation", label: "Marques & déploiements", href: "/dashboard/admin/onboarding" },
      { id: "navigation-saas", kind: "navigation", label: "Offres & capacités", href: "/dashboard/admin/saas" },
      { id: "navigation-users", kind: "navigation", label: "Utilisateurs & accès", href: "/dashboard/admin/users" },
      { id: "navigation-leads", kind: "navigation", label: "Leads TR1", href: "/dashboard/admin/leads" },
    ];

    return (
      <>
        <OfflineScopeRuntime userId={session.userId} brandId={null} />
        <AppShell
          brandHint="Vue active"
          brandName="TR1 global"
          role="super_admin"
          navigationScope="platform"
          searchItems={globalNavigation}
          userName={session.profile.full_name}
        >
          {children}
        </AppShell>
      </>
    );
  }

  const { brand, profile } = session;
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const family = getRoleFamily(role);
  const saas = await getActiveBrandSaasContext();
  const enabledCapabilities = [...saas.capabilities];
  const enabled = new Set(enabledCapabilities);

  const navigationItems: SearchItem[] = getNavigationItems(role, "tenant", enabledCapabilities).map((item) => ({
    id: `navigation-${item.href}`,
    kind: "navigation",
    label: item.label,
    href: item.href,
  }));
  const canOperate = !["brand_user", "facilitator", "brand_direction"].includes(role);
  const quickActions: SearchItem[] = !canOperate || family === "facilitator" || family === "direction" ? [] : [
    ...(enabled.has("orders") ? [{
      id: "action-new-order",
      kind: "action" as const,
      label: "Créer une commande",
      href: "/dashboard/orders/new",
      keywords: ["nouvelle", "saisie"],
    }] : []),
    ...(enabled.has("core_crm") ? [{
      id: "action-new-task",
      kind: "action" as const,
      label: "Planifier une relance",
      href: "/dashboard/tasks",
      keywords: ["tâche", "rappel"],
    }] : []),
  ];

  return (
    <>
      <OfflineScopeRuntime userId={session.userId} brandId={brand.id} />
      <AppShell
        brandName={brand.name}
        role={role}
        capabilities={enabledCapabilities}
        searchItems={[...quickActions, ...navigationItems]}
        searchAction={searchDashboardAction}
        userName={profile.full_name}
      >
        {children}
      </AppShell>
    </>
  );
}
