import "server-only";

import type { ConnectorEntityType } from "@/lib/connectors";
import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient, type HubSpotClientMode } from "./client";
import { assertHubSpotBrandConfiguration, type HubSpotMeetingSyncInput, type HubSpotNoteSyncInput, type HubSpotOrderSyncInput } from "./model";
import { NAALI_HUBSPOT_CONFIGURATION } from "./naali";
import {
  syncHubSpotNote,
  syncHubSpotOrder,
  syncHubSpotVisit,
  type HubSpotExternalLinkStore,
  type HubSpotSyncEvent,
  type HubSpotSyncJournal,
} from "./sync";

type HubSpotRuntimeEntity = Extract<ConnectorEntityType, "orders" | "visits" | "notes">;

type HubSpotConnection = {
  id: string;
  base_url: string | null;
  credential_reference: string | null;
};

function syncMode(): HubSpotClientMode {
  const requested = process.env.TR1_HUBSPOT_MODE?.trim().toLowerCase();
  if (requested === "dry_run") return "dry_run";
  if (requested === "write" && process.env.TR1_HUBSPOT_WRITE_ENABLED === "true") return "write";
  return "disabled";
}

function accessToken(connection: HubSpotConnection, mode: HubSpotClientMode) {
  if (mode !== "write") return null;
  const reference = connection.credential_reference?.trim();
  if (reference && /^[A-Z][A-Z0-9_]*$/.test(reference)) {
    return process.env[reference] ?? null;
  }
  return process.env.HUBSPOT_ACCESS_TOKEN ?? null;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown HubSpot runtime error";
}

async function findConnection(admin: ReturnType<typeof createAdminClient>, brandId: string, entityType: HubSpotRuntimeEntity) {
  const { data: connection, error: connectionError } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference")
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) return null;

  const { data: mapping, error: mappingError } = await admin
    .from("connector_entity_mappings")
    .select("id")
    .eq("connection_id", connection.id)
    .eq("entity_type", entityType)
    .eq("is_enabled", true)
    .in("direction", ["outbound", "bidirectional"])
    .limit(1)
    .maybeSingle();
  if (mappingError) throw mappingError;
  if (!mapping) return null;

  return connection as HubSpotConnection;
}

async function externalIdFor(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  entityType: ConnectorEntityType,
  tr1RecordId: string,
) {
  const { data, error } = await admin
    .from("connector_external_links")
    .select("external_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", entityType)
    .eq("tr1_record_id", tr1RecordId)
    .maybeSingle();
  if (error) throw error;
  return data?.external_id ? String(data.external_id) : null;
}

function createLinkStore(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  entityType: HubSpotRuntimeEntity,
): HubSpotExternalLinkStore {
  return {
    async getParent(tr1RecordId) {
      const externalId = await externalIdFor(admin, connectionId, entityType, tr1RecordId);
      return externalId ? { externalId } : null;
    },
    async saveParent(tr1RecordId, externalId) {
      const { error } = await admin.rpc("upsert_connector_external_link", {
        target_connection_id: connectionId,
        target_entity_type: entityType,
        target_external_id: externalId,
        target_tr1_record_id: tr1RecordId,
        target_external_updated_at: null,
        target_tr1_updated_at: null,
        target_sync_hash: null,
      });
      if (error) throw error;
    },
    async getChild(parentTr1RecordId, childKey) {
      const { data, error } = await admin
        .from("connector_external_child_links")
        .select("external_id")
        .eq("connection_id", connectionId)
        .eq("parent_entity_type", entityType)
        .eq("parent_tr1_record_id", parentTr1RecordId)
        .eq("child_type", "line_item")
        .eq("child_key", childKey)
        .maybeSingle();
      if (error) throw error;
      return data?.external_id ? { externalId: String(data.external_id) } : null;
    },
    async saveChild(parentTr1RecordId, childKey, externalId) {
      const { error } = await admin.rpc("upsert_connector_external_child_link", {
        target_connection_id: connectionId,
        target_parent_entity_type: entityType,
        target_parent_tr1_record_id: parentTr1RecordId,
        target_child_type: "line_item",
        target_child_key: childKey,
        target_external_id: externalId,
        target_external_updated_at: null,
        target_sync_hash: null,
      });
      if (error) throw error;
    },
  };
}

