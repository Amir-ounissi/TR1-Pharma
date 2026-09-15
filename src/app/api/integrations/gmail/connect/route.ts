import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildGoogleAuthorizationUrl } from "@/lib/integrations/gmail/google";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard/orders";
  return value.slice(0, 1000);
}

export async function GET(request: NextRequest) {
  await requireUser();
  const state = randomBytes(24).toString("base64url");
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const redirectUri = new URL("/api/integrations/gmail/callback", request.url).toString();
  const authorizationUrl = buildGoogleAuthorizationUrl(state, redirectUri);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(
    "tr1_gmail_oauth",
    Buffer.from(JSON.stringify({ state, returnTo }), "utf8").toString("base64url"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    },
  );
  return response;
}
