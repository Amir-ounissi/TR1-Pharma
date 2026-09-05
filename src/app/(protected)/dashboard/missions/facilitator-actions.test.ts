import { beforeEach, describe, expect, it, vi } from "vitest";
import { proposeAnimationBatchAction } from "./facilitator-actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  requireCompletedOnboarding: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({
  requireCompletedOnboarding: mocks.requireCompletedOnboarding,
}));
vi.mock("@/lib/agenda", () => ({
  parisLocalToIso: (value: string) => `${value}:00+02:00`,
}));

describe("proposeAnimationBatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: [
        "10000000-0000-0000-0000-000000000001",
        "10000000-0000-0000-0000-000000000002",
      ],
      error: null,
    });
    mocks.requireCompletedOnboarding.mockResolvedValue({
      supabase: { rpc: mocks.rpc },
    });
  });

  it("sends several animations in one atomic RPC", async () => {
    const formData = new FormData();
    formData.set(
      "animationsJson",
      JSON.stringify([
        {
          brandPharmacyId: "00000000-0000-0000-0000-000000000401",
          scheduledStartAt: "2026-09-15T10:00",
          scheduledEndAt: "2026-09-15T18:00",
        },
        {
          brandPharmacyId: "00000000-0000-0000-0000-000000000402",
          scheduledStartAt: "2026-09-16T10:00",
          scheduledEndAt: "2026-09-16T18:00",
        },
      ]),
    );

    await expect(proposeAnimationBatchAction({}, formData)).resolves.toEqual({
      success: "2 animations envoyées aux marques pour validation.",
      created: 2,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("propose_animation_batch", {
      animation_payload: [
        {
          brand_pharmacy_id: "00000000-0000-0000-0000-000000000401",
          scheduled_start_at: "2026-09-15T10:00:00+02:00",
          scheduled_end_at: "2026-09-15T18:00:00+02:00",
        },
        {
          brand_pharmacy_id: "00000000-0000-0000-0000-000000000402",
          scheduled_start_at: "2026-09-16T10:00:00+02:00",
          scheduled_end_at: "2026-09-16T18:00:00+02:00",
        },
      ],
    });
  });

  it("rejects an invalid time range before calling Supabase", async () => {
    const formData = new FormData();
    formData.set(
      "animationsJson",
      JSON.stringify([
        {
          brandPharmacyId: "00000000-0000-0000-0000-000000000401",
          scheduledStartAt: "2026-09-15T18:00",
          scheduledEndAt: "2026-09-15T10:00",
        },
      ]),
    );

    await expect(proposeAnimationBatchAction({}, formData)).resolves.toEqual({
      error: "L’heure de fin doit être après l’heure de début.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
