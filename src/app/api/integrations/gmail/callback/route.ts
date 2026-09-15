import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredential } from "@/lib/integrations/gmail/credentials";
import { exchangeGoogleCode, getGoogleAccountEmail } from "@/lib/integrations/gmail/google";

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value.slice(0, 1000)
    : "/dashboard/orders";
}

function redirectWithStatus(request: NextRequest, returnTo: string, status: string) {
  const target = new URL(returnTo, request.url);
  target.searchParams.set("gmail", status);
  const response = NextResponse.redirect(target);
  response.cookies.delete("tr1_gmail_oauth");
  return response;
}

export async function GET(request: NextRequest) {
  const { userId } = await requireUser();
  const contextRaw = request.cookies.get("tr1_gmail_oauth")?.value;
  if (!contextRaw) return redirectWithStatus(request, "/dashboard/orders", "error");

  let context: { state?: string; returnTo?: string } = {};
  try {
    context = JSON.parse(Buffer.from(contextRaw, "base64url").toString("utf8"));
  } catch {
    return redirectWithStatus(request, "/dashboard/orders", "error");
  }

  const returnTo = safeReturnTo(context.returnTo);
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError || !code || !state || state !== context.state) {
    return redirectWithStatus(request, returnTo, "error");
  }

  try {
    const redirectUri = new URL("/api/integrations/gmail/callback", request.url).toString();
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const email = await getGoogleAccountEmail(tokens.access_token!);
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("user_gmail_connections")
      .select("refresh_token_ciphertext")
      .eq("user_id", userId)
      .maybeSingle();

    const encryptedRefreshToken = tokens.refresh_token
      ? encryptCredential(tokens.refresh_token)
      : existing?.refresh_token_ciphertext;

    if (!encryptedRefreshToken) throw new Error("Google did not return an offline refresh token.");

    const scopes = (tokens.scope || "").split(/\s+/).filter(Boolean);
    const { error } = await admin.from("user_gmail_connections").upsert(
      {
        user_id: userId,
        email,
        refresh_token_ciphertext: encryptedRefreshToken,
        scopes,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;

    return redirectWithStatus(request, returnTo, "connected");
  } catch {
    return redirectWithStatus(request, returnTo, "error");
  }
}
