import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, rpc, createClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  const rpc = vi.fn();
  return { getUser, rpc, createClient: vi.fn(() => ({ auth: { getUser }, rpc })) };
});

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseEnv: () => ({
    url: "https://example.supabase.co",
    publishableKey: "test-publishable-key",
  }),
}));

import { GET } from "./route";

const brandId = "11111111-1111-4111-8111-111111111111";
const endpoint = "https://tr1.test/api/connectors/chatgpt/pharmacies";

function request(params = `q=Valentine&brand_id=${brandId}`, token = "test-user-token") {
  return new Request(`${endpoint}?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("ChatGPT pharmacy connector: authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    rpc.mockImplementation(async (name: string) => {
      if (name === "get_my_brand_contexts") {
        return { data: [{ brand_id: brandId }], error: null };
      }
      return { data: [{ pharmacy_name: "Grande Pharmacie de la Valentine" }], error: null };
    });
  });

  it("rejects missing bearer tokens", async () => {
    const response = await GET(request(undefined, ""));
    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects malformed input before database access", async () => {
    const response = await GET(request("q=a&brand_id=not-a-uuid"));
    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects invalid user tokens", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects brands outside the authenticated user's membership", async () => {
    rpc.mockResolvedValueOnce({ data: [{ brand_id: "22222222-2222-4222-8222-222222222222" }], error: null });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("queries only the authorized brand with a bounded result limit", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(rpc).toHaveBeenCalledWith("search_authorized_pharmacies", {
      target_brand_id: brandId,
      search_text: "Valentine",
      result_limit: 10,
    });
    expect(await response.json()).toEqual({
      pharmacies: [{ pharmacy_name: "Grande Pharmacie de la Valentine" }],
    });
  });

  it("fails closed if brand membership cannot be verified", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
