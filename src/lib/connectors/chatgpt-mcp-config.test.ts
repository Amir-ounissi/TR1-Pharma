import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseEnv: () => ({
    url: "https://example.supabase.co",
    publishableKey: "test-publishable-key",
  }),
}));

import { getChatGptMcpConfig, validChatGptMcpClaims } from "./chatgpt-mcp-config";

const resource = "https://tr1.test/api/connectors/chatgpt/mcp";
function setup() {
  vi.stubEnv("TR1_CHATGPT_CONNECTOR_ENABLED", "true");
  vi.stubEnv("TR1_CHATGPT_MCP_RESOURCE_URL", resource);
  vi.stubEnv("TR1_CHATGPT_OAUTH_CLIENT_IDS", "approved-client");
}

describe("TR1 MCP configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is disabled by default", () => {
    vi.stubEnv("TR1_CHATGPT_CONNECTOR_ENABLED", "false");
    expect(getChatGptMcpConfig()).toBeNull();
  });

  it("rejects untrusted or invalid resource URLs", () => {
    setup();
    for (const url of [
      "http://tr1.test/api/connectors/chatgpt/mcp",
      "https://evil.test/phishing",
      "https://user:pass@tr1.test/api/connectors/chatgpt/mcp",
      "https://tr1.test/api/connectors/chatgpt/mcp?token=abc",
    ]) {
      vi.stubEnv("TR1_CHATGPT_MCP_RESOURCE_URL", url);
      expect(getChatGptMcpConfig()).toBeNull();
    }
  });

  it("cannot activate without explicit client IDs", () => {
    setup();
    vi.stubEnv("TR1_CHATGPT_OAUTH_CLIENT_IDS", "");
    expect(getChatGptMcpConfig()).toBeNull();
  });

  it("requires exact resource audience and client binding", () => {
    setup();
    const config = getChatGptMcpConfig();
    expect(config).not.toBeNull();
    if (!config) return;

    const claims = {
      iss: "https://example.supabase.co/auth/v1",
      sub: "valid-subject",
      aud: resource,
      client_id: "approved-client",
      role: "tr1_chatgpt_reader",
    };
    expect(validChatGptMcpClaims(claims, config)).toBe(true);
    expect(validChatGptMcpClaims({ ...claims, aud: "authenticated" }, config)).toBe(false);
    expect(validChatGptMcpClaims({ ...claims, client_id: "not-approved" }, config)).toBe(false);
    expect(validChatGptMcpClaims({ ...claims, iss: "https://evil.test/auth/v1" }, config)).toBe(false);
    expect(validChatGptMcpClaims({ ...claims, role: "service_role" }, config)).toBe(false);
    expect(validChatGptMcpClaims({ ...claims, role: "authenticated" }, config)).toBe(false);
  });
});
