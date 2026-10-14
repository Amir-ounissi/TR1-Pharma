import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHubSpotOrderAfterPersistence } from "@/lib/integrations/hubspot/runtime";

export async function deliverChatGptOrder(brandId: string, orderId: string) {
  const admin = createAdminClient();
  await syncHubSpotOrderAfterPersistence(brandId, orderId);
  const { data: link, error } = await admin.from("connector_external_links")
    .select("external_id").eq("brand_id", brandId)
    .eq("entity_type", "orders").eq("tr1_record_id", orderId)
    .maybeSingle();
  if (error) throw new Error("Unable to check HubSpot deal");
  return { dealId: link?.external_id ?? null };
}
