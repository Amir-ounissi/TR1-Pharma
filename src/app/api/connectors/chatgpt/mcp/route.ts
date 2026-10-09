import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import {
  CHATGPT_MCP_MAX_BODY_BYTES,
  CHATGPT_MCP_PROTOCOL_VERSION,
  getChatGptMcpConfig,
  validChatGptMcpClaims,
  type ChatGptMcpConfig,
} from "@/lib/connectors/chatgpt-mcp-config";

export const dynamic = "force-dynamic";

const argsSchema = z.object({
  q: z.string().trim().min(2).max(120),
  brand_id: z.string().uuid(),
}).strict();

const searchTool = {
  name: "search_tr1_pharmacies",
  title: "Rechercher les pharmacies TR1",
  description: "Recherche en lecture seule parmi les pharmacies accessibles à l'utilisateur TR1 connecté et à la marque autorisée. Ne crée ni commande ni visite.",
  inputSchema: {
    type: "object",
    properties: {
      q: { type: "string", minLength: 2, maxLength: 120, description: "Nom, ville ou code postal de la pharmacie" },
      brand_id: { type: "string", format: "uuid", description: "Identifiant de la marque TR1 autorisée" },
    },
    required: ["q", "brand_id"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
};

const brandsTool = {
  name: "list_tr1_brands",
  title: "Lister mes marques TR1",
  description: "Retourne uniquement les marques TR1 accessibles à l'utilisateur connecté, avec leurs identifiants pour les recherches de pharmacies.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
};

const messageSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
}).strict();

function rpcResult(id: string | number, result: unknown) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, result },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function rpcError(id: string | number | null, code: number, message: string, status = 200, headers?: HeadersInit) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

function authChallenge(config: ChatGptMcpConfig) {
  const challenge = 'Bearer resource_metadata="' + config.metadataUrl +
    '", scope="email", error="invalid_token", error_description="An OAuth token for TR1 is required"';
  return rpcError(null, -32001, "TR1 OAuth authorization required", 401, {
    "WWW-Authenticate": challenge,
  });
}

async function boundedJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > CHATGPT_MCP_MAX_BODY_BYTES) {
    throw new Error("too_large");
  }
  if (!request.body) throw new Error("invalid_json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > CHATGPT_MCP_MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(joined));
  } catch {
    throw new Error("invalid_json");
  }
}

export async function POST(request: Request) {
  const config = getChatGptMcpConfig();
  if (!config) return new Response(null, { status: 404 });

  const origin = request.headers.get("origin");
  if (origin && !config.allowedOrigins.includes(origin)) {
    return rpcError(null, -32000, "Untrusted origin", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
    return rpcError(null, -32600, "Expected application/json", 415);
  }

  let payload: unknown;
  try {
    payload = await boundedJson(request);
  } catch (error) {
    return rpcError(null, -32700, "Invalid or oversized request",
      error instanceof Error && error.message === "too_large" ? 413 : 400);
  }
  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success) return rpcError(null, -32600, "Invalid JSON-RPC request", 400);

  const { id, method } = parsed.data;
  if (method === "notifications/initialized" && id === undefined) {
    return new Response(null, { status: 202 });
  }
  if (id === undefined) return rpcError(null, -32600, "Request ID required", 400);

  if (method === "initialize") {
    const params = z.object({ protocolVersion: z.string() }).passthrough().safeParse(parsed.data.params);
    if (!params.success) return rpcError(id, -32602, "Missing protocol version");
    return rpcResult(id, {
      protocolVersion: CHATGPT_MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "tr1-pharma", version: "0.2.0" },
    });
  }

  const negotiated = request.headers.get("mcp-protocol-version");
  if (negotiated && negotiated !== CHATGPT_MCP_PROTOCOL_VERSION) {
    return rpcError(id, -32600, "Unsupported MCP protocol version", 400);
  }
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools: [brandsTool, searchTool] });
  if (method !== "tools/call") return rpcError(id, -32601, "Unknown MCP method");

  const params = z.object({
    name: z.enum([brandsTool.name, searchTool.name]),
    arguments: z.unknown().optional(),
  }).strict().safeParse(parsed.data.params);
  if (!params.success) return rpcError(id, -32602, "Invalid tool parameters");
  const searchArgs = params.data.name === searchTool.name
    ? argsSchema.safeParse(params.data.arguments)
    : null;
  if (params.data.name === searchTool.name && !searchArgs?.success) {
    return rpcError(id, -32602, "Invalid search parameters");
  }
  if (params.data.name === brandsTool.name &&
      params.data.arguments !== undefined &&
      !z.object({}).strict().safeParse(params.data.arguments).success) {
    return rpcError(id, -32602, "Invalid brand listing parameters");
  }

  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return authChallenge(config);

  const { url, publishableKey } = getPublicSupabaseEnv();
  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Both the cryptographically checked JWT and a fresh Auth user lookup are required.
  const { data: claimResult, error: claimError } = await supabase.auth.getClaims(token);
  if (claimError || !validChatGptMcpClaims(claimResult?.claims, config)) {
    return authChallenge(config);
  }
  const { data: identity, error: identityError } = await supabase.auth.getUser(token);
  if (identityError || !identity.user || identity.user.id !== claimResult?.claims?.sub) {
    return authChallenge(config);
  }

  const { data: contexts, error: contextError } = await supabase.rpc("tr1_chatgpt_list_brands");
  if (contextError) return rpcError(id, -32003, "Authorization temporarily unavailable", 503);

  if (params.data.name === brandsTool.name) {
    const brands = (contexts ?? []).map((ctx: {
      brand_id: string; brand_name: string; brand_slug: string;
    }) => ({
      brand_id: ctx.brand_id,
      brand_name: ctx.brand_name,
      brand_slug: ctx.brand_slug,
    }));
    const response = { brands };
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(response) }],
      structuredContent: response,
      isError: false,
    });
  }

  if (!searchArgs?.success) return rpcError(id, -32602, "Invalid search parameters");
  const brandId = searchArgs.data.brand_id;
  if (!(contexts ?? []).some((ctx: { brand_id: string }) => ctx.brand_id === brandId)) {
    return rpcError(id, -32003, "Brand access denied", 403);
  }

  const { data, error } = await supabase.rpc("tr1_chatgpt_search_pharmacies", {
    target_brand_id: brandId,
    search_text: searchArgs.data.q,
  });
  if (error) return rpcError(id, -32004, "Search temporarily unavailable", 503);

  const response = { pharmacies: data ?? [] };
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(response) }],
    structuredContent: response,
    isError: false,
  });
}

export async function GET() {
  if (!getChatGptMcpConfig()) return new Response(null, { status: 404 });
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
