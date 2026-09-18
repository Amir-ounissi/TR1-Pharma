import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeOnboardingAction } from "./actions";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));

const invitedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  invited_at: "2026-09-01T10:00:00.000Z",
};

function formData(password = "InviteTR1!2026", confirmPassword = password) {
  const data = new FormData();
  data.set("fullName", "Marie Invitée");
  data.set("password", password);
  data.set("confirmPassword", confirmPassword);
  return data;
}

function buildProfileQuery() {
  const query = { eq: vi.fn(async () => ({ error: null })) };
  return { update: vi.fn(() => query), query };
}

describe("completeOnboardingAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes a confirmed brand signup into autonomous setup after completing the personal profile", async () => {
    const profile = buildProfileQuery();
    const selfServiceUser = {
      id: "00000000-0000-4000-8000-000000000009",
      invited_at: null,
      user_metadata: { requested_profile_type: "brand" },
    };
    const rpc = vi.fn();

    mocks.requireUser.mockResolvedValue({
      userId: selfServiceUser.id,
      supabase: {
        auth: { getUser: vi.fn(async () => ({ data: { user: selfServiceUser }, error: null })) },
        from: vi.fn(() => profile),
        rpc,
      },
    });

    await expect(completeOnboardingAction({}, formData())).rejects.toThrow("redirect");

    expect(profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Marie Invitée",
        onboarding_completed_at: expect.any(String),
      }),
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/setup");
  });

  it("sets the invited password and activates the invitation without an admin client", async () => {
    const profile = buildProfileQuery();
    const updateUser = vi.fn(async () => ({ error: null }));
    const rpc = vi.fn(async (name: string) => {
      if (name === "get_my_brand_contexts") return { data: [], error: null };
      if (name === "accept_my_invited_memberships") return { data: 1, error: null };
      return { data: null, error: null };
    });

    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: invitedUser }, error: null })),
          updateUser,
        },
        from: vi.fn(() => profile),
        rpc,
      },
    });

    await expect(completeOnboardingAction({}, formData())).rejects.toThrow("redirect");

    expect(updateUser).toHaveBeenCalledWith({ password: "InviteTR1!2026" });
    expect(rpc).toHaveBeenCalledWith("accept_my_invited_memberships");
    expect(profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Marie Invitée",
        onboarding_completed_at: expect.any(String),
      }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/select-brand");
  });

  it("does not ask for another password when an invited user already has an active brand context", async () => {
    const profile = buildProfileQuery();
    const updateUser = vi.fn(async () => ({ error: null }));
    const rpc = vi.fn(async (name: string) => {
      if (name === "get_my_brand_contexts") {
        return {
          data: [
            {
              brand_id: "00000000-0000-4000-8000-000000000010",
              brand_name: "Naali",
              brand_slug: "naali",
              role_key: "agent",
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: invitedUser }, error: null })),
          updateUser,
        },
        from: vi.fn(() => profile),
        rpc,
      },
    });

    await expect(completeOnboardingAction({}, formData("", ""))).rejects.toThrow("redirect");

    expect(updateUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("accept_my_invited_memberships");
    expect(profile.update).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/select-brand");
  });

  it("does not complete the profile when no tenant invitation exists", async () => {
    const profile = buildProfileQuery();
    const rpc = vi.fn(async (name: string) => {
      if (name === "get_my_brand_contexts") return { data: [], error: null };
      if (name === "accept_my_invited_memberships") return { data: 0, error: null };
      return { data: null, error: null };
    });

    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: invitedUser }, error: null })),
          updateUser: vi.fn(async () => ({ error: null })),
        },
        from: vi.fn(() => profile),
        rpc,
      },
    });

    await expect(completeOnboardingAction({}, formData())).resolves.toEqual({
      error:
        "Aucun accès de marque invité n’a été trouvé pour ce compte. Contactez votre administrateur TR1.",
    });

    expect(profile.update).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