function createJournal(
  admin: ReturnType<typeof createAdminClient>,
  runId: string,
  connectionId: string,
  entityType: HubSpotRuntimeEntity,
): HubSpotSyncJournal {
  return {
    async record(event: HubSpotSyncEvent) {
      const { error } = await admin.rpc("record_connector_sync_event", {
        target_run_id: runId,
        target_connection_id: connectionId,
        target_entity_type: entityType,
        target_tr1_record_id: event.tr1RecordId,
        target_child_key: event.childKey ?? null,
        target_event_type: event.eventType,
        target_status: event.status,
        target_attempt: 1,
        target_external_id: event.externalId ?? null,
        target_provider_status: event.providerStatus ?? null,
        target_provider_request_id: event.providerRequestId ?? null,
        target_error_code: event.errorCode ?? null,
        target_error_message: event.errorMessage ?? null,
        target_metadata: {},
      });
      if (error) throw error;
    },
  };
}

async function openRun(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  entityType: HubSpotRuntimeEntity,
) {
  const { data, error } = await admin.rpc("register_connector_sync_run", {
    target_connection_id: connectionId,
    target_entity_type: entityType,
    target_direction: "outbound",
    target_cursor_before: null,
  });
  if (error || !data) throw error ?? new Error("HubSpot sync run was not created");
  return String(data);
}

async function closeRun(
  admin: ReturnType<typeof createAdminClient>,
  runId: string,
  status: "succeeded" | "failed",
  errorSummary?: string,
) {
  const failed = status === "failed" ? 1 : 0;
  const { error } = await admin.rpc("complete_connector_sync_run", {
    target_run_id: runId,
    target_status: status,
    target_records_seen: 1,
    target_records_succeeded: failed ? 0 : 1,
    target_records_failed: failed,
    target_cursor_after: null,
    target_error_summary: errorSummary ?? null,
  });
  if (error) throw error;
}

async function withRuntime(
  brandId: string,
  entityType: HubSpotRuntimeEntity,
  execute: (options: {
    admin: ReturnType<typeof createAdminClient>;
    client: HubSpotClient;
    connection: HubSpotConnection;
    links: HubSpotExternalLinkStore;
    journal: HubSpotSyncJournal;
  }) => Promise<void>,
) {
  const admin = createAdminClient();
  const connection = await findConnection(admin, brandId, entityType);
  if (!connection) return;

  assertHubSpotBrandConfiguration(NAALI_HUBSPOT_CONFIGURATION);
  const mode = syncMode();
  const client = new HubSpotClient({
    mode,
    accessToken: accessToken(connection, mode),
    baseUrl: connection.base_url ?? undefined,
  });
  const runId = await openRun(admin, connection.id, entityType);
  const links = createLinkStore(admin, connection.id, entityType);
  const journal = createJournal(admin, runId, connection.id, entityType);

  try {
    await execute({ admin, client, connection, links, journal });
    await closeRun(admin, runId, "succeeded");
  } catch (error) {
    const message = safeError(error);
    try {
      await closeRun(admin, runId, "failed", message);
    } catch {
      // The business write already succeeded; a connector journal failure must remain isolated.
    }
    throw error;
  }
}

async function bestEffort(label: string, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error(`[hubspot] ${label} sync failed: ${safeError(error)}`);
  }
}

export async function syncHubSpotOrderAfterPersistence(brandId: string, orderId: string) {
  await bestEffort(`order:${orderId}`, async () => {
    await withRuntime(brandId, "orders", async ({ admin, client, connection, links, journal }) => {
      const { data: order, error: orderError } = await admin
        .from("orders")
        .select("id,brand_id,pharmacy_id,order_number,external_order_id,order_status,order_date,net_amount_ht,tax_amount,total_ttc,currency_code,source_user_id,created_by")
        .eq("id", orderId)
        .eq("brand_id", brandId)
        .is("archived_at", null)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order || !NAALI_HUBSPOT_CONFIGURATION.order.syncStatuses.includes(String(order.order_status))) return;

      const { data: items, error: itemsError } = await admin
        .from("order_items")
        .select("id,product_id,product_name_snapshot,sku_snapshot,quantity,free_quantity,unit_price_ht,discount_rate,tax_rate")
        .eq("order_id", orderId)
        .eq("brand_id", brandId);
      if (itemsError) throw itemsError;

      const ownerTr1UserId = order.source_user_id || order.created_by ? String(order.source_user_id || order.created_by) : null;
      const ownerExternalId = ownerTr1UserId
        ? await externalIdFor(admin, connection.id, "users", ownerTr1UserId)
        : null;
      if (ownerTr1UserId && !ownerExternalId) {
        throw new Error(`HubSpot owner mapping missing for TR1 user ${ownerTr1UserId}`);
      }

      const payload: HubSpotOrderSyncInput = {
        id: String(order.id),
        orderNumber: String(order.order_number || order.external_order_id || order.id),
        status: String(order.order_status),
        orderDate: String(order.order_date),
        netAmountHt: Number(order.net_amount_ht),
        taxAmount: Number(order.tax_amount),
        amountTtc: Number(order.total_ttc),
        currency: String(order.currency_code || "EUR"),
        ownerExternalId,
        lines: (items ?? []).map((item) => ({
          id: String(item.id),
          productId: String(item.product_id),
          name: String(item.product_name_snapshot),
          sku: item.sku_snapshot ? String(item.sku_snapshot) : null,
          quantity: Number(item.quantity),
          freeQuantity: Number(item.free_quantity ?? 0),
          unitPriceHt: Number(item.unit_price_ht),
          discountPercent: item.discount_rate === null ? null : Number(item.discount_rate),
          vatRate: item.tax_rate === null ? null : Number(item.tax_rate),
        })),
      };
      const pharmacyExternalId = order.pharmacy_id
        ? await externalIdFor(admin, connection.id, "pharmacies", String(order.pharmacy_id))
        : null;

      await syncHubSpotOrder({
        client,
        config: NAALI_HUBSPOT_CONFIGURATION,
        order: payload,
        pharmacyExternalId,
        links,
        journal,
      });
    });
  });
}

