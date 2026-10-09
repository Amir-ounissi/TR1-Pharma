import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { oauthConsentReturn } from "@/lib/connectors/chatgpt-oauth-return";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const redirectTo = new URL("/auth/callback", request.url).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("oauth", "google_unavailable");
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(data.url);
  const returnTo = oauthConsentReturn(request.nextUrl.searchParams.get("returnTo"));
  if (returnTo) response.cookies.set("tr1_oauth_consent_return", returnTo, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: 600, path: "/auth/callback",
  });
  return response;
}
