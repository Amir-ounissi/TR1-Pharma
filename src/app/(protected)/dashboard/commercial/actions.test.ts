import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn(), requireActiveBrand: vi.fn() }));
const { requireActiveBrand } = mocks;

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireActiveBrand: mocks.requireActiveBrand }));

import { assignAccountAction, changeStatusAction, createInteractionAction, createTaskAction } from "./actions";

const brandId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const brandPharmacyId = "33333333-3333-4333-8333-333333333333";

describe("commercial server actions", () => {
  const insert = vi.fn();
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: null });
    requireActiveBrand.mockResolvedValue({
      brand: { id: brandId },
      userId,
      supabase: { from: vi.fn(() => ({ insert })), rpc },
    });
  });

  it("rejects malformed task data before querying the database", async () => {
    expect(await createTaskAction({}, new FormData())).toEqual({ error: "La tâche est invalide." });
    expect(requireActiveBrand).not.toHaveBeenCalled();
  });

  it("creates a brand-scoped task through the authenticated context", async () => {
    const formData = new FormData();
    Object.entries({ brandPharmacyId, taskType: "follow_up", title: "Relancer la pharmacie", priority: "normal", assignedTo: userId }).forEach(([key, value]) => formData.set(key, value));

    expect(await createTaskAction({}, formData)).toEqual({ success: "Tâche créée et prochaine action recalculée." });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ brand_id: brandId, brand_pharmacy_id: brandPharmacyId, assigned_to: userId, created_by: userId }));
  });

  it("delegates status changes to the protected RPC", async () => {
    const formData = new FormData();
    formData.set("brandPharmacyId", brandPharmacyId);
    formData.set("status", "qualified");

    expect(await changeStatusAction({}, formData)).toEqual({ success: "Statut modifié et historique créé." });
    expect(rpc).toHaveBeenCalledWith("change_brand_pharmacy_status", expect.objectContaining({ target_brand_pharmacy_id: brandPharmacyId, target_status: "qualified" }));
  });

  it("delegates assignments to the transactional RPC", async () => {
    const formData = new FormData();
    Object.entries({ brandPharmacyId, userId, assignmentType: "commercial_agent", reason: "Rééquilibrage" }).forEach(([key, value]) => formData.set(key, value));

    expect(await assignAccountAction({}, formData)).toEqual({ success: "Compte réattribué, ancien responsable clôturé." });
    expect(rpc).toHaveBeenCalledWith("assign_brand_pharmacy", expect.objectContaining({ target_brand_pharmacy_id: brandPharmacyId, target_user_id: userId }));
  });

  it("creates interactions through the atomic interaction RPC", async () => {
    const formData = new FormData();
    Object.entries({ brandPharmacyId, interactionType: "call", outcome: "completed", subject: "Compte rendu", visibility: "shared", occurredAt: "2026-07-20T10:00" }).forEach(([key, value]) => formData.set(key, value));

    expect(await createInteractionAction({}, formData)).toEqual({ success: "Interaction enregistrée." });
    expect(rpc).toHaveBeenCalledWith("create_commercial_interaction", expect.objectContaining({ target_brand_pharmacy_id: brandPharmacyId, target_visibility: "shared" }));
  });
});
