import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProductAction } from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireActiveBrand: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireActiveBrand: mocks.requireActiveBrand }));

describe("createProductAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid VAT and logistics values", async () => {
    const formData = new FormData();
    formData.set("name", "Produit test");
    formData.set("sku", "SKU-TEST");
    formData.set("strategicPriority", "standard");
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
      brand: { id: "brand-1", name: "Dermavita", slug: "dermavita" },
      supabase: { from: vi.fn(() => ({ insert })) },
    });

    const formData = new FormData();
    formData.set("name", "Produit test");
    formData.set("sku", "SKU-TEST");
    formData.set("ean", "");
    formData.set("category", "");
    formData.set("format", "");
    formData.set("productFamily", "");
    formData.set("strategicPriority", "strategic");
    formData.set("description", "Description");
    formData.set("wholesalePrice", "10.5");
    formData.set("retailPrice", "19.9");
    formData.set("taxRate", "5.5");
    formData.set("unitsPerCase", "6");
    formData.set("minimumOrderQuantity", "2");
    formData.set("pharmacyEligible", "on");
    formData.set("countsForDistribution", "on");

    const result = await createProductAction({}, formData);

    expect(result).toEqual({ success: "Produit créé." });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      brand_id: "brand-1",
      description: "Description",
      tax_rate: 5.5,
      units_per_case: 6,
      minimum_order_quantity: 2,
      counts_for_distribution: true,
      strategic_priority: "strategic",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/products");
  });
});
