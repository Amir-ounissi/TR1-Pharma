import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRoleLandingPath } from "@/lib/ux/navigation";

type BrandContextRow = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  role_key: string;
};

type MembershipRow = {
  brand_id: string | null;
  roles: { key: string } | Array<{ key: string }> | null;
};

const brandCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

function safeDashboardPath(value: string | null) {
  if (!value || !value.startsWith("/dashboard")) return null;
  return value;
}

function roleKeys(row: MembershipRow) {
  const roles = Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [];
  return roles.map((role) => role.key).filter(Boolean);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (claimsError || !userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const [{ data: contextRows, error: contextError }, { data: membershipRows, error: membershipError }] =
    await Promise.all([
      supabase.rpc("get_my_brand_contexts"),
      supabase
        .from("memberships")
        .select("brand_id,roles!inner(key)")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

  if (contextError) throw contextError;
  if (membershipError) throw membershipError;

  const contexts = ((contextRows ?? []) as BrandContextRow[]).map((context) => ({
    id: context.brand_id,
    name: context.brand_name,
    slug: context.brand_slug,
    role: context.role_key,
  }));
  const memberships = (membershipRows ?? []) as unknown as MembershipRow[];
  const platformAdmin = memberships.some(
    (membership) => membership.brand_id === null && roleKeys(membership).includes("super_admin"),
  );
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");
  const requestedBrandId = request.nextUrl.searchParams.get("brandId");
  const requestedNext = safeDashboardPath(request.nextUrl.searchParams.get("next"));
  const rememberedBrandId = request.cookies.get(ACTIVE_BRAND_COOKIE)?.value;
  const requestedContext = requestedBrandId
    ? contexts.find((context) => context.id === requestedBrandId)
    : undefined;
  const rememberedContext = rememberedBrandId
    ? contexts.find((context) => context.id === rememberedBrandId)
    : undefined;

  if (facilitatorOnly) {
    const response = NextResponse.redirect(new URL(requestedNext ?? "/dashboard/field", request.url));
    response.cookies.delete(ACTIVE_BRAND_COOKIE);
    return response;
  }

  // Platform administrators keep the global TR1 view by default. They can still
  // enter a tenant explicitly from their account page.
  if (platformAdmin && !requestedContext && !rememberedContext) {
    return NextResponse.redirect(new URL(requestedNext ?? "/dashboard", request.url));
  }

  const selectedContext = requestedContext ?? rememberedContext ?? contexts[0];
  if (!selectedContext) {
    return NextResponse.redirect(new URL("/select-brand?status=no-brand", request.url));
  }

  const response = NextResponse.redirect(
    new URL(requestedNext ?? getRoleLandingPath(selectedContext.role), request.url),
  );
  response.cookies.set(ACTIVE_BRAND_COOKIE, selectedContext.id, brandCookieOptions);
  return response;
}
