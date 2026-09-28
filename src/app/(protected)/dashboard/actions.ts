"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BRAND_COOKIE, getBrandContexts, isPlatformAdmin, requireActiveBrand, requireUser } from "@/lib/auth";
import { presentationLabel, presentationText } from "@/lib/presentation";
import { getRoleFamily } from "@/lib/ux/navigation";
import type { SearchItem } from "@/lib/ux/search";

export async function signOutAction() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  // Keep the non-sensitive active-brand preference so the next login can
  // reopen the last workspace without a forced context-selection step.
  redirect("/login");
}

export async function changeBrandAction() {
  redirect("/dashboard/account");
}

export async function returnToPlatformAdministrationAction() {
  if (!(await isPlatformAdmin())) {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BRAND_COOKIE);
  redirect("/dashboard");
}


export async function searchDashboardAction(rawQuery: string): Promise<SearchItem[]> {
  const query = rawQuery.trim().replace(/[%_]/g, "").slice(0, 80);
  if (query.length < 2) return [];

  const [{ supabase, brand }, contexts] = await Promise.all([
    requireActiveBrand(),
    getBrandContexts(),
  ]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const family = getRoleFamily(role);
  if (family === "direction") return [];

  const pattern = `%${query}%`;
  const [pharmaciesResult, missionsResult, tasksResult] = await Promise.all([
    supabase
      .from("brand_pharmacy_directory")
      .select("id,trade_name,legal_name,city")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .ilike("search_text", pattern)
      .limit(6),
    supabase
      .from("missions")
      .select("id,title,status")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .ilike("title", pattern)
      .limit(4),
    supabase
      .from("tasks")
      .select("id,title,status")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .ilike("title", pattern)
      .limit(4),
  ]);

  const pharmacyItems: SearchItem[] = (pharmaciesResult.data ?? []).map((row) => ({
    id: `pharmacy-${row.id}`,
    kind: "pharmacy",
    label: row.trade_name || row.legal_name || "Pharmacie",
    description: row.city ?? undefined,
    href: `/dashboard/pharmacies/${row.id}`,
  }));
  const missionItems: SearchItem[] = (missionsResult.data ?? []).map((mission) => ({
    id: `mission-${mission.id}`,
    kind: "mission",
    label: presentationText(mission.title),
    description: presentationLabel(mission.status),
    href: `/dashboard/missions/${mission.id}`,
  }));
  const taskItems: SearchItem[] = (tasksResult.data ?? []).map((task) => ({
    id: `task-${task.id}`,
    kind: "task",
    label: presentationText(task.title),
    description: presentationLabel(task.status),
    href: "/dashboard/tasks",
  }));

  return [...pharmacyItems, ...missionItems, ...taskItems];
}
