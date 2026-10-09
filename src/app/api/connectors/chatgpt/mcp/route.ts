import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const argsSchema = z.object({
  q: z.string().trim().min(2).max(120),
  brand_id: z.string().uuid(),
});

const tool = {
  name: "search_tr1_pharmacies",
  description: "Search pharmacies accessible to the authenticated TR1 user within an authorized brand. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      q: { type: "string", minLength: 2, maxLength: 120, description: "Pharmacy name or location" },
      brand_id: { type: "string", format: "uuid", description: "TR1 brand identifier" },
    },
    required: ["q", "brand_id"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
};

const rpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.unknown().optional(),
});

function jsonrpc(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: { "Cache-Control": "no-store" } });
}

function rpcError(id: string | number | null, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "Expected application/json" }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 16384) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  let payload: unknown;
  try { payload = await request.json(); } catch { return rpcError(null, -32700, "Invalid JSON", 400); }
  const parsed = rpcSchema.safeParse(payload);
  if (!parsed.success) return rpcError(null, -32600, "Invalid request", 400);
  const { method, id } = parsed.data;
  const responseId = id ?? null;

  if (method === "notifications/initialized") return new Response(null, { status: 202 });
  if (method === "initialize") {
    return jsonrpc(responseId, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "tr1-pharma", version: "0.1.0" },
    });
  }
  if (method === "ping") return jsonrpc(responseId, {});
  if (method === "tools/list") return jsonrpc(responseId, { tools: [tool] });
  if (method !== "tools/call") return rpcError(responseId, -32601, "Method not found");

  const params = z.object({ name: z.string(), arguments: z.unknown().optional() }).safeParse(parsed.data.params);
  if (!params.success || params.data.name !== tool.name) return rpcError(responseId, -32602, "Unknown tool or invalid parameters");
  const args = argsSchema.safeParse(params.data.arguments);
  if (!args.success) return rpcError(responseId, -32602, "Invalid pharmacy search parameters");

  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return rpcError(responseId, -32001, "Authentication required", 401);

  const { url, publishableKey } = getPublicSupabaseEnv();
  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: identityError } = await supabase.auth.getUser(token);
  if (identityError || !identity.user) return rpcError(responseId, -32001, "Invalid session", 401);

  const { data: contexts, error: contextError } = await supabase.rpc("get_my_brand_contexts");
  if (contextError) return rpcError(responseId, -32003, "Authorization unavailable", 503);
  if (!(contexts ?? []).some((context: { brand_id: string }) => context.brand_id === args.data.brand_id)) {
    return rpcError(responseId, -32003, "Brand not authorized", 403);
  }
  const { data, error } = await supabase.rpc("search_authorized_pharmacies", {
    target_brand_id: args.data.brand_id,
    search_text: args.data.q,
    result_limit: 10,
  });
  if (error) return rpcError(responseId, -32004, "Pharmacy search unavailable", 503);
  return jsonrpc(responseId, {
    content: [{ type: "text", text: JSON.stringify({ pharmacies: data ?? [] }) }],
    structuredContent: { pharmacies: data ?? [] },
    isError: false,
  });
}

export async function GET() {
  return NextResponse.json({ error: "MCP endpoint requires POST" }, { status: 405 });
}
