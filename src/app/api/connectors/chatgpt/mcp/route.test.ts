import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  adminFrom: vi.fn(),
  refreshPricing: vi.fn(),
  deliverOrder: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: fake.createAdminClient }));
vi.mock("@/lib/connectors/chatgpt-order-delivery", () => ({
  deliverChatGptOrder: fake.deliverOrder,
}));
vi.mock("@/lib/integrations/hubspot/naali-pricing", () => ({
  getNaaliHubSpotPharmacyPricing: fake.refreshPricing,
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
    fake.createAdminClient.mockReturnValue({ from: fake.adminFrom });
    fake.refreshPricing.mockResolvedValue({ discountRate: 35 });
    fake.deliverOrder.mockResolvedValue({ hubspot_synced: true, deal_id: "hubspot-deal-123" });
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

  it("advertises ten read tools and seven explicit writes", async () => {
    const response = await POST(request("tools/list"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.tools).toHaveLength(17);
    expect(body.result.tools.filter((tool: { annotations: { readOnlyHint: boolean } }) =>
      tool.annotations.readOnlyHint)).toHaveLength(10);
    expect(body.result.tools.filter((tool: { annotations: { readOnlyHint: boolean } }) =>
      !tool.annotations.readOnlyHint)).toHaveLength(7);
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


  it("keeps UG changes behind explicit confirmation and scoped RPC", async () => {
    const args = {
      order_id: "22222222-2222-4222-8222-222222222222",
      request_id: "33333333-3333-4333-8333-333333333333",
      adjustments: [{
        product_id: "44444444-4444-4444-8444-444444444444",
        mode: "add", quantity: 17, classification: "compensation opé promo",
      }],
    };
    const unconfirmed = await POST(request("tools/call", {
      name: "set_tr1_priced_order_ug_adjustments", arguments: args,
    }, "oauth-token"));
    expect((await unconfirmed.json()).error.message).toContain("unconfirmed");
    expect(fake.rpc).not.toHaveBeenCalled();

    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId, brand_slug: "naali" }], error: null }
      : { data: { order_id: args.order_id, adjustments_applied: true, status: "draft" }, error: null });
    const confirmed = await POST(request("tools/call", {
      name: "set_tr1_priced_order_ug_adjustments",
      arguments: { ...args, confirmed: true },
    }, "oauth-token"));
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).result.structuredContent.adjusted_draft.status).toBe("draft");
    expect(fake.rpc).toHaveBeenCalledWith("tr1_chatgpt_set_draft_ug_adjustments", {
      target_order_id: args.order_id,
      request_id: args.request_id, adjustments: args.adjustments, confirmed: true,
    });
    expect(fake.deliverOrder).not.toHaveBeenCalled();
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


  it("refreshes stale Naali conditions before preview only after scoped authorization", async () => {
    const relation = "22222222-2222-4222-8222-222222222222";
    const pharmacy = "33333333-3333-4333-8333-333333333333";
    const product = "44444444-4444-4444-8444-444444444444";
    fake.rpc.mockImplementation(async (name: string) => {
      if (name === "tr1_chatgpt_list_brands") return {
        data: [{ brand_id: brandId, brand_slug: "naali" }], error: null,
      };
      if (name === "tr1_chatgpt_pharmacy_summary") {
        return { data: { brand_pharmacy_id: relation }, error: null };
      }
      if (name === "tr1_chatgpt_priced_order_preview") {
        return { data: { items: [{ discount_rate: 35, free_quantity: 2 }], total_ht: 221.05 }, error: null };
      }
      throw new Error("Unexpected RPC " + name);
    });
    fake.adminFrom.mockImplementation((table: string) => ({
      select() { return this; },
      eq() { return this; },
      is() { return this; },
      async maybeSingle() {
        return { data: table === "brand_pharmacies"
          ? { brand_id: brandId, pharmacy_id: pharmacy }
          : { hubspot_synced_at: "2026-01-01T00:00:00Z" }, error: null };
      },
    }));
    const response = await POST(request("tools/call", {
      name: "preview_tr1_priced_order",
      arguments: { brand_pharmacy_id: relation, items: [{ product_id: product, quantity: 12 }] },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect((await response.json()).result.structuredContent.preview.total_ht).toBe(221.05);
    expect(fake.refreshPricing).toHaveBeenCalledWith(brandId, pharmacy);
    expect(fake.rpc).toHaveBeenCalledWith("tr1_chatgpt_priced_order_preview", expect.anything());
  });

  it("denies unauthorized priced previews before reading HubSpot or admin tables", async () => {
    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId, brand_slug: "naali" }], error: null }
      : { data: null, error: { code: "42501" } });
    const response = await POST(request("tools/call", {
      name: "preview_tr1_priced_order",
      arguments: {
        brand_pharmacy_id: "22222222-2222-4222-8222-222222222222",
        items: [{ product_id: "44444444-4444-4444-8444-444444444444", quantity: 12 }],
      },
    }, "oauth-token"));
    expect(response.status).toBe(403);
    expect(fake.createAdminClient).not.toHaveBeenCalled();
    expect(fake.refreshPricing).not.toHaveBeenCalled();
  });

  it("uses a recent trusted snapshot instead of reading HubSpot on every preview", async () => {
    const relation = "22222222-2222-4222-8222-222222222222";
    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId, brand_slug: "naali" }], error: null }
      : { data: { brand_pharmacy_id: relation }, error: null });
    fake.adminFrom.mockImplementation((table: string) => ({
      select() { return this; }, eq() { return this; }, is() { return this; },
      async maybeSingle() {
        return { data: table === "brand_pharmacies"
          ? { brand_id: brandId, pharmacy_id: "33333333-3333-4333-8333-333333333333" }
          : { hubspot_synced_at: new Date().toISOString() }, error: null };
      },
    }));
    const response = await POST(request("tools/call", {
      name: "preview_tr1_priced_order",
      arguments: { brand_pharmacy_id: relation,
        items: [{ product_id: "44444444-4444-4444-8444-444444444444", quantity: 12 }] },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect(fake.refreshPricing).not.toHaveBeenCalled();
  });

  it("passes an original pharmacy document number only to the scoped priced-draft RPC", async () => {
    const relation = "22222222-2222-4222-8222-222222222222";
    const pharmacy = "33333333-3333-4333-8333-333333333333";
    const product = "44444444-4444-4444-8444-444444444444";
    fake.rpc.mockImplementation(async (name: string) => {
      if (name === "tr1_chatgpt_list_brands") {
        return { data: [{ brand_id: brandId, brand_slug: "naali" }], error: null };
      }
      if (name === "tr1_chatgpt_pharmacy_summary") {
        return { data: { brand_pharmacy_id: relation }, error: null };
      }
      if (name === "tr1_chatgpt_create_priced_order_draft_with_reference") {
        return { data: { order_id: "55555555-5555-4555-8555-555555555555",
          status: "draft", source_order_number: "156589", transmitted: false }, error: null };
      }
      throw new Error("Unexpected RPC: " + name);
    });
    fake.adminFrom.mockImplementation((table: string) => ({
      select() { return this; }, eq() { return this; }, is() { return this; },
      async maybeSingle() {
        return { data: table === "brand_pharmacies"
          ? { brand_id: brandId, pharmacy_id: pharmacy }
          : { hubspot_synced_at: new Date().toISOString() }, error: null };
      },
    }));
    const response = await POST(request("tools/call", {
      name: "create_tr1_priced_order_draft",
      arguments: { brand_pharmacy_id: relation,
        items: [{ product_id: product, quantity: 12 }],
        order_type: "reorder",
        request_id: "66666666-6666-4666-8666-666666666666",
        source_order_number: "156589",
        confirmed: true },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect((await response.json()).result.structuredContent.draft).toMatchObject({
      status: "draft", source_order_number: "156589", transmitted: false,
    });
    expect(fake.rpc).toHaveBeenCalledWith(
      "tr1_chatgpt_create_priced_order_draft_with_reference",
      expect.objectContaining({ source_order_number: "156589", confirmed: true }),
    );
    expect(fake.refreshPricing).not.toHaveBeenCalled();
  });

  it("refuses to submit an unconfirmed priced order", async () => {
    const response = await POST(request("tools/call", {
      name: "submit_tr1_priced_order_to_hubspot",
      arguments: {
        order_id: "55555555-5555-4555-8555-555555555555",
        request_id: "66666666-6666-4666-8666-666666666666",
        review_token: "a".repeat(32),
      },
    }, "oauth-token"));
    expect((await response.json()).error.message).toContain("unconfirmed");
    expect(fake.deliverOrder).not.toHaveBeenCalled();
  });

  it("syncs only an explicitly reviewed, OAuth-scoped order", async () => {
    const orderId = "55555555-5555-4555-8555-555555555555";
    const requestId = "66666666-6666-4666-8666-666666666666";
    fake.rpc.mockImplementation(async (name: string) => {
      if (name === "tr1_chatgpt_list_brands") {
        return { data: [{ brand_id: brandId }], error: null };
      }
      if (name === "tr1_chatgpt_submit_priced_order") {
        return { data: { order_id: orderId, submitted: true, status: "pending" }, error: null };
      }
      throw new Error("Unexpected RPC " + name);
    });
    fake.adminFrom.mockImplementation((table: string) => ({
      select() { return this; }, eq() { return this; }, is() { return this; },
      async maybeSingle() {
        return { data: table === "orders" ? { brand_id: brandId } : null, error: null };
      },
    }));
    const response = await POST(request("tools/call", {
      name: "submit_tr1_priced_order_to_hubspot",
      arguments: {
        order_id: orderId, request_id: requestId,
        review_token: "a".repeat(32), confirmed: true,
      },
    }, "oauth-token"));
    const payload = await response.json();
    expect(payload.result.structuredContent.submission).toMatchObject({
      submitted: true, hubspot_synced: true, deal_id: "hubspot-deal-123",
    });
    expect(fake.deliverOrder).toHaveBeenCalledWith(brandId, orderId);
  });

  it("reports partial delivery without claiming that HubSpot was synced", async () => {
    const orderId = "55555555-5555-4555-8555-555555555555";
    fake.rpc.mockImplementation(async (name: string) => name === "tr1_chatgpt_list_brands"
      ? { data: [{ brand_id: brandId }], error: null }
      : { data: { order_id: orderId, submitted: true, status: "pending" }, error: null });
    fake.adminFrom.mockImplementation(() => ({
      select() { return this; }, eq() { return this; }, is() { return this; },
      async maybeSingle() { return { data: { brand_id: brandId }, error: null }; },
    }));
    fake.deliverOrder.mockRejectedValueOnce(new Error("HubSpot temporarily unreachable"));
    const response = await POST(request("tools/call", {
      name: "submit_tr1_priced_order_to_hubspot",
      arguments: {
        order_id: orderId,
        request_id: "66666666-6666-4666-8666-666666666666",
        review_token: "a".repeat(32), confirmed: true,
      },
    }, "oauth-token"));
    expect((await response.json()).result.structuredContent.submission).toMatchObject({
      submitted: true, hubspot_synced: false,
    });
  });


  it("allows a Black Friday preview through only its scoped read-only RPC", async () => {
    const items = [
      { product_id: product, quantity: 48, free_quantity: 6 },
      { product_id: "33333333-3333-4333-8333-333333333333", quantity: 12, free_quantity: 2 },
    ];
    fake.rpc.mockImplementation(async (name: string) =>
      name === "tr1_chatgpt_list_brands"
        ? { data: [{ brand_id: brandId, brand_slug: "naali" }], error: null }
        : name === "tr1_chatgpt_pharmacy_summary"
          ? { data: { name: "PRADEN" }, error: null }
          : name === "tr1_chatgpt_trade_preorder_preview"
            ? { data: { items, gift_total: 68, status: "preview" }, error: null }
            : { data: [], error: null });
    fake.adminFrom.mockImplementation((table: string) => ({
      select() { return this; }, eq() { return this; }, is() { return this; },
      async maybeSingle() {
        return { data: table === "brand_pharmacies"
          ? { brand_id: brandId, pharmacy_id: pharmacy }
          : { hubspot_synced_at: new Date().toISOString() }, error: null };
      },
    }));
    const response = await POST(request("tools/call", {
      name: "preview_tr1_black_friday_preorder",
      arguments: { brand_pharmacy_id: relation, items },
    }, "oauth-token"));
    expect(response.status).toBe(200);
    expect((await response.json()).result.structuredContent.preview.gift_total).toBe(68);
  });

  it("does not send an unreviewed Black Friday preorder", async () => {
    const response = await POST(request("tools/call", {
      name: "submit_tr1_black_friday_preorder_to_hubspot",
      arguments: { order_id: "55555555-5555-4555-8555-555555555555",
        request_id: "66666666-6666-4666-8666-666666666666",
        review_token: "a".repeat(32) },
    }, "oauth-token"));
    expect((await response.json()).error.message).toContain("unconfirmed");
    expect(fake.deliverOrder).not.toHaveBeenCalled();
  });
  it("rejects an untrusted origin", async () => {
    expect((await POST(request("tools/list", {}, "", { origin: "https://attacker.test" }))).status).toBe(403);
  });

  it("does not accept GET as a way to access sensitive data", async () => {
    expect((await GET()).status).toBe(405);
  });
});
