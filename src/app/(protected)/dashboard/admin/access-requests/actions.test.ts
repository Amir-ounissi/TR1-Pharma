import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveAccessRequestAction, rejectAccessRequestAction } from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requirePlatformAdmin: mocks.requirePlatformAdmin }));

describe("access request review actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves an agent only with the selected brand and pharmacy scope", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc } });
    const formData = new FormData();
    formData.set("requestId", "00000000-0000-4000-8000-000000000001");
    formData.set("targetBrandId", "00000000-0000-4000-8000-000000000002");
    formData.append("pharmacyIds", "00000000-0000-4000-8000-000000000003");

    const result = await approveAccessRequestAction({}, formData);

    expect(result.success).toMatch(/accès activé/i);
    expect(rpc).toHaveBeenCalledWith("approve_access_request", {
      target_request_id: "00000000-0000-4000-8000-000000000001",
      target_brand_id: "00000000-0000-4000-8000-000000000002",
      selected_brand_pharmacy_ids: ["00000000-0000-4000-8000-000000000003"],
      review_note: null,
    });
  });

  it("allows an agent to be activated without an initial pharmacy assignment", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc } });
    const formData = new FormData();
    formData.set("requestId", "00000000-0000-4000-8000-000000000001");
    formData.set("targetBrandId", "00000000-0000-4000-8000-000000000002");

    const result = await approveAccessRequestAction({}, formData);

    expect(result.success).toMatch(/accès activé/i);
    expect(rpc).toHaveBeenCalledWith("approve_access_request", {
      target_request_id: "00000000-0000-4000-8000-000000000001",
      target_brand_id: "00000000-0000-4000-8000-000000000002",
      selected_brand_pharmacy_ids: [],
      review_note: null,
    });
  });

  it("requires a specific rejection reason", async () => {
    const formData = new FormData();
    formData.set("requestId", "00000000-0000-4000-8000-000000000001");
    formData.set("reviewerNote", "");

    const result = await rejectAccessRequestAction({}, formData);

    expect(result.error).toMatch(/motif/i);
    expect(mocks.requirePlatformAdmin).not.toHaveBeenCalled();
  });
});
