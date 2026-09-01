import { describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  requirePlatformAdmin: vi.fn(),
}));

describe("platform users page access", () => {
  it("refuses non-superadmins through the platform guard", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    const { requirePlatformAdmin } = await import("./auth");
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(redirectError);

    const { loadPlatformUsersPageData } = await import("./platform-admin-page");
    await expect(loadPlatformUsersPageData()).rejects.toThrow("NEXT_REDIRECT");
  });
});
