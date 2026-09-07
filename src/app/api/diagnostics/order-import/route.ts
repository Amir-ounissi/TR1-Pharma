import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  let gatewayStatus: number | null = null;

  if (token) {
    try {
      const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      gatewayStatus = response.status;
    } catch {
      gatewayStatus = 0;
    }
  }

  return NextResponse.json({
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    gatewayKeyConfigured: Boolean(process.env.AI_GATEWAY_API_KEY),
    oidcConfigured: Boolean(process.env.VERCEL_OIDC_TOKEN),
    gatewayStatus,
  });
}
