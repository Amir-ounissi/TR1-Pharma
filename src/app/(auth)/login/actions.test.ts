import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction } from "./actions";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
  cookieStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => mocks.cookieStore) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieStore.get.mockReturnValue(undefined);
  });

  it("activates an accessible brand in the login action before landing on the role workspace", async () => {
    const membershipQuery = {
      data: [{ brand_id: "00000000-0000-4000-8000-000000000010", roles: { key: "agent" } }],
      select: vi.fn(),
      eq: vi.fn(),
    };
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.eq.mockReturnValue(membershipQuery);

    const accessRequestQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: null })),
    };
    accessRequestQuery.select.mockReturnValue(accessRequestQuery);
    accessRequestQuery.eq.mockReturnValue(accessRequestQuery);

    const rpc = vi.fn(async (name: string) => {
      if (name === "get_my_self_service_onboarding") return { data: [], error: null };
      if (name === "get_my_brand_contexts") {
        return {
          data: [{
            brand_id: "00000000-0000-4000-8000-000000000010",
            brand_name: "Dermavita",
            brand_slug: "dermavita",
            role_key: "agent",
          }],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
          error: null,
        })),
      },
      rpc,
      from: vi.fn((table: string) => table === "memberships" ? membershipQuery : accessRequestQuery),
    });

    const formData = new FormData();
    formData.set("email", "agent@dermavita.local");
    formData.set("password", "DemoTR1!2026");

    await expect(loginAction({}, formData)).rejects.toThrow("redirect");

    expect(membershipQuery.eq).toHaveBeenCalledWith("user_id", "00000000-0000-4000-8000-000000000001");
    expect(rpc).toHaveBeenCalledWith("get_my_brand_contexts");
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      "tr1_active_brand",
      "00000000-0000-4000-8000-000000000010",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/agent");
  });
});
