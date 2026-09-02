import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveAgentAccessRequestAction, approveBrandAccessRequestAction, rejectAccessRequestAction } from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requirePlatformAdmin: mocks.requirePlatformAdmin }));

describe("access request review actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves a brand only on the explicit matched brand", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: approvedBrandRequestClient(rpc) });
    const formData = new FormData();
    formData.set("requestId", "00000000-0000-4000-8000-000000000001");
    formData.set("targetBrandId", "00000000-0000-4000-8000-000000000002");
    const result = await approveBrandAccessRequestAction({}, formData);

    expect(result.success).toMatch(/administrateur/i);
    expect(rpc).toHaveBeenCalledWith("approve_access_request", {
      target_request_id: "00000000-0000-4000-8000-000000000001",
      target_brand_id: "00000000-0000-4000-8000-000000000002",
      selected_brand_pharmacy_ids: [],
      review_note: null,
    });
  });

  it("approves an agent only with an explicit brand and territory", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc } });
    const formData = new FormData();
    formData.set("requestId", "00000000-0000-4000-8000-000000000001");
    formData.set("targetBrandId", "00000000-0000-4000-8000-000000000002");
    formData.set("targetTerritoryId", "00000000-0000-4000-8000-000000000003");

    const result = await approveAgentAccessRequestAction({}, formData);

    expect(result.success).toMatch(/territoire/i);
    expect(rpc).toHaveBeenCalledWith("approve_access_request_with_territory", {
      target_request_id: "00000000-0000-4000-8000-000000000001",
      target_brand_id: "00000000-0000-4000-8000-000000000002",
      target_territory_id: "00000000-0000-4000-8000-000000000003",
      review_note: null,
    });
  });

  it("rejects an agent approval without a territory before calling the RPC", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: { rpc } });
    const formData = new FormData();
    formData.set("requestId", "00000000-0000-4000-8000-000000000001");
    formData.set("targetBrandId", "00000000-0000-4000-8000-000000000002");

    const result = await approveAgentAccessRequestAction({}, formData);

    expect(result.error).toMatch(/marque et un territoire/i);
    expect(mocks.requirePlatformAdmin).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not let the brand action approve an agent request", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({
      supabase: {
        rpc,
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { requested_profile_type: "agent" }, error: null })) })),
            })),
          })),
        })),
      },
    });
    const formData = new FormData();
    formData.set("requestId", "00000000-0000-4000-8000-000000000001");
    formData.set("targetBrandId", "00000000-0000-4000-8000-000000000002");

    const result = await approveBrandAccessRequestAction({}, formData);

    expect(result.error).toMatch(/ne peut pas recevoir/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not let the brand action substitute a different brand", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    mocks.requirePlatformAdmin.mockResolvedValue({ supabase: approvedBrandRequestClient(rpc, { name: "Another brand", status: "active", is_active: true }) });
    const formData = new FormData();
    formData.set("requestId", "00000000-0000-4000-8000-000000000001");
    formData.set("targetBrandId", "00000000-0000-4000-8000-000000000002");

    const result = await approveBrandAccessRequestAction({}, formData);

    expect(result.error).toMatch(/ne correspond pas/i);
    expect(rpc).not.toHaveBeenCalled();
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

function approvedBrandRequestClient(
  rpc: ReturnType<typeof vi.fn>,
  brand = { name: "VK Swiss", status: "active", is_active: true },
) {
  return {
    rpc,
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => table === "access_requests"
          ? ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { requested_profile_type: "brand", requested_access: { company_name: "  vk   swiss " } }, error: null })) })) })
          : ({ maybeSingle: vi.fn(async () => ({ data: brand, error: null })) })),
      })),
    })),
  };
}
