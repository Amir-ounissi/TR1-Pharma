import { cookies } from "next/headers";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRoleLandingPath } from "@/lib/ux/navigation";

type AuthSupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

export async function resolveLoginDestination(
  supabase: AuthSupabaseClient,
  userId: string,
) {
  const { data: memberships } = await supabase
    .from("memberships")
    .select("brand_id,roles!inner(key)")
    .eq("user_id", userId)
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

  const cookieStore = await cookies();

  if (facilitatorOnly) {
    cookieStore.delete(ACTIVE_BRAND_COOKIE);
    return "/dashboard/field";
  }

  if (platformAdmin) return "/dashboard";

  const [{ data: autonomousOnboarding }, { data: pendingBrandRequest }] = await Promise.all([
    supabase.rpc("get_my_self_service_onboarding"),
    supabase
      .from("access_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("requested_profile_type", "brand")
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  if (autonomousOnboarding?.length || pendingBrandRequest) {
    cookieStore.delete(ACTIVE_BRAND_COOKIE);
    return "/setup";
  }

  const { data: contextRows, error: contextError } = await supabase.rpc("get_my_brand_contexts");
  if (contextError) throw contextError;

  const contexts = ((contextRows ?? []) as BrandContextRow[]).map((context) => ({
    id: context.brand_id,
    role: context.role_key,
  }));
  const rememberedBrandId = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value;
  const rememberedContext = rememberedBrandId
    ? contexts.find((context) => context.id === rememberedBrandId)
    : undefined;
  const selectedContext = rememberedContext ?? contexts[0];

  if (!selectedContext) {
    cookieStore.delete(ACTIVE_BRAND_COOKIE);
    return "/select-brand?status=no-brand";
  }

  cookieStore.set(ACTIVE_BRAND_COOKIE, selectedContext.id, brandCookieOptions);
  return getRoleLandingPath(selectedContext.role);
}
