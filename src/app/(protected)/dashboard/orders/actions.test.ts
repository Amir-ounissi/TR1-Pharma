import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireActiveBrand: vi.fn(),
  getBrandContexts: vi.fn(),
  syncHubSpotOrderAfterPersistence: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireActiveBrand: mocks.requireActiveBrand, getBrandContexts: mocks.getBrandContexts }));
vi.mock("@/lib/integrations/hubspot/runtime", () => ({ syncHubSpotOrderAfterPersistence: mocks.syncHubSpotOrderAfterPersistence }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { changeOrderStatusAction, createOrderAction, deleteDraftOrderAction } from "./actions";

const relationId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";

describe("order server actions", () => {
  const rpc = vi.fn();
  const productQuery = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.syncHubSpotOrderAfterPersistence.mockResolvedValue(undefined);
    mocks.createAdminClient.mockReturnValue({ from: vi.fn() });
    rpc.mockResolvedValue({ data: [{ order_id: "33333333-3333-4333-8333-333333333333", brand_pharmacy_id: relationId }], error: null });
    const productResult = { in: async () => ({ data: [{ id: productId, tax_rate: 5.5 }], error: null }) };
    const productScope: { eq: () => typeof productScope; is: () => typeof productResult } = { eq: () => productScope, is: () => productResult };
    productQuery.mockReturnValue({ select: () => productScope });
    mocks.requireActiveBrand.mockResolvedValue({ brand: { id: "brand-id" }, supabase: { rpc, from: productQuery } });
    mocks.getBrandContexts.mockResolvedValue([{ id: "brand-id", role: "brand_admin" }]);
  });

  it("rejects malformed order data before database access", async () => {
    expect(await createOrderAction({}, new FormData())).toEqual({ error: "La commande ou ses lignes sont invalides." });
    expect(mocks.requireActiveBrand).not.toHaveBeenCalled();
  });

  it("delegates order creation and lines to the SQL RPC and syncs a validated order", async () => {
    const formData = new FormData();
    Object.entries({ brandPharmacyId: relationId, pharmacyId: "", orderType: "other", orderStatus: "confirmed", orderDate: "2026-07-21T10:00", shippingAmountHt: "0", paymentStatus: "pending", productId, quantity: "2", freeQuantity: "1", unitPriceHt: "10", discountRate: "5", taxRate: "20" }).forEach(([key,value]) => formData.append(key,value));
    expect(await createOrderAction({}, formData)).toEqual({ success: "Commande créée et indicateurs recalculés.", orderId: "33333333-3333-4333-8333-333333333333" });
    expect(rpc).toHaveBeenCalledWith("create_order_with_pharmacy_resolution", expect.objectContaining({ target_brand_id: "brand-id", target_brand_pharmacy_id: relationId, target_pharmacy_id: null, item_payload: [expect.objectContaining({ product_id: productId, quantity: 2, tax_rate: 5.5 })] }));
    expect(mocks.syncHubSpotOrderAfterPersistence).toHaveBeenCalledWith("brand-id", "33333333-3333-4333-8333-333333333333");
  });

  it("resolves a global pharmacy through the transactional order RPC without syncing a draft", async () => {
    const formData = new FormData();
    Object.entries({ brandPharmacyId: "", pharmacyId: "44444444-4444-4444-8444-444444444444", orderType: "other", orderStatus: "draft", orderDate: "2026-07-21T10:00", shippingAmountHt: "0", paymentStatus: "pending", productId, quantity: "1", freeQuantity: "0", unitPriceHt: "10" }).forEach(([key, value]) => formData.append(key, value));
    await createOrderAction({}, formData);
    expect(rpc).toHaveBeenCalledWith("create_order_with_pharmacy_resolution", expect.objectContaining({ target_brand_pharmacy_id: null, target_pharmacy_id: "44444444-4444-4444-8444-444444444444" }));
    expect(mocks.syncHubSpotOrderAfterPersistence).not.toHaveBeenCalled();
  });

  it("blocks a financial status for an agent before creating the order", async () => {
    mocks.getBrandContexts.mockResolvedValue([{ id: "brand-id", role: "agent" }]);
    const formData = new FormData();
    Object.entries({ brandPharmacyId: relationId, pharmacyId: "", orderType: "other", orderStatus: "invoiced", orderDate: "2026-07-21T10:00", shippingAmountHt: "0", paymentStatus: "pending", productId, quantity: "1", freeQuantity: "0", unitPriceHt: "10" }).forEach(([key, value]) => formData.append(key, value));
    await expect(createOrderAction({}, formData)).resolves.toEqual({ error: "Une commande agent doit être enregistrée en brouillon ou envoyée à la marque." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks order creation for a read-only brand user", async () => {
    mocks.getBrandContexts.mockResolvedValue([{ id: "brand-id", role: "brand_user" }]);

    const formData = new FormData();
    Object.entries({
      brandPharmacyId: relationId,
      pharmacyId: "",
      orderType: "other",
      orderStatus: "draft",
      orderDate: "2026-07-21T10:00",
      shippingAmountHt: "0",
      productId,
      quantity: "1",
      freeQuantity: "0",
      unitPriceHt: "10",
    }).forEach(([key, value]) => formData.append(key, value));

    await expect(createOrderAction({}, formData)).resolves.toEqual({
      error: "Votre rôle ne permet pas de créer une commande.",
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns SQL authorization errors without masking them", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Brand pharmacy unavailable" } });
    const formData = new FormData();
    Object.entries({ brandPharmacyId: relationId, pharmacyId: "", orderType: "other", orderStatus: "draft", orderDate: "2026-07-21T10:00", shippingAmountHt: "0", paymentStatus: "pending", productId, quantity: "1", freeQuantity: "0", unitPriceHt: "10", taxRate: "20" }).forEach(([key,value]) => formData.append(key,value));
    expect(await createOrderAction({}, formData)).toEqual({ error: "Brand pharmacy unavailable" });
  });

  it("soft-deletes an unsent draft after cancelling it through the protected workflow", async () => {
    const orderId = "33333333-3333-4333-8333-333333333333";
    const orderChain: any = {};
    orderChain.select = vi.fn(() => orderChain);
    orderChain.eq = vi.fn(() => orderChain);
    orderChain.maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: orderId,
        brand_id: "brand-id",
        created_by: "user-id",
        order_status: "draft",
        archived_at: null,
      },
      error: null,
    });

    const transmissionChain: any = {};
    transmissionChain.select = vi.fn(() => transmissionChain);
    transmissionChain.eq = vi.fn(() => transmissionChain);
    transmissionChain.limit = vi.fn(() => transmissionChain);
    transmissionChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    const archiveChain: any = {};
    archiveChain.update = vi.fn(() => archiveChain);
    archiveChain.eq = vi.fn(() => archiveChain);
    archiveChain.is = vi.fn().mockResolvedValue({ error: null });

    mocks.requireActiveBrand.mockResolvedValue({
      brand: { id: "brand-id" },
      userId: "user-id",
      supabase: {
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        from: vi.fn((table: string) => table === "orders" ? orderChain : productQuery()),
      },
    });
    mocks.getBrandContexts.mockResolvedValue([{ id: "brand-id", role: "agent" }]);
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === "order_email_transmissions" ? transmissionChain : archiveChain,
      ),
    });

    const formData = new FormData();
    formData.set("orderId", orderId);

    await expect(deleteDraftOrderAction({}, formData)).resolves.toEqual({
      success: "Brouillon supprimé.",
    });
    expect(archiveChain.update).toHaveBeenCalledWith({
      archived_at: expect.any(String),
    });
  });

  it("changes status through the protected RPC and asks the connector to resync", async () => {
    const formData = new FormData();
    formData.set("orderId", "33333333-3333-4333-8333-333333333333");
    formData.set("orderStatus", "cancelled");
    formData.set("reason", "Erreur de saisie");
    expect(await changeOrderStatusAction({}, formData)).toEqual({ success: "Statut de commande mis à jour." });
    expect(rpc).toHaveBeenCalledWith("change_order_status", expect.objectContaining({ target_status: "cancelled", reason: "Erreur de saisie" }));
    expect(mocks.syncHubSpotOrderAfterPersistence).toHaveBeenCalledWith("brand-id", "33333333-3333-4333-8333-333333333333");
  });
});