export async function syncHubSpotVisitAfterPersistence(brandId: string, visitId: string) {
  await bestEffort(`visit:${visitId}`, async () => {
    await withRuntime(brandId, "visits", async ({ admin, client, connection, links, journal }) => {
      const { data: visit, error: visitError } = await admin
        .from("field_visits")
        .select("id,pharmacy_id,status,title,scheduled_start_at,scheduled_end_at,actual_start_at,actual_end_at")
        .eq("id", visitId)
        .is("archived_at", null)
        .maybeSingle();
      if (visitError) throw visitError;
      if (!visit || visit.status !== "completed") return;

      const { data: relation, error: relationError } = await admin
        .from("brand_pharmacies")
        .select("id")
        .eq("brand_id", brandId)
        .eq("pharmacy_id", visit.pharmacy_id)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle();
      if (relationError) throw relationError;
      if (!relation) return;

      const payload: HubSpotMeetingSyncInput = {
        id: String(visit.id),
        title: String(visit.title || "Visite terrain"),
        startAt: String(visit.actual_start_at || visit.scheduled_start_at),
        endAt: (visit.actual_end_at || visit.scheduled_end_at) ? String(visit.actual_end_at || visit.scheduled_end_at) : null,
        outcome: "COMPLETED",
      };
      const pharmacyExternalId = await externalIdFor(admin, connection.id, "pharmacies", String(visit.pharmacy_id));

      await syncHubSpotVisit({
        client,
        config: NAALI_HUBSPOT_CONFIGURATION,
        visit: payload,
        pharmacyExternalId,
        links,
        journal,
      });
    });
  });
}

export async function syncHubSpotNoteAfterPersistence(brandId: string, interactionId: string) {
  await bestEffort(`note:${interactionId}`, async () => {
    await withRuntime(brandId, "notes", async ({ admin, client, connection, links, journal }) => {
      const { data: interaction, error: interactionError } = await admin
        .from("interactions")
        .select("id,brand_id,brand_pharmacy_id,subject,notes,occurred_at,interaction_type")
        .eq("id", interactionId)
        .eq("brand_id", brandId)
        .is("archived_at", null)
        .maybeSingle();
      if (interactionError) throw interactionError;
      if (!interaction || interaction.interaction_type !== "internal_note") return;

      let pharmacyId: string | null = null;
      if (interaction.brand_pharmacy_id) {
        const { data: relation, error: relationError } = await admin
          .from("brand_pharmacies")
          .select("pharmacy_id")
          .eq("id", interaction.brand_pharmacy_id)
          .eq("brand_id", brandId)
          .is("archived_at", null)
          .maybeSingle();
        if (relationError) throw relationError;
        pharmacyId = relation?.pharmacy_id ? String(relation.pharmacy_id) : null;
      }

      const subject = String(interaction.subject || "Note terrain");
      const notes = interaction.notes ? String(interaction.notes).trim() : "";
      const payload: HubSpotNoteSyncInput = {
        id: String(interaction.id),
        body: notes ? `${subject}\n\n${notes}` : subject,
        timestamp: String(interaction.occurred_at),
      };
      const pharmacyExternalId = pharmacyId
        ? await externalIdFor(admin, connection.id, "pharmacies", pharmacyId)
        : null;

      await syncHubSpotNote({
        client,
        config: NAALI_HUBSPOT_CONFIGURATION,
        note: payload,
        pharmacyExternalId,
        links,
        journal,
      });
    });
  });
}
