import { beforeEach, describe, expect, it, vi } from "vitest";
import { returnToPlatformAdministrationAction } from "./actions";

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookies: vi.fn(),
  isPlatformAdmin: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  ACTIVE_BRAND_COOKIE: "tr1_active_brand",
  isPlatformAdmin: mocks.isPlatformAdmin,
  requireUser: vi.fn(),
}));

describe("dashboard actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPlatformAdmin.mockResolvedValue(true);
    mocks.cookies.mockResolvedValue({ delete: mocks.cookieDelete });
  });

  it("returns a superadmin directly to the global dashboard", async () => {
    await returnToPlatformAdministrationAction();

    expect(mocks.cookieDelete).toHaveBeenCalledWith("tr1_active_brand");
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
