import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn(), requireActiveBrand: vi.fn(), getBrandContexts: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireActiveBrand: mocks.requireActiveBrand, getBrandContexts: mocks.getBrandContexts }));

import { changeOrderStatusAction, createOrderAction } from "./actions";

const relationId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";

describe("order server actions", () => {
  const rpc = vi.fn();
  const productQuery = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("delegates order creation and lines to the SQL RPC", async () => {
    const formData = new FormData();
    Object.entries({ brandPharmacyId: relationId, pharmacyId: "", orderType: "other", orderStatus: "invoiced", orderDate: "2026-07-21T10:00", shippingAmountHt: "0", paymentStatus: "pending", productId, quantity: "2", freeQuantity: "1", unitPriceHt: "10", discountRate: "5", taxRate: "20" }).forEach(([key,value]) => formData.append(key,value));
    expect(await createOrderAction({}, formData)).toEqual({ success: "Commande créée et indicateurs recalculés.", orderId: "33333333-3333-4333-8333-333333333333" });
    expect(rpc).toHaveBeenCalledWith("create_order_with_pharmacy_resolution", expect.objectContaining({ target_brand_id: "brand-id", target_brand_pharmacy_id: relationId, target_pharmacy_id: null, item_payload: [expect.objectContaining({ product_id: productId, quantity: 2, tax_rate: 5.5 })] }));
  });

  it("resolves a global pharmacy through the transactional order RPC", async () => {
    const formData = new FormData();
    Object.entries({ brandPharmacyId: "", pharmacyId: "44444444-4444-4444-8444-444444444444", orderType: "other", orderStatus: "draft", orderDate: "2026-07-21T10:00", shippingAmountHt: "0", paymentStatus: "pending", productId, quantity: "1", freeQuantity: "0", unitPriceHt: "10" }).forEach(([key, value]) => formData.append(key, value));
    await createOrderAction({}, formData);
    expect(rpc).toHaveBeenCalledWith("create_order_with_pharmacy_resolution", expect.objectContaining({ target_brand_pharmacy_id: null, target_pharmacy_id: "44444444-4444-4444-8444-444444444444" }));
  });

  it("blocks a financial status for an agent before creating the order", async () => {
    mocks.getBrandContexts.mockResolvedValue([{ id: "brand-id", role: "agent" }]);
    const formData = new FormData();
    Object.entries({ brandPharmacyId: relationId, pharmacyId: "", orderType: "other", orderStatus: "invoiced", orderDate: "2026-07-21T10:00", shippingAmountHt: "0", paymentStatus: "pending", productId, quantity: "1", freeQuantity: "0", unitPriceHt: "10" }).forEach(([key, value]) => formData.append(key, value));
    await expect(createOrderAction({}, formData)).resolves.toEqual({ error: "Un agent ne peut pas déclarer une commande facturée ou livrée." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns SQL authorization errors without masking them", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Brand pharmacy unavailable" } });
    const formData = new FormData();
    Object.entries({ brandPharmacyId: relationId, pharmacyId: "", orderType: "other", orderStatus: "draft", orderDate: "2026-07-21T10:00", shippingAmountHt: "0", paymentStatus: "pending", productId, quantity: "1", freeQuantity: "0", unitPriceHt: "10", taxRate: "20" }).forEach(([key,value]) => formData.append(key,value));
    expect(await createOrderAction({}, formData)).toEqual({ error: "Brand pharmacy unavailable" });
  });

  it("changes status through the protected RPC", async () => {
    const formData = new FormData();
    formData.set("orderId", "33333333-3333-4333-8333-333333333333");
    formData.set("orderStatus", "cancelled");
    formData.set("reason", "Erreur de saisie");
    expect(await changeOrderStatusAction({}, formData)).toEqual({ success: "Statut de commande mis à jour." });
    expect(rpc).toHaveBeenCalledWith("change_order_status", expect.objectContaining({ target_status: "cancelled", reason: "Erreur de saisie" }));
  });
});
