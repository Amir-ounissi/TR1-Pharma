import { NextRequest, NextResponse } from "next/server";
import { resolveLoginDestination } from "@/lib/auth/resolve-login-destination";
import { createClient } from "@/lib/supabase/server";
import { oauthConsentReturn } from "@/lib/connectors/chatgpt-oauth-return";

function loginErrorRedirect(request: NextRequest, reason: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("oauth", reason);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return loginErrorRedirect(request, "google_cancelled");

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return loginErrorRedirect(request, "missing_code");

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return loginErrorRedirect(request, "exchange_failed");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return loginErrorRedirect(request, "session_failed");

  const destination = await resolveLoginDestination(supabase, user.id);
  const returnTo = oauthConsentReturn(request.cookies.get("tr1_oauth_consent_return")?.value);
  const response = NextResponse.redirect(new URL(returnTo ?? destination, request.url));
  response.cookies.set("tr1_oauth_consent_return", "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: 0, path: "/auth/callback",
  });
  return response;
}
