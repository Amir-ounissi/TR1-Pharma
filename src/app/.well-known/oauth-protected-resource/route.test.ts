import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseEnv: () => ({
    url: "https://example.supabase.co",
    publishableKey: "test-only-publishable",
  }),
}));

import { GET } from "./route";

describe("OAuth protected resource discovery", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not advertise an inactive connector", async () => {
    vi.stubEnv("TR1_CHATGPT_CONNECTOR_ENABLED", "false");
    expect((await GET()).status).toBe(404);
  });

  it("publishes a fixed trusted MCP resource and Supabase issuer", async () => {
    vi.stubEnv("TR1_CHATGPT_CONNECTOR_ENABLED", "true");
    vi.stubEnv("TR1_CHATGPT_MCP_RESOURCE_URL", "https://tr1.test/api/connectors/chatgpt/mcp");
    vi.stubEnv("TR1_CHATGPT_OAUTH_CLIENT_IDS", "approved-client");

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      resource: "https://tr1.test/api/connectors/chatgpt/mcp",
      authorization_servers: ["https://example.supabase.co/auth/v1"],
      scopes_supported: ["email"],
    });
  });
});
