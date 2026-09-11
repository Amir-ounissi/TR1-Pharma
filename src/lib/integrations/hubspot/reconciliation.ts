import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient, type HubSpotClientMode } from "./client";
import { syncHubSpotOrderAfterPersistence } from "./runtime";

type HubSpotConnection = {
  id: string;
  base_url: string | null;
  credential_reference: string | null;
  configuration: Record<string, unknown> | null;
};

type HubSpotCatalogSearch = {
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
    requested === "write" &&
    configured === "write" &&
    connection.configuration?.write_enabled === true &&
    process.env.TR1_HUBSPOT_WRITE_ENABLED === "true"
  ) {
    return "write";
  }
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

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

async function activeConnection(brandId: string, connectionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference,configuration,provider,status")
    .eq("id", connectionId)
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { admin, connection: data as HubSpotConnection };
}

async function syncNaaliCatalog(brandId: string, connectionId: string) {
  const runtime = await activeConnection(brandId, connectionId);
  if (!runtime) return;
  const { admin, connection } = runtime;
  const mode = syncMode(connection);
  const token = accessToken(connection, mode);
  if (mode !== "write" || !token) return;

  const client = new HubSpotClient({
    mode,
    accessToken: token,
    baseUrl: connection.base_url ?? undefined,
  });
  const response = await client.searchObjects<HubSpotCatalogSearch>("products", {
    filterGroups: [{
      filters: [
        { propertyName: "type_de_produit_naali", operator: "EQ", value: "Normal" },
        { propertyName: "hs_status", operator: "EQ", value: "active" },
      ],
    }],
    properties: [
      "name",
      "description",
      "hs_sku",
      "hs_price_eur",
      "code_ean",
      "pvc",
      "quantity_rule_minimum",
      "quantity_rule_increment",
      "hs_status",
      "type_de_produit_naali",
    ],
    limit: 200,
  });

  for (const remote of response.data?.results ?? []) {
    const properties = remote.properties ?? {};
    const externalId = remote.id === null || remote.id === undefined ? null : String(remote.id);
    const sku = text(properties.hs_sku);
    const name = text(properties.name);
    if (!externalId || !sku || !name) continue;

    const ean = text(properties.code_ean);
    const wholesalePriceHt = number(properties.hs_price_eur);
    const retailPriceTtc = number(properties.pvc);
    const description = text(properties.description);
    const minimumOrderQuantity = number(properties.quantity_rule_minimum);
    const unitsPerCase = number(properties.quantity_rule_increment);

    const { data: existing, error: existingError } = await admin
      .from("products")
      .select("id,retail_price_ttc,tax_rate,minimum_order_quantity,units_per_case")
      .eq("brand_id", brandId)
      .eq("sku", sku)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    let productId: string;
    if (existing) {
      const { error } = await admin
        .from("products")
        .update({
          name,
          description: description ?? undefined,
          ean,
          wholesale_price_ht: wholesalePriceHt,
          retail_price_ttc: retailPriceTtc ?? existing.retail_price_ttc,
          tax_rate: existing.tax_rate ?? 5.5,
          minimum_order_quantity: minimumOrderQuantity ?? existing.minimum_order_quantity,
          units_per_case: unitsPerCase ?? existing.units_per_case,
          is_active: true,
          discontinued_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("brand_id", brandId);
      if (error) throw error;
      productId = String(existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("products")
        .insert({
          brand_id: brandId,
          name,
          description,
          sku,
          ean,
          wholesale_price_ht: wholesalePriceHt,
          retail_price_ttc: retailPriceTtc,
          tax_rate: 5.5,
          minimum_order_quantity: minimumOrderQuantity,
          units_per_case: unitsPerCase,
          is_active: true,
        })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error(`Unable to import HubSpot product ${sku}`);
      productId = String(inserted.id);
    }

    const { error: linkError } = await admin.rpc("upsert_connector_external_link", {
      target_connection_id: connectionId,
      target_entity_type: "products",
      target_external_id: externalId,
      target_tr1_record_id: productId,
      target_external_updated_at: null,
      target_tr1_updated_at: null,
      target_sync_hash: null,
    });
    if (linkError) throw linkError;
  }
}

function statusOf(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const status = (data as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

async function replayOrdersCreatedWhilePaused(brandId: string, connectionId: string) {
  const admin = createAdminClient();
  const { data: logs, error: logsError } = await admin
    .from("activity_logs")
    .select("old_data,new_data,created_at")
    .eq("entity_type", "connector_connections")
    .eq("entity_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (logsError) throw logsError;

  const activation = (logs ?? []).find((log) => statusOf(log.old_data) === "paused" && statusOf(log.new_data) === "active");
  if (!activation) return;
  const pause = (logs ?? []).find((log) =>
    new Date(log.created_at).getTime() < new Date(activation.created_at).getTime() &&
    statusOf(log.old_data) === "active" &&
    statusOf(log.new_data) === "paused",
  );
  if (!pause) return;

  const pauseAt = String(pause.created_at);
  const activatedAt = String(activation.created_at);
  const syncStatuses = ["pending", "confirmed", "invoiced", "partially_delivered", "delivered"];
  const [{ data: createdOrders, error: createdError }, { data: updatedOrders, error: updatedError }] = await Promise.all([
    admin
      .from("orders")
      .select("id")
      .eq("brand_id", brandId)
      .in("order_status", syncStatuses)
      .gte("created_at", pauseAt)
      .lte("created_at", activatedAt)
      .is("archived_at", null),
    admin
      .from("orders")
      .select("id")
      .eq("brand_id", brandId)
      .in("order_status", syncStatuses)
      .gte("updated_at", pauseAt)
      .lte("updated_at", activatedAt)
      .is("archived_at", null),
  ]);
  if (createdError || updatedError) throw createdError ?? updatedError;

  const candidateIds = [...new Set([...(createdOrders ?? []), ...(updatedOrders ?? [])].map((row) => String(row.id)))];
  if (!candidateIds.length) return;
  const { data: links, error: linksError } = await admin
    .from("connector_external_links")
    .select("tr1_record_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", "orders")
    .in("tr1_record_id", candidateIds);
  if (linksError) throw linksError;
  const alreadySynced = new Set((links ?? []).map((row) => String(row.tr1_record_id)));

  for (const orderId of candidateIds) {
    if (!alreadySynced.has(orderId)) {
      await syncHubSpotOrderAfterPersistence(brandId, orderId);
    }
  }
}

export async function reconcileHubSpotConnectionAfterActivation(brandId: string, connectionId: string) {
  await syncNaaliCatalog(brandId, connectionId);
  await replayOrdersCreatedWhilePaused(brandId, connectionId);
}
