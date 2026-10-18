import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_BRAND_COOKIE, getBrandContexts } from "@/lib/auth";
import { canSelectBrand } from "@/lib/brand-context";

export const dynamic = "force-dynamic";

/**
 * Authenticated, explicit brand switch when opening a search result.
 * Always load a fresh document after switching to avoid cached RSC content
 * from the previously selected brand.
 */
export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get("brand");
  const destination = request.nextUrl.searchParams.get("to") ?? "";
  const safeDestination =
    destination.startsWith("/dashboard/") &&
    !destination.startsWith("//") &&
    /^\/dashboard\/(?:pharmacies(?:\/[\da-f-]{36})?|orders(?:\/(?:[\da-f-]{36}|new))?|products|missions(?:\/[\da-f-]{36})?|tasks)(?:\?.*)?$/i.test(destination);

  const contexts = await getBrandContexts();
  if (!safeDestination || !canSelectBrand(contexts, brandId)) {
    return NextResponse.redirect(new URL("/dashboard/account?error=unauthorized", request.url));
  }

  const url = new URL(destination, request.url);
  if (url.origin !== request.nextUrl.origin) {
    return NextResponse.redirect(new URL("/dashboard/account?error=unauthorized", request.url));
  }

  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.cookies.set(ACTIVE_BRAND_COOKIE, brandId as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
