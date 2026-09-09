"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRoleLandingPath } from "@/lib/ux/navigation";

export type LoginState = { error?: string };

type BrandContextRow = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  role_key: string;
};

const brandCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

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

  const [{ data: autonomousOnboarding }, { data: pendingBrandRequest }] = await Promise.all([
    supabase.rpc("get_my_self_service_onboarding"),
    supabase
      .from("access_requests")
      .select("id")
      .eq("user_id", signInData.user.id)
      .eq("requested_profile_type", "brand")
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  if (autonomousOnboarding?.length || pendingBrandRequest) {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_BRAND_COOKIE);
    redirect("/setup");
  }

  // Resolve the first working context in the same server action that created
  // the Supabase session. This avoids an immediate extra request that can race
  // the newly-issued auth cookies in production-mode browser tests.
  const { data: contextRows, error: contextError } = await supabase.rpc("get_my_brand_contexts");
  if (contextError) throw contextError;

  const contexts = ((contextRows ?? []) as BrandContextRow[]).map((context) => ({
    id: context.brand_id,
    role: context.role_key,
  }));
  const cookieStore = await cookies();
  const rememberedBrandId = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value;
  const rememberedContext = rememberedBrandId
    ? contexts.find((context) => context.id === rememberedBrandId)
    : undefined;
  const selectedContext = rememberedContext ?? contexts[0];

  if (!selectedContext) {
    cookieStore.delete(ACTIVE_BRAND_COOKIE);
    redirect("/select-brand?status=no-brand");
  }

  cookieStore.set(ACTIVE_BRAND_COOKIE, selectedContext.id, brandCookieOptions);
  redirect(getRoleLandingPath(selectedContext.role));
}
