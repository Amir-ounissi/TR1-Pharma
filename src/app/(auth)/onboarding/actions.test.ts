import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeOnboardingAction } from "./actions";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createAdminClient: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

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

function buildAdmin(memberships: Array<{ id: string; status: "invited" | "active" }>) {
  const selectQuery = {
    eq: vi.fn(),
    not: vi.fn(),
    in: vi.fn(async () => ({ data: memberships, error: null })),
  };
  selectQuery.eq.mockReturnValue(selectQuery);
  selectQuery.not.mockReturnValue(selectQuery);

  const updateQuery = {
    eq: vi.fn(),
    not: vi.fn(),
  };
  updateQuery.eq.mockReturnValue(updateQuery);
  updateQuery.not.mockReturnValue(updateQuery);
  updateQuery.eq.mockImplementationOnce(() => updateQuery).mockImplementationOnce(async () => ({ error: null }));

  const membershipTable = {
    select: vi.fn(() => selectQuery),
    update: vi.fn(() => updateQuery),
  };
  return { from: vi.fn(() => membershipTable), membershipTable, updateQuery };
}

describe("completeOnboardingAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets the invited password before activating only tenant memberships", async () => {
    const profile = buildProfileQuery();
    const updateUser = vi.fn(async () => ({ error: null }));
    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: {
        auth: { getUser: vi.fn(async () => ({ data: { user: invitedUser }, error: null })), updateUser },
        from: vi.fn(() => profile),
      },
    });
    const admin = buildAdmin([{ id: "tenant-membership", status: "invited" }]);
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(completeOnboardingAction({}, formData())).rejects.toThrow("redirect");

    expect(updateUser).toHaveBeenCalledWith({ password: "InviteTR1!2026" });
    expect(admin.from).toHaveBeenCalledWith("memberships");
    expect(admin.membershipTable.update).toHaveBeenCalledWith({ status: "active" });
    expect(profile.update).toHaveBeenCalledWith(expect.objectContaining({ full_name: "Marie Invitée", onboarding_completed_at: expect.any(String) }));
    expect(mocks.redirect).toHaveBeenCalledWith("/select-brand");
  });

  it("keeps an already active tenant membership idempotent while finishing the profile", async () => {
    const profile = buildProfileQuery();
    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: invitedUser }, error: null })),
          updateUser: vi.fn(async () => ({ error: null })),
        },
        from: vi.fn(() => profile),
      },
    });
    const admin = buildAdmin([{ id: "tenant-membership", status: "active" }]);
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(completeOnboardingAction({}, formData())).rejects.toThrow("redirect");

    expect(profile.update).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/select-brand");
  });

  it("does not complete the profile when no tenant invitation exists", async () => {
    const profile = buildProfileQuery();
    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: invitedUser }, error: null })),
          updateUser: vi.fn(async () => ({ error: null })),
        },
        from: vi.fn(() => profile),
      },
    });
    mocks.createAdminClient.mockReturnValue(buildAdmin([]));

    await expect(completeOnboardingAction({}, formData())).resolves.toEqual({
      error: "Aucun accès de marque invité n’a été trouvé pour ce compte. Contactez votre administrateur TR1.",
    });

    expect(profile.update).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
