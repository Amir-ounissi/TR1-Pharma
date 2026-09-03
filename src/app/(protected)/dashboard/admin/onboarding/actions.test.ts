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
    const from = vi.fn(() => createLookupQuery(null));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc, from } });
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

  it("blocks creation with a clear error when the organization slug already exists", async () => {
    const rpc = vi.fn();
    const from = vi.fn((table: string) =>
      createLookupQuery(table === "organizations" ? { id: "organization-1" } : null),
    );
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc, from } });
    const formData = createOnboardingFormData();

    await expect(createBrandOnboardingAction({}, formData)).resolves.toEqual({
      error: "Une organisation ou une marque avec ce slug existe déjà. Reprenez son onboarding existant au lieu d’en créer un nouveau.",
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks creation with a clear error when the brand slug already exists", async () => {
    const rpc = vi.fn();
    const from = vi.fn((table: string) =>
      createLookupQuery(table === "brands" ? { id: "brand-1" } : null),
    );
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc, from } });

    await expect(createBrandOnboardingAction({}, createOnboardingFormData())).resolves.toEqual({
      error: "Une organisation ou une marque avec ce slug existe déjà. Reprenez son onboarding existant au lieu d’en créer un nouveau.",
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a concurrent duplicate constraint to the same business error", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }));
    const from = vi.fn(() => createLookupQuery(null));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc, from } });

    await expect(createBrandOnboardingAction({}, createOnboardingFormData())).resolves.toEqual({
      error: "Une organisation ou une marque avec ce slug existe déjà. Reprenez son onboarding existant au lieu d’en créer un nouveau.",
    });

    expect(rpc).toHaveBeenCalledOnce();
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

function createLookupQuery(data: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function createOnboardingFormData() {
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
  return formData;
}
