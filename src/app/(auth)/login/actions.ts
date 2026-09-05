"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Adresse email ou mot de passe invalide." };

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !signInData.user) return { error: "Connexion impossible. Vérifiez vos identifiants." };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("brand_id,roles!inner(key)")
    .eq("user_id", signInData.user.id)
    .eq("status", "active");

  const rows = memberships ?? [];
  const roleKeys = rows.flatMap((membership) => {
    const roles = Array.isArray(membership.roles) ? membership.roles : [membership.roles];
    return roles.map((role) => role?.key).filter((key): key is string => Boolean(key));
  });
  const facilitatorOnly = roleKeys.length > 0 && roleKeys.every((key) => key === "facilitator");
  const platformAdmin = rows.some((membership) => {
    const roles = Array.isArray(membership.roles) ? membership.roles : [membership.roles];
    return membership.brand_id === null && roles.some((role) => role?.key === "super_admin");
  });

  if (facilitatorOnly) {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_BRAND_COOKIE);
    redirect("/dashboard/field");
  }

  if (platformAdmin) redirect("/dashboard");
  redirect("/select-brand");
}
