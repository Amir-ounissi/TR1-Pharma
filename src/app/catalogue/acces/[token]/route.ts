import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRIVATE_CATALOGUE_LINK_COOKIE } from "@/lib/private-catalogue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invalidUrl = new URL("/catalogue/acces-invalide", request.url);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return NextResponse.redirect(invalidUrl, { status: 303 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data: link, error } = await admin
    .from("private_catalog_access_links")
    .select("id,expires_at")
    .eq("token_hash", tokenHash)
    .eq("active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !link) {
    const response = NextResponse.redirect(invalidUrl, { status: 303 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const { error: updateError } = await admin
    .from("private_catalog_access_links")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", link.id)
    .eq("active", true);

  if (updateError) {
    const response = NextResponse.redirect(invalidUrl, { status: 303 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const maxAge = Math.max(1, Math.floor(
    (new Date(link.expires_at).getTime() - Date.now()) / 1000,
  ));
  const response = NextResponse.redirect(new URL("/catalogue", request.url), { status: 303 });
  response.cookies.set({
    name: PRIVATE_CATALOGUE_LINK_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/catalogue",
    maxAge,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
