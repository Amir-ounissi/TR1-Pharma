type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type FieldRpcClient = {
  rpc<T = unknown>(name: string, parameters: Record<string, unknown>): RpcResult<T>;
};

async function unwrap<T>(result: RpcResult<T>) {
  const { data, error } = await result;
  if (error) throw new Error(error.message);
  return data;
}

export function createFieldService(client: FieldRpcClient) {
  return {
    searchPharmacies(brandId: string, query: string) {
      return unwrap(client.rpc("search_authorized_pharmacies", {
        target_brand_id: brandId,
        search_text: query,
        result_limit: 20,
      }));
    },
    getPharmacySummary(brandPharmacyId: string) {
      return unwrap(client.rpc("get_field_pharmacy_summary", {
        target_brand_pharmacy_id: brandPharmacyId,
      }));
    },
    getNextVisit(brandId: string) {
      return unwrap(client.rpc("get_next_agent_visit", { target_brand_id: brandId }));
    },
    getToday(brandId: string, date: string) {
      return unwrap(client.rpc("get_agent_today", { target_brand_id: brandId, target_date: date }));
    },
    createInteraction(parameters: Record<string, unknown>) {
      return unwrap(client.rpc("create_commercial_interaction", parameters));
    },
    createTask(parameters: Record<string, unknown>) {
      return unwrap(client.rpc("create_agent_task", parameters));
    },
    trackEvent(parameters: Record<string, unknown>) {
      return unwrap(client.rpc("track_product_event", parameters));
    },
  };
}
