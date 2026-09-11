import "server-only";

import type { ConnectorEntityType } from "@/lib/connectors";
import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient, type HubSpotClientMode } from "./client";
import {
  resolveHubSpotMappedValue,
  type HubSpotMappingTransforms,
} from "./mapping-profile";
import { loadHubSpotRuntimeProfile } from "./mapping-profile-runtime";
import type {
  HubSpotBrandConfiguration,
  HubSpotNoteSyncInput,
  HubSpotOrderSyncInput,
} from "./model";
import {
  NAALI_HUBSPOT_CONFIGURATION,
  resolveNaaliHubSpotOrderRoute,
  resolveNaaliHubSpotOrderType,
} from "./naali";
import { syncNaaliHubSpotVisitAfterPersistence } from "./naali-visit-runtime";
import {
  syncHubSpotNote,
  syncHubSpotOrder,
  type HubSpotExternalLinkStore,
  type HubSpotSyncEvent,
  type HubSpotSyncJournal,
} from "./sync";

type HubSpotRuntimeEntity = Extract<ConnectorEntityType, "orders" | "visits" | "notes">;

type HubSpotConnection = {
  id: string;
  base_url: string | null;
  credential_reference: string | null;
  configuration: Record<string, unknown> | null;
};

type HubSpotSearchResponse = {
  total?: number;
  results?: Array<{
    id?: string | number;
    properties?: Record<string, unknown>;
  }>;
};

