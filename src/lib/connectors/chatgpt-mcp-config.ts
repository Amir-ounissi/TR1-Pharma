import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const CHATGPT_MCP_PROTOCOL_VERSION = "2025-06-18";
export const CHATGPT_MCP_MAX_BODY_BYTES = 16 * 1024;

export type ChatGptMcpConfig = {
  resourceUrl: string;
  metadataUrl: string;
  issuer: string;
  allowedClientIds: string[];
  allowedOrigins: string[];
};

export function getChatGptMcpConfig(): ChatGptMcpConfig | null {
  // OFF by default. This gate is intentionally separate from deploying the source.
  if (process.env.TR1_CHATGPT_CONNECTOR_ENABLED !== "true") return null;
  const raw = process.env.TR1_CHATGPT_MCP_RESOURCE_URL;
  if (!raw) return null;

  let resource: URL;
  try {
    resource = new URL(raw);
  } catch {
    return null;
  }
  if (
    resource.protocol !== "https:" ||
    resource.username ||
    resource.password ||
    resource.search ||
    resource.hash ||
    resource.pathname !== "/api/connectors/chatgpt/mcp"
  ) {
    return null;
  }

  const clients = (process.env.TR1_CHATGPT_OAUTH_CLIENT_IDS ?? "")
    .split(",").map((part) => part.trim()).filter(Boolean);
  if (!clients.length) return null;

  const { url: supabaseUrl } = getPublicSupabaseEnv();
  const issuer = new URL("/auth/v1", supabaseUrl).toString().replace(/\/$/, "");
  const customOrigins = (process.env.TR1_CHATGPT_ALLOWED_ORIGINS ?? "")
    .split(",").map((part) => part.trim()).filter(Boolean);

  return {
    resourceUrl: resource.toString(),
    metadataUrl: new URL("/.well-known/oauth-protected-resource", resource).toString(),
    issuer,
    allowedClientIds: clients,
    allowedOrigins: [...new Set([resource.origin, "https://chatgpt.com", ...customOrigins])],
  };
}

export function validChatGptMcpClaims(claims: unknown, config: ChatGptMcpConfig): boolean {
  if (!claims || typeof claims !== "object") return false;
  const c = claims as Record<string, unknown>;
  const aud = c.aud;
  const audienceMatches = aud === config.resourceUrl ||
    (Array.isArray(aud) && aud.includes(config.resourceUrl));
  return c.iss === config.issuer &&
    typeof c.sub === "string" && c.sub.length > 0 &&
    c.role === "authenticated" &&
    typeof c.client_id === "string" &&
    config.allowedClientIds.includes(c.client_id) &&
    audienceMatches;
}
