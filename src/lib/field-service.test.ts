import { describe, expect, it, vi } from "vitest";
import { createFieldService } from "./field-service";

describe("field service", () => {
  it("uses secured RPCs instead of direct table writes", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const service = createFieldService({ rpc });
    await service.searchPharmacies("brand-a", "Paris");
    await service.createTask({ target_brand_pharmacy_id: "relation-a" });
    expect(rpc).toHaveBeenNthCalledWith(1, "search_authorized_pharmacies", expect.objectContaining({ target_brand_id: "brand-a" }));
    expect(rpc).toHaveBeenNthCalledWith(2, "create_agent_task", expect.any(Object));
  });

  it("propagates permission errors", async () => {
    const service = createFieldService({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } }) });
    await expect(service.getPharmacySummary("other-tenant")).rejects.toThrow("forbidden");
  });
});
