import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getBrandContexts, getOptionalActiveBrand, isPlatformAdmin } from "@/lib/auth";
import { getNavigationItems, getRoleFamily } from "@/lib/ux/navigation";
import type { SearchItem } from "@/lib/ux/search";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, contexts, platformAdmin] = await Promise.all([getOptionalActiveBrand(), getBrandContexts(), isPlatformAdmin()]);

  if (!session.brand) {
    if (!platformAdmin) {
      redirect("/select-brand");
    }

    const globalNavigation: SearchItem[] = [
      { id: "navigation-dashboard", kind: "navigation", label: "Vue d’ensemble TR1", href: "/dashboard" },
      { id: "navigation-access-requests", kind: "navigation", label: "Demandes d’accès", href: "/dashboard/admin/access-requests" },
      { id: "navigation-users", kind: "navigation", label: "Utilisateurs & accès", href: "/dashboard/admin/users" },
      { id: "navigation-leads", kind: "navigation", label: "Leads TR1", href: "/dashboard/admin/leads" },
      { id: "navigation-onboarding", kind: "navigation", label: "Onboarding marques", href: "/dashboard/admin/onboarding" },
    ];

    return <AppShell brandHint="Vue active" brandName="TR1 global" role="super_admin" navigationScope="platform" searchItems={globalNavigation} userName={session.profile.full_name}>{children}</AppShell>;
  }

  const { brand, profile, supabase } = session;
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";

  const [pharmaciesResult, missionsResult, tasksResult] = await Promise.all([
    supabase.from("brand_pharmacies").select("id,pharmacies(trade_name,legal_name,city)").eq("brand_id", brand.id).is("archived_at", null).limit(12),
    supabase.from("missions").select("id,title,status").eq("brand_id", brand.id).is("archived_at", null).limit(12),
    supabase.from("tasks").select("id,title,status").eq("brand_id", brand.id).is("archived_at", null).limit(12),
  ]);

  const navigationItems: SearchItem[] = getNavigationItems(role).map((item) => ({
    id: `navigation-${item.href}`,
    kind: "navigation",
    label: item.label,
    href: item.href,
  }));
  const family = getRoleFamily(role);
  const canOperate = !["brand_user", "facilitator"].includes(role);
  const quickActions: SearchItem[] = !canOperate || family === "facilitator" ? [] : [
    { id: "action-new-order", kind: "action", label: "Créer une commande", href: "/dashboard/orders/new", keywords: ["nouvelle", "saisie"] },
    { id: "action-new-task", kind: "action", label: "Planifier une relance", href: "/dashboard/tasks", keywords: ["tâche", "rappel"] },
  ];
  const pharmacyItems: SearchItem[] = (pharmaciesResult.data ?? []).map((relation) => {
    const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
    return { id: `pharmacy-${relation.id}`, kind: "pharmacy", label: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie", description: pharmacy?.city ?? undefined, href: `/dashboard/pharmacies/${relation.id}` };
  });
  const missionItems: SearchItem[] = (missionsResult.data ?? []).map((mission) => ({ id: `mission-${mission.id}`, kind: "mission", label: mission.title, description: mission.status, href: `/dashboard/missions/${mission.id}` }));
  const taskItems: SearchItem[] = (tasksResult.data ?? []).map((task) => ({ id: `task-${task.id}`, kind: "task", label: task.title, description: task.status, href: "/dashboard/tasks" }));

  return <AppShell brandName={brand.name} role={role} searchItems={[...quickActions, ...navigationItems, ...pharmacyItems, ...missionItems, ...taskItems]} userName={profile.full_name}>{children}</AppShell>;
}
