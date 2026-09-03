import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProductAction,
  updateProductAction,
} from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireActiveBrand: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  requireActiveBrand: mocks.requireActiveBrand,
}));

function validProductFormData() {
  const formData = new FormData();

  formData.set("name", "Produit test");
  formData.set("sku", "SKU-TEST");
  formData.set("ean", "3760000000001");
  formData.set("category", "Compléments alimentaires");
  formData.set("format", "30 gélules");
  formData.set("productFamily", "Vitalité");
  formData.set("strategicPriority", "strategic");
  formData.set("description", "Description");
  formData.set("wholesalePrice", "10.5");
  formData.set("retailPrice", "19.9");
  formData.set("taxRate", "5.5");
  formData.set("unitsPerCase", "6");
  formData.set("minimumOrderQuantity", "2");
  formData.set("pharmacyEligible", "on");
  formData.set("countsForDistribution", "on");

  return formData;
}

describe("product reference actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid VAT and logistics values", async () => {
    const formData = validProductFormData();

    formData.set("taxRate", "120");
    formData.set("unitsPerCase", "0");
    formData.set("minimumOrderQuantity", "-1");

    const result = await createProductAction({}, formData);

    expect(result).toEqual({ error: "Produit invalide." });
    expect(mocks.requireActiveBrand).not.toHaveBeenCalled();
  });

  it("persists the new catalog fields for a valid product", async () => {
    const insert = vi.fn(() => ({ error: null }));

    mocks.requireActiveBrand.mockResolvedValue({
      brand: {
        id: "brand-1",
        name: "Dermavita",
        slug: "dermavita",
      },
      supabase: {
        from: vi.fn(() => ({ insert })),
      },
    });

    const result = await createProductAction(
      {},
      validProductFormData(),
    );

    expect(result).toEqual({ success: "Produit créé." });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        description: "Description",
        tax_rate: 5.5,
        units_per_case: 6,
        minimum_order_quantity: 2,
        counts_for_distribution: true,
        strategic_priority: "strategic",
      }),
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/products",
    );
  });

  it("updates an existing product including PCB and MOQ", async () => {
    const finalEq = vi.fn(() => ({ error: null }));
    const firstEq = vi.fn(() => ({ eq: finalEq }));
    const update = vi.fn(() => ({ eq: firstEq }));

    mocks.requireActiveBrand.mockResolvedValue({
      brand: {
        id: "brand-1",
        name: "VK SWISS",
        slug: "vk-swiss",
      },
      supabase: {
        from: vi.fn(() => ({ update })),
      },
    });

    const formData = validProductFormData();

    formData.set(
      "id",
      "00000000-0000-4000-8000-000000000001",
    );
    formData.set("unitsPerCase", "12");
    formData.set("minimumOrderQuantity", "3");

    const result = await updateProductAction({}, formData);

    expect(result).toEqual({
      success: "Fiche produit mise à jour.",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        units_per_case: 12,
        minimum_order_quantity: 3,
        wholesale_price_ht: 10.5,
        retail_price_ttc: 19.9,
      }),
    );

    expect(firstEq).toHaveBeenCalledWith(
      "id",
      "00000000-0000-4000-8000-000000000001",
    );

    expect(finalEq).toHaveBeenCalledWith(
      "brand_id",
      "brand-1",
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/products",
    );
  });

  it("rejects an invalid product update before touching the database", async () => {
    const formData = validProductFormData();

    formData.set(
      "id",
      "00000000-0000-4000-8000-000000000001",
    );
    formData.set("minimumOrderQuantity", "0");

    const result = await updateProductAction({}, formData);

    expect(result).toEqual({ error: "Produit invalide." });
    expect(mocks.requireActiveBrand).not.toHaveBeenCalled();
  });
});
