"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export type LoginState = { error?: string };
export async function signInAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.object({
    email: z.email(),
    password: z.string().min(1),
  }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Email et mot de passe requis." };

  const db = await createServerSupabase();
  if (!db) return { error: "La connexion V2 n'est pas encore configurée." };
  const { data, error } = await db.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Identifiants incorrects." };
  const { data: profile, error: roleError } = await db.from("profiles")
    .select("role").eq("id", data.user.id).maybeSingle();
  if (roleError || !profile || !["owner", "pharmacy"].includes(profile.role)) {
    await db.auth.signOut();
    return { error: "Aucun accès TR1 V2 n'est encore attribué à ce compte." };
  }
  redirect(profile.role === "owner" ? "/app" : "/catalogue");
}
export async function signOutAction() {
  const db = await createServerSupabase();
  if (db) await db.auth.signOut();
  redirect("/connexion");
}
