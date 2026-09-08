import { beforeEach, expect, it, vi } from "vitest";
import { createFieldVisitAction } from "./actions";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth", () => ({ requireCompletedOnboarding: async () => ({ supabase: { rpc: mocks.rpc } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
});

function form(duration?: string) {
  const data = new FormData();
  data.set("pharmacyId", "00000000-0000-4000-8000-000000000001");
  data.append("brandPharmacyId", "00000000-0000-4000-8000-000000000002");
  data.set("visitKind", "client_visit");
  data.set("title", "Rendez-vous client");
  data.set("startAt", "2026-09-10T23:30");
  if (duration) data.set("duration", duration);
  return data;
}

it("creates a one-hour visit by default without an explicit end field", async () => {
  expect(await createFieldVisitAction({}, form())).toHaveProperty("success");
  expect(mocks.rpc).toHaveBeenCalledWith("create_field_visit", expect.objectContaining({
    visit_payload: expect.objectContaining({
      scheduled_start_at: "2026-09-10T21:30:00.000Z",
      scheduled_end_at: "2026-09-10T22:30:00.000Z",
    }),
  }));
  expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard/agenda");
});

it("uses the chosen duration", async () => {
  await createFieldVisitAction({}, form("90"));
  expect(mocks.rpc.mock.calls[0][1].visit_payload.scheduled_end_at).toBe("2026-09-10T23:00:00.000Z");
});

it("rejects an invalid duration before writing", async () => {
  expect(await createFieldVisitAction({}, form("-30"))).toHaveProperty("error");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