function configuredMode(connection: HubSpotConnection) {
  const value = connection.configuration?.mode;
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function syncMode(connection: HubSpotConnection): HubSpotClientMode {
  const requested = process.env.TR1_HUBSPOT_MODE?.trim().toLowerCase();
  const configured = configuredMode(connection);
  if (requested === "dry_run") return "dry_run";
  if (!requested && configured === "dry_run") return "dry_run";
  if (
    requested === "write"
    && configured === "write"
    && connection.configuration?.write_enabled === true
    && process.env.TR1_HUBSPOT_WRITE_ENABLED === "true"
  ) {
    return "write";
  }
  return "disabled";
}

function accessToken(connection: HubSpotConnection, mode: HubSpotClientMode) {
  if (mode !== "write") return null;
  const reference = connection.credential_reference?.trim();
  if (reference && /^[A-Z][A-Z0-9_]*$/.test(reference)) return process.env[reference] ?? null;
  return process.env.HUBSPOT_ACCESS_TOKEN ?? null;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown HubSpot runtime error";
}

async function findConnection(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string,
  entityType: HubSpotRuntimeEntity,
) {
  const { data: connection, error: connectionError } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference,configuration")
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

async function saveExternalIdFor(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  entityType: ConnectorEntityType,
  tr1RecordId: string,
  externalId: string,
) {
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
}

function searchedExternalId(search: HubSpotSearchResponse, label: string) {
  const results = search.results ?? [];
  const total = search.total ?? results.length;
  if (total !== 1 || results.length !== 1) {
    throw new Error(`Expected exactly one HubSpot product for ${label}; found ${total}`);
  }
  const rawExternalId = results[0]?.id;
  const externalId = typeof rawExternalId === "number" && Number.isFinite(rawExternalId)
    ? String(rawExternalId)
    : typeof rawExternalId === "string" && rawExternalId.trim()
      ? rawExternalId.trim()
      : null;
  if (!externalId) throw new Error(`HubSpot product search for ${label} returned no usable product ID`);
  return externalId;
}

async function resolveHubSpotProductExternalId(options: {
  admin: ReturnType<typeof createAdminClient>;
  client: HubSpotClient;
  connectionId: string;
  tr1ProductId: string;
  sku: string | null;
}) {
  const { admin, client, connectionId, tr1ProductId } = options;
  const existing = await externalIdFor(admin, connectionId, "products", tr1ProductId);
  if (existing) return existing;

  const sku = options.sku?.trim();
  if (!sku) throw new Error(`HubSpot product mapping missing for TR1 product ${tr1ProductId}, and no SKU is available for exact lookup`);
  if (client.getMode() !== "write") {
    throw new Error(`HubSpot product mapping missing for TR1 product ${tr1ProductId} (${sku}); dry-run will not query the provider`);
  }

  const productMap = NAALI_HUBSPOT_CONFIGURATION.properties.product;
  const skuProperty = productMap.sku;
  const productTypeProperty = productMap.productType;
  if (!skuProperty || !productTypeProperty) throw new Error("HubSpot product catalog properties are not configured");

  const searched = await client.searchObjects<HubSpotSearchResponse>(NAALI_HUBSPOT_CONFIGURATION.objects.products, {
    filterGroups: [{ filters: [
      { propertyName: skuProperty, operator: "EQ", value: sku },
      { propertyName: productTypeProperty, operator: "EQ", value: "Normal" },
    ] }],
    properties: [skuProperty, productTypeProperty],
    limit: 2,
  });
  const externalId = searchedExternalId(searched.data ?? {}, `normal SKU ${sku}`);
  await saveExternalIdFor(admin, connectionId, "products", tr1ProductId, externalId);
  return externalId;
}

async function resolveHubSpotFreeProductExternalId(options: {
  client: HubSpotClient;
  normalProductExternalId: string;
  productLabel: string;
}) {
  const { client, normalProductExternalId, productLabel } = options;
  if (client.getMode() !== "write") {
    throw new Error(`HubSpot UG catalog mapping missing for ${productLabel}; dry-run will not query the provider`);
  }
  const productMap = NAALI_HUBSPOT_CONFIGURATION.properties.product;
  const productTypeProperty = productMap.productType;
  const primaryProductProperty = productMap.primaryProductExternalId;
  if (!productTypeProperty || !primaryProductProperty) throw new Error("HubSpot UG catalog properties are not configured");

  const searched = await client.searchObjects<HubSpotSearchResponse>(NAALI_HUBSPOT_CONFIGURATION.objects.products, {
    filterGroups: [{ filters: [
      { propertyName: productTypeProperty, operator: "EQ", value: "UG" },
      { propertyName: primaryProductProperty, operator: "EQ", value: normalProductExternalId },
    ] }],
    properties: [productTypeProperty, primaryProductProperty, "name"],
    limit: 2,
  });
  return searchedExternalId(searched.data ?? {}, `UG linked to ${productLabel} (${normalProductExternalId})`);
}

async function roleKeyForOrderUser(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string,
  userId: string,
) {
  const { data: membership, error: membershipError } = await admin
    .from("memberships")
    .select("role_id")
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.role_id) throw new Error(`Active TR1 brand membership missing for order user ${userId}`);

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("key")
    .eq("id", membership.role_id)
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role?.key) throw new Error(`TR1 role missing for order user ${userId}`);
  return String(role.key);
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
      await saveExternalIdFor(admin, connectionId, entityType, tr1RecordId, externalId);
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
    config: HubSpotBrandConfiguration;
    transforms: HubSpotMappingTransforms;
    links: HubSpotExternalLinkStore;
    journal: HubSpotSyncJournal;
  }) => Promise<void>,
) {
  const admin = createAdminClient();
  const connection = await findConnection(admin, brandId, entityType);
  if (!connection) return;

  const profile = await loadHubSpotRuntimeProfile(admin, connection.id, entityType, NAALI_HUBSPOT_CONFIGURATION);
  const mode = syncMode(connection);
  const client = new HubSpotClient({
    mode,
    accessToken: accessToken(connection, mode),
    baseUrl: connection.base_url ?? undefined,
  });
  const runId = await openRun(admin, connection.id, entityType);
  const links = createLinkStore(admin, connection.id, entityType);
  const journal = createJournal(admin, runId, connection.id, entityType);

  try {
    await execute({ admin, client, connection, config: profile.config, transforms: profile.transforms, links, journal });
    await closeRun(admin, runId, "succeeded");
  } catch (error) {
    const message = safeError(error);
    try {
      await closeRun(admin, runId, "failed", message);
    } catch {
      // The TR1 write already succeeded; connector journal failures stay isolated.
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
    await withRuntime(brandId, "orders", async ({ admin, client, connection, config, transforms, links, journal }) => {
      const { data: order, error: orderError } = await admin
        .from("orders")
        .select("id,brand_id,pharmacy_id,order_number,external_order_id,order_status,order_date,order_type,net_amount_ht,tax_amount,total_ttc,currency_code,source_user_id,created_by")
        .eq("id", orderId)
        .eq("brand_id", brandId)
        .is("archived_at", null)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order || !config.order.syncStatuses.includes(String(order.order_status))) return;

      const { data: items, error: itemsError } = await admin
        .from("order_items")
        .select("id,product_id,product_name_snapshot,sku_snapshot,quantity,free_quantity,unit_price_ht,discount_rate,tax_rate")
        .eq("order_id", orderId)
        .eq("brand_id", brandId);
      if (itemsError) throw itemsError;

      const ownerTr1UserId = order.source_user_id || order.created_by ? String(order.source_user_id || order.created_by) : null;
      if (!ownerTr1UserId) throw new Error(`TR1 order ${orderId} has no source user for HubSpot ownership and routing`);
      const ownerExternalId = await externalIdFor(admin, connection.id, "users", ownerTr1UserId);
      if (!ownerExternalId) throw new Error(`HubSpot owner mapping missing for TR1 user ${ownerTr1UserId}`);

      const roleKey = await roleKeyForOrderUser(admin, brandId, ownerTr1UserId);
      const route = resolveNaaliHubSpotOrderRoute(roleKey);
      const productMappings = new Map<string, string>();
      const freeProductMappings = new Map<string, string>();

      for (const item of items ?? []) {
        if (!item.product_id) throw new Error(`TR1 order item ${item.id} has no product_id for HubSpot catalog linkage`);
        const tr1ProductId = String(item.product_id);
        let productExternalId = productMappings.get(tr1ProductId);
        if (!productExternalId) {
          productExternalId = await resolveHubSpotProductExternalId({
            admin,
            client,
            connectionId: connection.id,
            tr1ProductId,
            sku: item.sku_snapshot ? String(item.sku_snapshot) : null,
          });
          productMappings.set(tr1ProductId, productExternalId);
        }
        if (Number(item.free_quantity ?? 0) > 0 && !freeProductMappings.has(tr1ProductId)) {
          const freeProductExternalId = await resolveHubSpotFreeProductExternalId({
            client,
            normalProductExternalId: productExternalId,
            productLabel: String(item.product_name_snapshot || item.sku_snapshot || tr1ProductId),
          });
          freeProductMappings.set(tr1ProductId, freeProductExternalId);
        }
      }

      const orderType = order.order_type ? String(order.order_type) : null;
      const payload: HubSpotOrderSyncInput = {
        id: String(order.id),
        orderNumber: String(order.order_number || order.external_order_id || order.id),
        status: String(order.order_status),
        orderDate: String(order.order_date),
        orderTypeValue: resolveHubSpotMappedValue(
          transforms.orderTypeValues,
          orderType,
          resolveNaaliHubSpotOrderType(orderType),
        ),
        netAmountHt: Number(order.net_amount_ht),
        taxAmount: Number(order.tax_amount),
        amountTtc: Number(order.total_ttc),
        currency: String(order.currency_code || "EUR"),
        ownerExternalId,
        pipelineExternalId: route.pipeline,
        stageExternalId: route.confirmedStage,
        originValue: route.origin,
        lines: (items ?? []).map((item) => {
          const tr1ProductId = String(item.product_id);
          const productExternalId = productMappings.get(tr1ProductId);
          if (!productExternalId) throw new Error(`HubSpot product mapping missing for TR1 product ${tr1ProductId}`);
          const freeQuantity = Number(item.free_quantity ?? 0);
          const freeProductExternalId = freeQuantity > 0 ? freeProductMappings.get(tr1ProductId) : null;
          if (freeQuantity > 0 && !freeProductExternalId) throw new Error(`HubSpot UG product mapping missing for TR1 product ${tr1ProductId}`);
          return {
            id: String(item.id),
            productId: tr1ProductId,
            productExternalId,
            freeProductExternalId,
            name: String(item.product_name_snapshot),
            sku: item.sku_snapshot ? String(item.sku_snapshot) : null,
            quantity: Number(item.quantity),
            freeQuantity,
            unitPriceHt: Number(item.unit_price_ht),
            discountPercent: item.discount_rate === null ? null : Number(item.discount_rate),
            vatRate: item.tax_rate === null ? null : Number(item.tax_rate),
          };
        }),
      };
      const pharmacyExternalId = order.pharmacy_id
        ? await externalIdFor(admin, connection.id, "pharmacies", String(order.pharmacy_id))
        : null;

      await syncHubSpotOrder({ client, config, order: payload, pharmacyExternalId, links, journal });
    });
  });
}

export async function syncHubSpotVisitAfterPersistence(brandId: string, visitId: string) {
  await syncNaaliHubSpotVisitAfterPersistence(brandId, visitId);
}

export async function syncHubSpotNoteAfterPersistence(brandId: string, interactionId: string) {
  await bestEffort(`note:${interactionId}`, async () => {
    await withRuntime(brandId, "notes", async ({ admin, client, connection, config, links, journal }) => {
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

      await syncHubSpotNote({ client, config, note: payload, pharmacyExternalId, links, journal });
    });
  });
}
