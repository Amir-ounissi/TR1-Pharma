import { beforeEach, describe, expect, it, vi } from "vitest";
import { signUpAction } from "./actions";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveOnboardingRedirectUrl: vi.fn(() => "https://preview.example.com/auth/confirm?next=/onboarding"),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/runtime-environment", () => ({
  resolveOnboardingRedirectUrl: mocks.resolveOnboardingRedirectUrl,
}));

describe("signUpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts an agent signup when non-relevant optional fields are absent", async () => {
    const signUp = vi.fn(async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000001" }, session: null }, error: null }));
    mocks.createClient.mockResolvedValue({ auth: { signUp } });

    const formData = new FormData();
    formData.set("fullName", "Amir Ounissi");
    formData.set("email", "amir.agent@example.com");
    formData.set("password", "TestVKSwiss!2026");
    formData.set("confirmPassword", "TestVKSwiss!2026");
    formData.set("profileType", "agent");
    formData.set("currentOrganization", "VK Swiss");
    formData.set("territory", "Suisse romande");

    const result = await signUpAction({}, formData);

    expect(result.error).toBeUndefined();
    expect(result.success).toMatch(/pharmacies/i);
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "amir.agent@example.com",
      options: expect.objectContaining({
        data: expect.objectContaining({
          requested_profile_type: "agent",
          requested_access: expect.objectContaining({
            type: "agent",
            organization: "VK Swiss",
            territory: "Suisse romande",
          }),
        }),
      }),
    }));
  });

  it("accepts a multiskill facilitator signup", async () => {
    const signUp = vi.fn(async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000002" }, session: null }, error: null }));
    mocks.createClient.mockResolvedValue({ auth: { signUp } });

    const formData = new FormData();
    formData.set("fullName", "Sonia Leroy");
    formData.set("email", "sonia.facilitator@example.com");
    formData.set("password", "TestVKSwiss!2026");
    formData.set("confirmPassword", "TestVKSwiss!2026");
    formData.set("profileType", "facilitator");
    formData.append("facilitatorActivities", "animation");
    formData.append("facilitatorActivities", "training");

    const result = await signUpAction({}, formData);

    expect(result.error).toBeUndefined();
    expect(result.success).toMatch(/intervenant|activités/i);
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "sonia.facilitator@example.com",
      options: expect.objectContaining({
        data: expect.objectContaining({
          requested_profile_type: "facilitator",
          requested_access: {
            type: "facilitator",
            activities: ["animation", "training"],
            facilitator_kind: "mixte",
          },
        }),
      }),
    }));
  });

  it("rejects a facilitator signup without an activity before creating a Supabase client", async () => {
    const formData = new FormData();
    formData.set("fullName", "Sonia Leroy");
    formData.set("email", "sonia.facilitator@example.com");
    formData.set("password", "TestVKSwiss!2026");
    formData.set("confirmPassword", "TestVKSwiss!2026");
    formData.set("profileType", "facilitator");

    const result = await signUpAction({}, formData);

    expect(result.error).toMatch(/activité/i);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns a user error without creating a Supabase client when the redirect URL is invalid", async () => {
    const signUp = vi.fn();
    const configurationError = new Error("Invalid authentication redirect configuration");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.resolveOnboardingRedirectUrl.mockImplementationOnce(() => {
      throw configurationError;
    });
    mocks.createClient.mockResolvedValue({ auth: { signUp } });

    const formData = new FormData();
    formData.set("fullName", "Amir Ounissi");
    formData.set("email", "amir.agent@example.com");
    formData.set("password", "TestVKSwiss!2026");
    formData.set("confirmPassword", "TestVKSwiss!2026");
    formData.set("profileType", "agent");
    formData.set("currentOrganization", "VK Swiss");
    formData.set("territory", "Suisse romande");

    await expect(signUpAction({}, formData)).resolves.toEqual({
      error: "La création de compte est momentanément indisponible. Contactez l’administrateur TR1.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Configuration de redirection d’authentification invalide pour le signup.",
      configurationError,
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
