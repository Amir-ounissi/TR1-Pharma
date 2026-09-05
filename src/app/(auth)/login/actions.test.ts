import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction } from "./actions";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

describe("loginAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks the membership of the authenticated user before selecting the platform dashboard", async () => {
    const membershipQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: null })),
    };
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.eq.mockReturnValue(membershipQuery);
    membershipQuery.is.mockReturnValue(membershipQuery);
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: vi.fn(async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } }, error: null })) },
      rpc: vi.fn(async () => ({ data: [], error: null })),
      from: vi.fn(() => membershipQuery),
    });
    const formData = new FormData();
    formData.set("email", "agent@dermavita.local");
    formData.set("password", "DemoTR1!2026");

    await expect(loginAction({}, formData)).rejects.toThrow("redirect");

    expect(membershipQuery.eq).toHaveBeenCalledWith("user_id", "00000000-0000-4000-8000-000000000001");
    expect(mocks.redirect).toHaveBeenCalledWith("/select-brand");
  });
});
