import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrandOnboardingAction, updateOnboardingSettingsAction } from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requirePlatformAdmin: mocks.requirePlatformAdmin }));
vi.mock("@/lib/runtime-environment", () => ({ resolveOnboardingRedirectUrl: vi.fn(() => "https://preview.example.com/auth/confirm") }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

describe("onboarding brand configuration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the explicit slug during brand creation", async () => {
    const rpc = vi.fn(async () => ({ data: [{ brand_id: "brand-1" }], error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc } });
    const formData = new FormData();
    formData.set("legalName", "VK Swiss SA");
    formData.set("countryCode", "CH");
    formData.set("currencyCode", "CHF");
    formData.set("timezone", "Europe/Zurich");
    formData.set("locale", "fr-CH");
    formData.set("brandName", "VK Swiss");
    formData.set("brandCode", "VK_SWISS");
    formData.set("brandSlug", "vk-swiss");
    formData.set("accentColor", "#123456");

    const result = await createBrandOnboardingAction({}, formData);

    expect(result).toEqual({ success: "Organisation et marque brouillon créées.", brandId: "brand-1" });
    expect(rpc).toHaveBeenCalledWith("create_brand_onboarding", expect.objectContaining({
      brand_data: expect.objectContaining({ slug: "vk-swiss" }),
    }));
  });

  it("passes brand operational fields through the canonical settings RPC", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc } });
    const formData = new FormData();
    formData.set("brandId", "00000000-0000-4000-8000-000000000001");
    formData.set("brandName", "VK Swiss");
    formData.set("brandCode", "VK_SWISS");
    formData.set("brandSlug", "vk-swiss");
    formData.set("logoPath", "https://assets.example.com/vk-swiss.svg");
    formData.set("countryCode", "CH");
    formData.set("currencyCode", "CHF");
    formData.set("timezone", "Europe/Zurich");
    formData.set("commercialEmail", "ops@vk-swiss.example");
    formData.set("orderEmail", "orders@vk-swiss.example");
    formData.set("phone", "+41225550123");
    formData.set("addressLine1", "1 rue du Lac");
    formData.set("postalCode", "1204");
    formData.set("city", "Genève");
    formData.set("description", "Marque pilote");
    formData.set("defaultReorderIntervalDays", "30");
    formData.set("firstReorderTargetDays", "45");
    formData.set("reorderDueSoonDays", "7");
    formData.set("atRiskMultiplier", "1.5");
    formData.set("dormantMultiplier", "2");
    formData.set("reorderEligibilityDays", "10");
    formData.set("postMissionFollowupDays", "14");

    await updateOnboardingSettingsAction(formData);

    expect(rpc).toHaveBeenCalledWith("update_onboarding_settings", expect.objectContaining({
      settings_data: expect.objectContaining({
        slug: "vk-swiss",
        logo_path: "https://assets.example.com/vk-swiss.svg",
        commercial_email: "ops@vk-swiss.example",
        order_email: "orders@vk-swiss.example",
        address_line_1: "1 rue du Lac",
        city: "Genève",
      }),
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/admin/onboarding");
  });
});
