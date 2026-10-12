import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: fake.createClient,
}));
vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseEnv: () => ({
    url: "https://example.supabase.co",
    publishableKey: "test-only-publishable",
  }),
}));

import { POST, GET } from "./route";

const brandId = "11111111-1111-4111-8111-111111111111";
const resource = "https://tr1.test/api/connectors/chatgpt/mcp";

function request(method: string, params?: unknown, token?: string, extra?: Record<string, string>) {
  return new Request(resource, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...extra,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

const toolParams = {
  name: "search_tr1_pharmacies",
  arguments: { q: "Valentine", brand_id: brandId },
};

describe("TR1 authenticated MCP endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("TR1_CHATGPT_CONNECTOR_ENABLED", "true");
    vi.stubEnv("TR1_CHATGPT_MCP_RESOURCE_URL", resource);
    vi.stubEnv("TR1_CHATGPT_OAUTH_CLIENT_IDS", "trusted-chatgpt-client");
    vi.clearAllMocks();
    fake.createClient.mockReturnValue({
      auth: { getClaims: fake.getClaims, getUser: fake.getUser },
      rpc: fake.rpc,
    });
    fake.getClaims.mockResolvedValue({
      data: { claims: {
        sub: "user-1",
        iss: "https://example.supabase.co/auth/v1",
        aud: resource,
        role: "tr1_chatgpt_reader",
        client_id: "trusted-chatgpt-client",
      } },
      error: null,
    });
    fake.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId }], error: null }
      : { data: [{ pharmacy_name: "Valentine" }], error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("is inaccessible unless explicitly enabled", async () => {
    vi.stubEnv("TR1_CHATGPT_CONNECTOR_ENABLED", "false");
    const response = await POST(request("tools/list"));
    expect(response.status).toBe(404);
    expect(fake.createClient).not.toHaveBeenCalled();
  });

  it("advertises five read tools and two explicitly labeled writes", async () => {
    const response = await POST(request("tools/list"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.tools).toHaveLength(7);
    expect(body.result.tools.slice(0, 5).every((tool: { annotations: { readOnlyHint: boolean } }) =>
      tool.annotations.readOnlyHint)).toBe(true);
    expect(body.result.tools.slice(5).every((tool: { annotations: { readOnlyHint: boolean } }) =>
      tool.annotations.readOnlyHint)).toBe(false);
    expect(body.result.tools.every((tool: { securitySchemes: Array<{type:string}> }) =>
      tool.securitySchemes[0].type === "oauth2")).toBe(true);
  });

  it("initializes using the supported MCP protocol", async () => {
    const response = await POST(request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } }));
    const body = await response.json();
    expect(body.result.protocolVersion).toBe("2025-06-18");
  });

  it("returns an RFC 9728 challenge without a token", async () => {
    const response = await POST(request("tools/call", toolParams));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata");
    expect(fake.createClient).not.toHaveBeenCalled();
  });

  it("accepts standard MCP tools/call transport metadata", async () => {
    fake.rpc.mockResolvedValueOnce({
      data: [{ brand_id: brandId, brand_name: "Naali Démo", brand_slug: "naali-demo" }],
      error: null,
    });
    const response = await POST(request("tools/call", {
      name: "list_tr1_brands",
      arguments: {},
      _meta: { progressToken: 3, "com.openai/request_id": "test-trace" },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect((await response.json()).result.structuredContent.brands[0].brand_name).toBe("Naali Démo");
  });

  it("keeps tool argument schemas strict even if MCP transport carries metadata", async () => {
    const response = await POST(request("tools/call", {
      name: "search_tr1_pharmacies",
      arguments: { ...toolParams.arguments, unexpected: "not-allowed" },
      _meta: { progressToken: 3 },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect((await response.json()).error.message).toBe("Invalid search parameters");
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("rejects a normal Supabase session without OAuth client binding", async () => {
    fake.getClaims.mockResolvedValueOnce({ data: { claims: {
      sub: "user-1", role: "authenticated",
      iss: "https://example.supabase.co/auth/v1", aud: "authenticated",
    } }, error: null });
    expect((await POST(request("tools/call", toolParams, "session-token"))).status).toBe(401);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("rejects a foreign OAuth client even with an otherwise valid token", async () => {
    fake.getClaims.mockResolvedValueOnce({ data: { claims: {
      sub: "user-1", role: "tr1_chatgpt_reader",
      iss: "https://example.supabase.co/auth/v1", aud: resource,
      client_id: "foreign-client",
    } }, error: null });
    expect((await POST(request("tools/call", toolParams, "foreign-token"))).status).toBe(401);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("rejects a client token not bound to the MCP resource", async () => {
    fake.getClaims.mockResolvedValueOnce({ data: { claims: {
      sub: "user-1", role: "tr1_chatgpt_reader",
      iss: "https://example.supabase.co/auth/v1", aud: "authenticated",
      client_id: "trusted-chatgpt-client",
    } }, error: null });
    expect((await POST(request("tools/call", toolParams, "wrong-audience"))).status).toBe(401);
  });

  it("rejects a user lacking membership in the requested brand", async () => {
    fake.rpc.mockResolvedValueOnce({ data: [], error: null });
    const response = await POST(request("tools/call", toolParams, "oauth-token"));
    expect(response.status).toBe(403);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });

  it("searches only within the verified brand with a bounded limit", async () => {
    const response = await POST(request("tools/call", toolParams, "oauth-token"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.structuredContent.pharmacies).toHaveLength(1);
    expect(fake.rpc).toHaveBeenCalledWith("tr1_chatgpt_search_pharmacies", {
      target_brand_id: brandId,
      search_text: "Valentine",
    });
  });

  it("lists only authorized brands without querying all brands", async () => {
    fake.rpc.mockResolvedValueOnce({
      data: [{
        brand_id: brandId,
        brand_name: "VK Swiss",
        brand_slug: "vk-swiss",
        role_key: "brand_user",
      }],
      error: null,
    });
    const response = await POST(request("tools/call", {
      name: "list_tr1_brands",
      arguments: {},
    }, "oauth-token"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.structuredContent.brands).toEqual([{
      brand_id: brandId,
      brand_name: "VK Swiss",
      brand_slug: "vk-swiss",
    }]);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
    expect(fake.rpc).toHaveBeenCalledWith("tr1_chatgpt_list_brands");
  });

  it("returns a minimized commercial summary from its dedicated read RPC", async () => {
    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId }], error: null }
      : { data: { name: "Valentine", last_order_at: null }, error: null });
    const id = "22222222-2222-4222-8222-222222222222";
    const response = await POST(request("tools/call", {
      name: "get_tr1_pharmacy_summary", arguments: { brand_pharmacy_id: id },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect((await response.json()).result.structuredContent.pharmacy.name).toBe("Valentine");
    expect(fake.rpc).toHaveBeenCalledWith("tr1_chatgpt_pharmacy_summary", {
      target_brand_pharmacy_id: id,
    });
  });

  it("denies unauthorized pharmacy summaries", async () => {
    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId }], error: null }
      : { data: null, error: { code: "42501" } });
    const response = await POST(request("tools/call", {
      name: "get_tr1_pharmacy_summary",
      arguments: { brand_pharmacy_id: "22222222-2222-4222-8222-222222222222" },
    }, "oauth-token"));
    expect(response.status).toBe(403);
  });

  it("never contacts TR1 database for an unconfirmed order write", async () => {
    const response = await POST(request("tools/call", {
      name: "create_tr1_order_draft",
      arguments: {
        brand_pharmacy_id: "22222222-2222-4222-8222-222222222222",
        items: [{ product_id: "33333333-3333-4333-8333-333333333333", quantity: 24 }],
        order_type: "reorder",
        request_id: "44444444-4444-4444-8444-444444444444",
      },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect((await response.json()).error.message).toContain("unconfirmed");
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("routes a confirmed draft only through its protected dedicated RPC", async () => {
    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId }], error: null }
      : { data: { order_id: "55555555-5555-4555-8555-555555555555", status: "draft", transmitted: false }, error: null });
    const response = await POST(request("tools/call", {
      name: "create_tr1_order_draft",
      arguments: {
        brand_pharmacy_id: "22222222-2222-4222-8222-222222222222",
        items: [{ product_id: "33333333-3333-4333-8333-333333333333", quantity: 24 }],
        order_type: "reorder",
        request_id: "44444444-4444-4444-8444-444444444444",
        confirmed: true,
      },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect((await response.json()).result.structuredContent.draft.transmitted).toBe(false);
    expect(fake.rpc).toHaveBeenCalledWith("tr1_chatgpt_create_order_draft",
      expect.objectContaining({ confirmed: true }));
  });

  it("returns 403 when the dedicated database write authorization fails", async () => {
    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId }], error: null }
      : { data: null, error: { code: "42501" } });
    const response = await POST(request("tools/call", {
      name: "create_tr1_planned_visit",
      arguments: {
        pharmacy_id: "22222222-2222-4222-8222-222222222222",
        brand_pharmacy_ids: ["33333333-3333-4333-8333-333333333333"],
        visit_kind: "client_visit", title: "RDV planifié",
        start_at: "2026-10-15T10:00:00+02:00", end_at: "2026-10-15T11:00:00+02:00",
        confirmed: true,
      },
    }, "oauth-token"));
    expect(response.status).toBe(403);
  });

  it("rejects an untrusted origin", async () => {
    expect((await POST(request("tools/list", {}, "", { origin: "https://attacker.test" }))).status).toBe(403);
  });

  it("does not accept GET as a way to access sensitive data", async () => {
    expect((await GET()).status).toBe(405);
  });
});
