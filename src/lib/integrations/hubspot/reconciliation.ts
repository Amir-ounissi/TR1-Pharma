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

type HubSpotSearchPage = {
  results?: Array<{
    id?: string | number;
    properties?: Record<string, unknown>;
  }>;
  paging?: {
    next?: {
      after?: string | number;
    };
  };
};

export type NaaliClientPharmacySyncResult = {
  owners: number;
  seen: number;
  createdPharmacies: number;
  updatedPharmacies: number;
  createdBrandRelations: number;
  updatedBrandRelations: number;
  potentialCounts: {
    prioritaire: number;
    secondaire: number;
    nonPrioritaire: number;
    unknown: number;
  };
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

function cleanHubSpotPharmacyName(rawName: string, cip: string | null) {
  if (cip) {
    const marker = ` - ${cip} - `;
    const markerIndex = rawName.lastIndexOf(marker);
    if (markerIndex > 0) return rawName.slice(0, markerIndex).trim();
  }
  return rawName.replace(/\s+-\s+\d{5,8}\s+-\s+\d{4,5}\s*$/, "").trim();
}

function potentialMapping(value: unknown) {
  const potential = text(value)?.toLocaleLowerCase("fr-FR") ?? "";
  if (potential === "prioritaires") {
    return { potentialLevel: "high" as const, priorityLevel: "high" as const, bucket: "prioritaire" as const };
  }
  if (potential === "secondaires") {
    return { potentialLevel: "medium" as const, priorityLevel: "normal" as const, bucket: "secondaire" as const };
  }
  if (potential === "non prioritaires") {
    return { potentialLevel: "low" as const, priorityLevel: "low" as const, bucket: "nonPrioritaire" as const };
  }
  return { potentialLevel: "unknown" as const, priorityLevel: "normal" as const, bucket: "unknown" as const };
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

async function hubSpotClientForActiveConnection(brandId: string, connectionId: string) {
  const runtime = await activeConnection(brandId, connectionId);
  if (!runtime) return null;
  const { connection } = runtime;
  const mode = syncMode(connection);
  const token = accessToken(connection, mode);
  if (mode !== "write" || !token) return null;
  return {
    ...runtime,
    client: new HubSpotClient({
      mode,
      accessToken: token,
      baseUrl: connection.base_url ?? undefined,
    }),
  };
}

async function syncNaaliCatalog(brandId: string, connectionId: string) {
  const runtime = await hubSpotClientForActiveConnection(brandId, connectionId);
  if (!runtime) return;
  const { admin, client } = runtime;
  const response = await client.searchObjects<HubSpotSearchPage>("products", {
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

async function findExistingPharmacy(options: {
  admin: ReturnType<typeof createAdminClient>;
  brandId: string;
  externalId: string;
  cip: string | null;
}) {
  const { admin, brandId, externalId, cip } = options;
  const { data: brandRelation, error: brandError } = await admin
    .from("brand_pharmacies")
    .select("id,pharmacy_id,archived_at")
    .eq("brand_id", brandId)
    .eq("external_id", externalId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (brandError) throw brandError;
  if (brandRelation?.pharmacy_id) {
    return { pharmacyId: String(brandRelation.pharmacy_id), brandRelationId: String(brandRelation.id) };
  }

  if (cip) {
    const { data: pharmacy, error: pharmacyError } = await admin
      .from("pharmacies")
      .select("id")
      .eq("cip_code", cip)
      .limit(1)
      .maybeSingle();
    if (pharmacyError) throw pharmacyError;
    if (pharmacy?.id) return { pharmacyId: String(pharmacy.id), brandRelationId: null };
  }

  const { data: pharmacyByExternalId, error: externalError } = await admin
    .from("pharmacies")
    .select("id")
    .eq("external_id", externalId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (externalError) throw externalError;
  if (pharmacyByExternalId?.id) return { pharmacyId: String(pharmacyByExternalId.id), brandRelationId: null };
  return null;
}

async function upsertNaaliClientPharmacy(options: {
  admin: ReturnType<typeof createAdminClient>;
  brandId: string;
  connectionId: string;
  tr1UserId: string;
  remote: NonNullable<HubSpotSearchPage["results"]>[number];
  result: NaaliClientPharmacySyncResult;
}) {
  const { admin, brandId, connectionId, tr1UserId, remote, result } = options;
  const properties = remote.properties ?? {};
  const externalId = remote.id === undefined || remote.id === null ? null : String(remote.id);
  const rawName = text(properties.name);
  if (!externalId || !rawName) return;

  const cip = text(properties.cip);
  const name = cleanHubSpotPharmacyName(rawName, cip) || rawName;
  const latitude = number(properties.latitude);
  const longitude = number(properties.longitude);
  const hasCoordinates = latitude !== null && longitude !== null;
  const potential = potentialMapping(properties.potentiel);
  result.potentialCounts[potential.bucket] += 1;
  result.seen += 1;

  const existing = await findExistingPharmacy({ admin, brandId, externalId, cip });
  let pharmacyId: string;
  if (existing) {
    pharmacyId = existing.pharmacyId;
    const pharmacyUpdate: Record<string, unknown> = {
      legal_name: name,
      trade_name: name,
      external_id: externalId,
      is_active: true,
      archived_at: null,
      updated_at: new Date().toISOString(),
    };
    for (const [column, value] of [
      ["cip_code", cip],
      ["postal_code", text(properties.zip)],
      ["city", text(properties.city)],
      ["address_line_1", text(properties.address)],
      ["address_line_2", text(properties.address2)],
      ["phone", text(properties.phone)],
    ] as const) {
      if (value !== null) pharmacyUpdate[column] = value;
    }
    if (hasCoordinates) {
      pharmacyUpdate.latitude = latitude;
      pharmacyUpdate.longitude = longitude;
      pharmacyUpdate.geocoding_status = "resolved";
      pharmacyUpdate.geocoded_at = new Date().toISOString();
      pharmacyUpdate.geocoding_source = "hubspot";
    }
    const { error } = await admin.from("pharmacies").update(pharmacyUpdate).eq("id", pharmacyId);
    if (error) throw error;
    result.updatedPharmacies += 1;
  } else {
    const { data: inserted, error } = await admin
      .from("pharmacies")
      .insert({
        legal_name: name,
        trade_name: name,
        cip_code: cip,
        postal_code: text(properties.zip),
        city: text(properties.city),
        address_line_1: text(properties.address),
        address_line_2: text(properties.address2),
        phone: text(properties.phone),
        latitude: hasCoordinates ? latitude : null,
        longitude: hasCoordinates ? longitude : null,
        geocoding_status: hasCoordinates ? "resolved" : "pending",
        geocoded_at: hasCoordinates ? new Date().toISOString() : null,
        geocoding_source: hasCoordinates ? "hubspot" : null,
        external_id: externalId,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !inserted) throw error ?? new Error(`Unable to create pharmacy for HubSpot company ${externalId}`);
    pharmacyId = String(inserted.id);
    result.createdPharmacies += 1;
  }

  let relationId = existing?.brandRelationId ?? null;
  if (!relationId) {
    const { data: relation, error } = await admin
      .from("brand_pharmacies")
      .select("id,archived_at")
      .eq("brand_id", brandId)
      .eq("pharmacy_id", pharmacyId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    relationId = relation?.id ? String(relation.id) : null;
  }

  const relationValues = {
    commercial_status: "active",
    activity_status: "active",
    potential_level: potential.potentialLevel,
    priority_level: potential.priorityLevel,
    source: "brand_existing_client",
    source_details: "HubSpot Naali — client synchronisé",
    current_agent_user_id: tr1UserId,
    external_id: externalId,
    archived_at: null,
    updated_at: new Date().toISOString(),
  };

  if (relationId) {
    const { error } = await admin
      .from("brand_pharmacies")
      .update(relationValues)
      .eq("id", relationId)
      .eq("brand_id", brandId);
    if (error) throw error;
    result.updatedBrandRelations += 1;
  } else {
    const { error } = await admin.from("brand_pharmacies").insert({
      brand_id: brandId,
      pharmacy_id: pharmacyId,
      ...relationValues,
    });
    if (error) throw error;
    result.createdBrandRelations += 1;
  }

  const { error: linkError } = await admin.rpc("upsert_connector_external_link", {
    target_connection_id: connectionId,
    target_entity_type: "pharmacies",
    target_external_id: externalId,
    target_tr1_record_id: pharmacyId,
    target_external_updated_at: null,
    target_tr1_updated_at: null,
    target_sync_hash: null,
  });
  if (linkError) throw linkError;
}

export async function syncNaaliClientPharmacies(brandId: string, connectionId: string) {
  const runtime = await hubSpotClientForActiveConnection(brandId, connectionId);
  if (!runtime) throw new Error("Active HubSpot write connection unavailable");
  const { admin, client } = runtime;
  const result: NaaliClientPharmacySyncResult = {
    owners: 0,
    seen: 0,
    createdPharmacies: 0,
    updatedPharmacies: 0,
    createdBrandRelations: 0,
    updatedBrandRelations: 0,
    potentialCounts: { prioritaire: 0, secondaire: 0, nonPrioritaire: 0, unknown: 0 },
  };

  const { data: ownerLinks, error: ownerError } = await admin
    .from("connector_external_links")
    .select("external_id,tr1_record_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", "users");
  if (ownerError) throw ownerError;
  if (!ownerLinks?.length) throw new Error("No HubSpot owner mapping is configured for this connection");

  for (const ownerLink of ownerLinks) {
    const ownerExternalId = text(ownerLink.external_id);
    const tr1UserId = text(ownerLink.tr1_record_id);
    if (!ownerExternalId || !tr1UserId) continue;
    result.owners += 1;

    let after: string | null = null;
    do {
      const response: { data: HubSpotSearchPage | null } = await client.searchObjects<HubSpotSearchPage>("companies", {
        filterGroups: [{
          filters: [
            { propertyName: "hubspot_owner_id", operator: "EQ", value: ownerExternalId },
            { propertyName: "client_naali", operator: "EQ", value: "true" },
          ],
        }],
        properties: [
          "name",
          "cip",
          "zip",
          "city",
          "address",
          "address2",
          "phone",
          "latitude",
          "longitude",
          "potentiel",
          "hs_lead_status",
          "remise_sur_facture_appliquee",
        ],
        limit: 200,
        ...(after ? { after } : {}),
      });
      for (const remote of response.data?.results ?? []) {
        await upsertNaaliClientPharmacy({ admin, brandId, connectionId, tr1UserId, remote, result });
      }
      const nextAfter: string | number | undefined = response.data?.paging?.next?.after;
      after = nextAfter === undefined || nextAfter === null ? null : String(nextAfter);
    } while (after);
  }

  return result;
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
    statusOf(log.old_data) === "active" && statusOf(log.new_data) === "paused",
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
  await syncNaaliClientPharmacies(brandId, connectionId);
  await replayOrdersCreatedWhilePaused(brandId, connectionId);
}
