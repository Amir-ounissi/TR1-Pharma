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
        role: "authenticated",
        client_id: "trusted-chatgpt-client",
      } },
      error: null,
    });
    fake.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    fake.rpc.mockImplementation(async (name: string) => name === "get_my_brand_contexts"
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

  it("exposes a read-only OAuth-protected tool", async () => {
    const response = await POST(request("tools/list"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.tools[0].annotations.readOnlyHint).toBe(true);
    expect(body.result.tools[0].securitySchemes[0].type).toBe("oauth2");
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
      sub: "user-1", role: "authenticated",
      iss: "https://example.supabase.co/auth/v1", aud: resource,
      client_id: "foreign-client",
    } }, error: null });
    expect((await POST(request("tools/call", toolParams, "foreign-token"))).status).toBe(401);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("rejects a client token not bound to the MCP resource", async () => {
    fake.getClaims.mockResolvedValueOnce({ data: { claims: {
      sub: "user-1", role: "authenticated",
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
    expect(fake.rpc).toHaveBeenCalledWith("search_authorized_pharmacies", {
      target_brand_id: brandId,
      search_text: "Valentine",
      result_limit: 10,
    });
  });

  it("rejects an untrusted origin", async () => {
    expect((await POST(request("tools/list", {}, "", { origin: "https://attacker.test" }))).status).toBe(403);
  });

  it("does not accept GET as a way to access sensitive data", async () => {
    expect((await GET()).status).toBe(405);
  });
});
