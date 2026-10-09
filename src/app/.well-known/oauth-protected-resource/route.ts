import { NextResponse } from "next/server";
import { getChatGptMcpConfig } from "@/lib/connectors/chatgpt-mcp-config";

export const dynamic = "force-dynamic";

// RFC 9728: metadata is public, while tools and customer data remain protected.
// Never derive these URLs from an untrusted Host / X-Forwarded-Host header.
export async function GET() {
  const config = getChatGptMcpConfig();
  if (!config) return new Response(null, { status: 404 });

  return NextResponse.json({
    resource: config.resourceUrl,
    authorization_servers: [config.issuer],
    scopes_supported: ["email"],
  }, { headers: { "Cache-Control": "no-store" } });
}
