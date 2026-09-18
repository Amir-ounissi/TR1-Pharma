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

function profileTable() {
  const query = { eq: vi.fn(async () => ({ error: null })) };
  return { update: vi.fn(() => query), query };
}

function membershipTable(rows: Array<{ id: string; status: "invited" | "active" }>) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    in: vi.fn(async () => ({ data: rows, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.not.mockReturnValue(query);
  return query;
}

function makeSupabase({
  user,
  memberships = [],
  activatedCount = 1,
}: {
  user: typeof invitedUser | { id: string; invited_at: null; user_metadata?: Record<string, string> };
  memberships?: Array<{ id: string; status: "invited" | "active" }>;
  activatedCount?: number;
}) {
  const profile = profileTable();
  const membership = membershipTable(memberships);
  const updateUser = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async (name: string) => {
    if (name === "accept_my_invited_memberships") return { data: activatedCount, error: null };
    return { data: null, error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === "user_profiles") return profile;
    if (table === "memberships") return membership;
    throw new Error(`unexpected table ${table}`);
  });

  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user }, error: null })),
        updateUser,
      },
      from,
      rpc,
    },
    profile,
    membership,
    updateUser,
    rpc,
  };
}

describe("completeOnboardingAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes a confirmed brand signup into autonomous setup after completing the personal profile", async () => {
    const selfServiceUser = {
      id: "00000000-0000-4000-8000-000000000009",
      invited_at: null,
      user_metadata: { requested_profile_type: "brand" },
    };
    const ctx = makeSupabase({ user: selfServiceUser });
    mocks.requireUser.mockResolvedValue({
      userId: selfServiceUser.id,
      supabase: ctx.supabase,
    });

    await expect(completeOnboardingAction({}, formData())).rejects.toThrow("redirect");

    expect(ctx.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Marie Invitée",
        onboarding_completed_at: expect.any(String),
      }),
    );
    expect(ctx.membership.select).not.toHaveBeenCalled();
    expect(ctx.rpc).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/setup");
  });

  it("sets the invited password and activates the tenant invitation", async () => {
    const ctx = makeSupabase({
      user: invitedUser,
      memberships: [{ id: "tenant-membership", status: "invited" }],
      activatedCount: 1,
    });
    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: ctx.supabase,
    });

    await expect(completeOnboardingAction({}, formData())).rejects.toThrow("redirect");

    expect(ctx.updateUser).toHaveBeenCalledWith({ password: "InviteTR1!2026" });
    expect(ctx.rpc).toHaveBeenCalledWith("accept_my_invited_memberships");
    expect(ctx.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Marie Invitée",
        onboarding_completed_at: expect.any(String),
      }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/select-brand");
  });

  it("does not ask for another password after recovery when the membership is already active", async () => {
    const ctx = makeSupabase({
      user: invitedUser,
      memberships: [{ id: "tenant-membership", status: "active" }],
    });
    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: ctx.supabase,
    });

    await expect(completeOnboardingAction({}, formData("", ""))).rejects.toThrow("redirect");

    expect(ctx.updateUser).not.toHaveBeenCalled();
    expect(ctx.rpc).not.toHaveBeenCalled();
    expect(ctx.profile.update).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/select-brand");
  });

  it("does not complete the profile when no tenant invitation exists", async () => {
    const ctx = makeSupabase({
      user: invitedUser,
      memberships: [],
      activatedCount: 0,
    });
    mocks.requireUser.mockResolvedValue({
      userId: invitedUser.id,
      supabase: ctx.supabase,
    });

    await expect(completeOnboardingAction({}, formData())).resolves.toEqual({
      error:
        "Aucun accès de marque invité n’a été trouvé pour ce compte. Contactez votre administrateur TR1.",
    });

    expect(ctx.updateUser).not.toHaveBeenCalled();
    expect(ctx.profile.update).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
