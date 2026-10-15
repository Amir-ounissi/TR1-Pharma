import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHubSpotOrderAfterPersistence } from "@/lib/integrations/hubspot/runtime";

type SyncEvent = {
  id: number;
  run_id: string;
  child_key: string | null;
  event_type: string;
  status: string;
  external_id: string | null;
};

/** Do not infer successful HubSpot delivery from a TR1 status change. */
export async function deliverChatGptOrder(brandId: string, orderId: string) {
  const admin = createAdminClient();
  const { data: lastEvent, error: cursorError } = await admin.from("connector_sync_events")
    .select("id").eq("brand_id", brandId).eq("entity_type", "orders")
    .eq("tr1_record_id", orderId).order("id", { ascending: false }).limit(1).maybeSingle();
  if (cursorError) throw new Error("HubSpot journal is unavailable");

  // Existing TR1 service is best effort. Its journal provides the actual
  // provider write result and enables safe retries with existing HubSpot IDs.
  await syncHubSpotOrderAfterPersistence(brandId, orderId);

  const { data: events, error } = await admin.from("connector_sync_events")
    .select("id,run_id,child_key,event_type,status,external_id")
    .eq("brand_id", brandId).eq("entity_type", "orders").eq("tr1_record_id", orderId)
    .gt("id", lastEvent?.id ?? 0).order("id", { ascending: false }).limit(250);
  if (error || !events?.length) return { hubspot_synced: false, reason: "No new HubSpot write journal" };

  const runId = String(events[0].run_id);
  const runEvents = (events as SyncEvent[]).filter((event) => event.run_id === runId);
  const { data: run, error: runError } = await admin.from("connector_sync_runs")
    .select("status").eq("id", runId).eq("brand_id", brandId).eq("entity_type", "orders").maybeSingle();
  if (runError || run?.status !== "succeeded" ||
    runEvents.some((event) => event.status !== "succeeded")) {
    return { hubspot_synced: false, reason: "HubSpot sync run failed or was incomplete" };
  }
  const parent = runEvents.find((event) => !event.child_key &&
    (event.event_type === "create" || event.event_type === "update") &&
    event.status === "succeeded" && event.external_id);
  if (!parent?.external_id || !runEvents.some((event) => !event.child_key &&
      event.event_type === "associate" && event.status === "succeeded")) {
    return { hubspot_synced: false, reason: "HubSpot deal/company association not verified" };
  }

  const { data: items, error: itemsError } = await admin.from("order_items")
    .select("id,quantity,free_quantity").eq("brand_id", brandId).eq("order_id", orderId);
  if (itemsError || !items?.length) return { hubspot_synced: false, reason: "Order lines unavailable" };

  const { data: allocations, error: allocationsError } = await admin
    .from("order_item_free_unit_allocations").select("order_item_id,source")
    .in("order_item_id", items.map((item) => item.id));
  if (allocationsError) return { hubspot_synced: false, reason: "UG classifications unavailable" };
  const allocationsByItem = new Map<string, string[]>();
  for (const allocation of allocations ?? []) {
    const key = String(allocation.order_item_id);
    allocationsByItem.set(key, [...(allocationsByItem.get(key) ?? []), String(allocation.source)]);
  }

  const keys = items.flatMap((item) => {
    const ugKeys = allocationsByItem.get(String(item.id)) ?? [];
    return [
      ...(Number(item.quantity) > 0 ? [String(item.id)] : []),
      ...(Number(item.free_quantity) > 0
        ? ugKeys.length > 1
          ? ugKeys.map((source) => `${item.id}:free:${source}`)
          : [`${item.id}:free`]
        : []),
    ];
  });
  for (const key of keys) {
    const written = runEvents.some((event) => event.child_key === key &&
      (event.event_type === "create" || event.event_type === "update") &&
      event.status === "succeeded" && event.external_id);
    const linked = runEvents.some((event) => event.child_key === key &&
      event.event_type === "associate" && event.status === "succeeded");
    if (!written || !linked) {
      return { hubspot_synced: false, reason: "HubSpot product lines not fully verified" };
    }
  }
  return { hubspot_synced: true, deal_id: parent.external_id };
}
