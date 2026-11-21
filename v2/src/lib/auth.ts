import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type UserRole = "owner" | "pharmacy";

export async function getViewer() {
  const db = await createServerSupabase();
  if (!db) return null;
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return null;
  const { data: profile, error } = await db
    .from("profiles").select("role,display_name").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Impossible de charger votre profil.");
  return profile && (profile.role === "owner" || profile.role === "pharmacy")
    ? { db, user, role: profile.role as UserRole, name: profile.display_name as string | null }
    : null;
}
export async function requireOwner() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "owner") redirect("/app/connexion");
  return viewer;
}
export async function requirePharmacy() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "pharmacy") redirect("/catalogue/connexion");
  return viewer;
}
