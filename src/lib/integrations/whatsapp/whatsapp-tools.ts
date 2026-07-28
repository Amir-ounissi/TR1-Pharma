import type { SupabaseClient } from "@supabase/supabase-js";
import { createAssistantEngine } from "../../assistant/assistant-engine";
import { assistantDraftSchema, pharmacyMatchSchema } from "../../assistant/assistant-schemas";

async function execute(admin: SupabaseClient, eventId: string, tool: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await admin.rpc("execute_whatsapp_assistant_tool", {
    target_event_id: eventId,
    target_tool: tool,
    target_payload: payload,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getWhatsAppBrandContexts(admin: SupabaseClient, eventId: string) {
  return await execute(admin, eventId, "get_brand_contexts") as Array<{ brand_id: string; brand_name: string }>;
}

export async function getWhatsAppPendingDraft(admin: SupabaseClient, eventId: string) {
  return await execute(admin, eventId, "get_pending_draft") as Record<string, unknown> | null;
}

export function createWhatsAppAssistantEngine(admin: SupabaseClient, eventId: string) {
  const tools = {
    async searchPharmacies(brandId: string, query: string) {
      return pharmacyMatchSchema.array().parse(await execute(admin,eventId,"search_authorized_pharmacies",{target_brand_id:brandId,search_text:query,result_limit:20}));
    },
    getPharmacySummary: (id: string) => execute(admin,eventId,"get_field_pharmacy_summary",{target_brand_pharmacy_id:id}),
    getNextVisit: (brandId: string) => execute(admin,eventId,"get_next_agent_visit",{target_brand_id:brandId}),
    getTodayAgenda: (brandId: string, targetDate: string) => execute(admin,eventId,"get_agent_today",{target_brand_id:brandId,target_date:targetDate}),
    getRecentInteractions: (id: string) => execute(admin,eventId,"get_recent_authorized_interactions",{target_brand_pharmacy_id:id}),
    createDraft: async (payload: Record<string, unknown>) => assistantDraftSchema.parse(await execute(admin,eventId,"create_assistant_draft",payload)),
    setContext: (payload: Record<string, unknown>) => execute(admin,eventId,"set_assistant_context",payload),
    getContext: (brandId: string) => execute(admin,eventId,"get_assistant_context",{target_brand_id:brandId}) as Promise<Record<string, unknown>|null>,
    recordAudit: (payload: Record<string, unknown>) => execute(admin,eventId,"record_assistant_audit",payload),
    trackEvent: (payload: Record<string, unknown>) => execute(admin,eventId,"track_product_event",payload),
  };
  return createAssistantEngine(tools);
}

export function executeWhatsAppTool(admin: SupabaseClient, eventId: string, tool: string, payload: Record<string, unknown>) {
  return execute(admin,eventId,tool,payload);
}

