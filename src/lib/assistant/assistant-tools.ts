import { createFieldService } from "../field-service";
import { pharmacyMatchSchema, type PharmacyMatch } from "./assistant-schemas";

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
export type AssistantRpcClient = {
  rpc<T = unknown>(name: string, parameters?: Record<string, unknown>): RpcResult<T>;
  from(name: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        gt(column: string, value: string): {
          maybeSingle(): RpcResult<Record<string, unknown>>;
        };
      };
    };
  };
};

async function unwrap<T>(result: RpcResult<T>) {
  const { data, error } = await result;
  if (error) throw new Error(error.message);
  return data;
}

export const ASSISTANT_TOOL_ALLOWLIST = [
  "search_pharmacies",
  "get_pharmacy_summary",
  "get_next_visit",
  "get_today_agenda",
  "get_recent_interactions",
  "prepare_interaction",
  "prepare_task",
  "prepare_interaction_with_next_action",
  "confirm_draft",
  "cancel_draft",
] as const;

export function createAssistantTools(client: AssistantRpcClient) {
  const field = createFieldService(client);
  return {
    async searchPharmacies(brandId: string, query: string): Promise<PharmacyMatch[]> {
      const rows = await field.searchPharmacies(brandId, query);
      return pharmacyMatchSchema.array().parse(rows ?? []);
    },
    getPharmacySummary: field.getPharmacySummary,
    getNextVisit: field.getNextVisit,
    getTodayAgenda: field.getToday,
    getRecentInteractions(brandPharmacyId: string) {
      return unwrap(client.rpc("get_recent_authorized_interactions", {
        target_brand_pharmacy_id: brandPharmacyId,
        result_limit: 5,
      }));
    },
    createDraft(parameters: Record<string, unknown>) {
      return unwrap(client.rpc("create_assistant_draft", parameters));
    },
    updateDraft(parameters: Record<string, unknown>) {
      return unwrap(client.rpc("update_assistant_draft", parameters));
    },
    confirmDraft(draftId: string) {
      return unwrap(client.rpc("confirm_assistant_draft", { target_draft_id: draftId }));
    },
    cancelDraft(draftId: string) {
      return unwrap(client.rpc("cancel_assistant_draft", { target_draft_id: draftId }));
    },
    setContext(parameters: Record<string, unknown>) {
      return unwrap(client.rpc("set_assistant_context", parameters));
    },
    clearContext(brandId: string) {
      return unwrap(client.rpc("clear_assistant_context", { target_brand_id: brandId }));
    },
    recordAudit(parameters: Record<string, unknown>) {
      return unwrap(client.rpc("record_assistant_audit", parameters));
    },
    trackEvent(parameters: Record<string, unknown>) {
      return field.trackEvent(parameters);
    },
    async getContext(brandId: string) {
      const result = await client.from("assistant_contexts")
        .select("active_pharmacy_id,active_brand_pharmacy_id,last_intent,pending_draft_id,expires_at")
        .eq("brand_id", brandId)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  };
}
