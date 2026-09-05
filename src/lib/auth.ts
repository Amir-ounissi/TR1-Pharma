import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_BRAND_COOKIE = "tr1_active_brand";

export type BrandContext = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type BrandContextRow = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  role_key: string;
};

type UserProfile = {
  full_name: string;
  onboarding_completed_at: string;
};

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  if (error || !subject) redirect("/login");
  return { supabase, userId: subject };
}

export async function requirePlatformAdmin() {
  const { supabase, userId } = await requireUser();
  await getUserProfile(supabase, userId);
  const membership = await getPlatformAdminMembership(supabase, userId);

  if (!membership) redirect("/dashboard");

  return { supabase, userId };
}

export async function getBrandContexts(): Promise<BrandContext[]> {
  const { supabase } = await requireUser();

  let { data, error } = await supabase.rpc("get_my_brand_contexts");

  if (error?.code === "PGRST303") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    ({ data, error } = await supabase.rpc("get_my_brand_contexts"));
  }

  if (error) throw error;

  return ((data ?? []) as BrandContextRow[]).map((context) => ({
    id: context.brand_id,
    name: context.brand_name,
    slug: context.brand_slug,
    role: context.role_key,
  }));
}

export async function isPlatformAdmin() {
  const { supabase, userId } = await requireUser();
  await getUserProfile(supabase, userId);
  return Boolean(await getPlatformAdminMembership(supabase, userId));
}

export async function requireCompletedOnboarding() {
  const { supabase, userId } = await requireUser();
  const profile = await getUserProfile(supabase, userId);
  return { supabase, userId, profile };
}

export async function getOptionalActiveBrand() {
  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value;
  const { supabase, userId } = await requireUser();
  const profile = await getUserProfile(supabase, userId);

  if (!activeBrandId) {
    return { supabase, userId, profile, brand: null };
  }

  const { data: brand } = await supabase.from("brands").select("id,name,slug").eq("id", activeBrandId).maybeSingle();
  return { supabase, userId, profile, brand: brand ?? null };
}

export async function requireActiveBrand() {
  const session = await getOptionalActiveBrand();
  if (!session.brand) redirect("/select-brand");
  return session as typeof session & { brand: { id: string; name: string; slug: string } };
}

export async function requireActiveBrandRole(allowedRoles: readonly string[], fallback = "/dashboard") {
  const session = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role = contexts.find((context) => context.id === session.brand.id)?.role ?? "brand_user";
  if (!allowedRoles.includes(role)) redirect(fallback);
  return { ...session, role };
}

async function getPlatformAdminMembership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id,roles!inner(key)")
    .eq("user_id", userId)
    .is("brand_id", null)
    .eq("status", "active")
    .eq("roles.key", "super_admin")
    .maybeSingle();

  if (error) throw error;
  return membership;
}

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<UserProfile> {
  const { data: profile } = await supabase.from("user_profiles").select("full_name,onboarding_completed_at").eq("user_id", userId).maybeSingle();

  if (!profile?.full_name?.trim() || !profile.onboarding_completed_at) redirect("/onboarding");
  return profile;
}
