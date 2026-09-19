import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotApiError, HubSpotClient } from "./client";
import { getNaaliHubSpotPharmacyPricing } from "./naali-pricing";

type AdminClient = ReturnType<typeof createAdminClient>;

type HubSpotConnection = {
  id: string;
  base_url: string | null;
  credential_reference: string | null;
};

type HubSpotRecord = {
  id?: string | number;
  properties?: Record<string, unknown>;
  associations?: Record<string, { results?: Array<{ id?: string | number }> }>;
};

type HubSpotSearchResponse = {
  results?: HubSpotRecord[];
  paging?: { next?: { after?: string | number } };
};

type HubSpotBatchResponse = {
  results?: HubSpotRecord[];
};

type PharmacyScope = {
  pharmacyId: string;
  brandPharmacyId: string;
  companyExternalId: string;
  currentAgentUserId: string | null;
};

type SyncStats = {
  seen: number;
  succeeded: number;
  failed: number;
};

const COMMERCIAL_PIPELINE = "1543644371";
const AGENT_PIPELINE = "1543733493";
const CLOSED_STAGES = new Set(["2110945491", "2111064276"]);
const CANCELLED_STAGES = new Set(["5787539670", "5787546853"]);

const TAX_RATE_BY_GROUP: Record<string, number> = {
  "115968336": 2,
  "115991071": 2.1,
  "116915187": 3,
  "115989351": 5.5,
  "116087659": 8.1,
  "117518330": 21,
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(value: unknown) {
  const parsed = numberValue(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function connectionToken(connection: HubSpotConnection) {
  const reference = connection.credential_reference?.trim();
  if (reference && /^[A-Z][A-Z0-9_]*$/.test(reference)) return process.env[reference] ?? null;
  return process.env.HUBSPOT_ACCESS_TOKEN ?? null;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown HubSpot inbound error";
}

function plainText(value: unknown) {
  const source = text(value);
  if (!source) return null;
  return source
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim() || null;
}

function visitKind(activityType: unknown): "client_visit" | "prospecting" | "relationship" | "training" | "other" {
  const normalized = text(activityType)?.toLowerCase() ?? "";
  if (normalized === "visite prospection" || normalized === "rendez-vous prospect") return "prospecting";
  if (normalized === "rendez-vous client") return "relationship";
  if (normalized === "formation") return "training";
  if (normalized === "visite client") return "client_visit";
  return "other";
}

function visitStatus(outcome: unknown, startAt: string): "planned" | "completed" | "cancelled" {
  const normalized = text(outcome)?.toUpperCase() ?? "";
  if (normalized === "COMPLETED") return "completed";
  if (normalized === "CANCELED" || normalized === "NO_SHOW") return "cancelled";
  if (!normalized && new Date(startAt).getTime() < Date.now()) return "completed";
  return "planned";
}

function orderStatus(stage: unknown): "pending" | "invoiced" | "cancelled" {
  const value = text(stage);
  if (value && CLOSED_STAGES.has(value)) return "invoiced";
  if (value && CANCELLED_STAGES.has(value)) return "cancelled";
  return "pending";
}

function requestedOrderType(value: unknown): "complementary" | "other" {
  const normalized = text(value)?.toLowerCase() ?? "";
  return normalized.includes("complément") ? "complementary" : "other";
}

async function loadConnection(admin: AdminClient, brandId: string, connectionId: string) {
  const { data, error } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference,provider,status")
    .eq("id", connectionId)
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Active HubSpot connection not found");
  const connection = data as HubSpotConnection;
  const token = connectionToken(connection);
  if (!token) throw new Error("HubSpot access token is not available to the runtime");
  return {
    connection,
    client: new HubSpotClient({
      mode: "dry_run",
      accessToken: token,
      baseUrl: connection.base_url ?? undefined,
    }),
  };
}

async function mappedPharmacies(admin: AdminClient, brandId: string, connectionId: string): Promise<PharmacyScope[]> {
  const { data: links, error: linksError } = await admin
    .from("connector_external_links")
    .select("tr1_record_id,external_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", "pharmacies");
  if (linksError) throw linksError;
  const pharmacyIds = (links ?? []).map((row) => String(row.tr1_record_id));
  if (!pharmacyIds.length) return [];

  const { data: relations, error: relationError } = await admin
    .from("brand_pharmacies")
    .select("id,pharmacy_id,current_agent_user_id")
    .eq("brand_id", brandId)
    .in("pharmacy_id", pharmacyIds)
    .is("archived_at", null);
  if (relationError) throw relationError;

  const relationByPharmacy = new Map((relations ?? []).map((row) => [String(row.pharmacy_id), row]));
  return (links ?? []).flatMap((link) => {
    const relation = relationByPharmacy.get(String(link.tr1_record_id));
    if (!relation) return [];
    return [{
      pharmacyId: String(link.tr1_record_id),
      brandPharmacyId: String(relation.id),
      companyExternalId: String(link.external_id),
      currentAgentUserId: relation.current_agent_user_id ? String(relation.current_agent_user_id) : null,
    }];
  });
}

async function ownerMap(admin: AdminClient, connectionId: string) {
  const { data, error } = await admin
    .from("connector_external_links")
    .select("external_id,tr1_record_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", "users");
  if (error) throw error;
  return new Map((data ?? []).map((row) => [String(row.external_id), String(row.tr1_record_id)]));
}

async function searchAll(
  client: HubSpotClient,
  objectType: string,
  body: Record<string, unknown>,
  maxPages = 20,
): Promise<HubSpotRecord[]> {
  const output: HubSpotRecord[] = [];
  let after: string | number | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const requestBody = { ...body, ...(after === null ? {} : { after }) };
    const response = await client.searchObjects<HubSpotSearchResponse>(objectType, requestBody);
    const records = response.data?.results ?? [];
    output.push(...records);
    const next = response.data?.paging?.next?.after;
    if (next === null || next === undefined || next === "") break;
    after = next;
  }
  return output;
}

async function saveExternalLink(
  admin: AdminClient,
  connectionId: string,
  entityType: "orders" | "visits" | "notes",
  externalId: string,
  tr1RecordId: string,
  externalUpdatedAt?: string | null,
) {
  const { error } = await admin.rpc("upsert_connector_external_link", {
    target_connection_id: connectionId,
    target_entity_type: entityType,
    target_external_id: externalId,
    target_tr1_record_id: tr1RecordId,
    target_external_updated_at: externalUpdatedAt ?? null,
    target_tr1_updated_at: new Date().toISOString(),
    target_sync_hash: null,
  });
  if (error) throw error;
}

async function findLink(
  admin: AdminClient,
  connectionId: string,
  entityType: "orders" | "visits" | "notes",
  externalId: string,
) {
  const { data, error } = await admin
    .from("connector_external_links")
    .select("tr1_record_id,external_updated_at")
    .eq("connection_id", connectionId)
    .eq("entity_type", entityType)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function withRun(
  admin: AdminClient,
  connectionId: string,
  entityType: "orders" | "visits" | "notes",
  work: (stats: SyncStats) => Promise<void>,
) {
  const stats: SyncStats = { seen: 0, succeeded: 0, failed: 0 };
  const { data: runId, error: runError } = await admin.rpc("register_connector_sync_run", {
    target_connection_id: connectionId,
    target_entity_type: entityType,
    target_direction: "inbound",
    target_cursor_before: null,
  });
  if (runError || !runId) throw runError ?? new Error("Unable to create connector sync run");

  try {
    await work(stats);
    const { error } = await admin.rpc("complete_connector_sync_run", {
      target_run_id: String(runId),
      target_status: stats.failed > 0 ? "partial" : "succeeded",
      target_records_seen: stats.seen,
      target_records_succeeded: stats.succeeded,
      target_records_failed: stats.failed,
      target_cursor_after: null,
      target_error_summary: stats.failed > 0 ? `${stats.failed} record(s) failed during HubSpot inbound reconciliation` : null,
    });
    if (error) throw error;
  } catch (error) {
    await admin.rpc("complete_connector_sync_run", {
      target_run_id: String(runId),
      target_status: "failed",
      target_records_seen: stats.seen,
      target_records_succeeded: stats.succeeded,
      target_records_failed: Math.max(stats.failed, 1),
      target_cursor_after: null,
      target_error_summary: safeError(error),
    });
    throw error;
  }
  return stats;
}

async function syncCommercialTerms(
  brandId: string,
  scopes: PharmacyScope[],
  stats: SyncStats,
) {
  for (const scope of scopes) {
    stats.seen += 1;
    try {
      await getNaaliHubSpotPharmacyPricing(brandId, scope.pharmacyId);
      stats.succeeded += 1;
    } catch {
      stats.failed += 1;
    }
  }
}

async function lineItemsForDeal(client: HubSpotClient, dealId: string) {
  const dealResponse = await client.read<HubSpotRecord>(
    `/crm/v3/objects/deals/${encodeURIComponent(dealId)}?associations=line_items`,
  );
  const ids = dealResponse.data?.associations?.line_items?.results
    ?.map((row) => row.id === null || row.id === undefined ? null : String(row.id))
    .filter((id): id is string => Boolean(id)) ?? [];
  if (!ids.length) return [];
  const result: HubSpotRecord[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const batch = await client.readObjectsBatch<HubSpotBatchResponse>("line_items", ids.slice(index, index + 100), [
      "name",
      "hs_sku",
      "hs_product_id",
      "primary_product_id",
      "code_ean",
      "type_de_produit_naali",
      "quantity",
      "price",
      "hs_discount_percentage",
      "hs_tax_rate_group_id",
      "test_type_dug",
    ]);
    result.push(...(batch.data?.results ?? []));
  }
  return result;
}

async function productMaps(admin: AdminClient, brandId: string, connectionId: string) {
  const [{ data: products, error: productsError }, { data: links, error: linksError }] = await Promise.all([
    admin
      .from("products")
      .select("id,sku,ean,tax_rate")
      .eq("brand_id", brandId)
      .is("discontinued_at", null),
    admin
      .from("connector_external_links")
      .select("external_id,tr1_record_id")
      .eq("connection_id", connectionId)
      .eq("entity_type", "products"),
  ]);
  if (productsError || linksError) throw productsError ?? linksError;
  const byId = new Map((products ?? []).map((row) => [String(row.id), row]));
  const bySku = new Map((products ?? []).flatMap((row) => row.sku ? [[String(row.sku).toLowerCase(), row] as const] : []));
  const byEan = new Map((products ?? []).flatMap((row) => row.ean ? [[String(row.ean), row] as const] : []));
  const byExternal = new Map<string, (typeof products)[number]>();
  for (const link of links ?? []) {
    const product = byId.get(String(link.tr1_record_id));
    if (product) byExternal.set(String(link.external_id), product);
  }
  return { byExternal, bySku, byEan };
}

async function importDeal(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connectionId: string;
  organizationId: string;
  scope: PharmacyScope;
  owners: Map<string, string>;
  deal: HubSpotRecord;
  products: Awaited<ReturnType<typeof productMaps>>;
}) {
  const { admin, client, brandId, connectionId, organizationId, scope, owners, deal, products } = options;
  const externalId = deal.id === null || deal.id === undefined ? null : String(deal.id);
  if (!externalId) throw new Error("HubSpot deal is missing its ID");
  const properties = deal.properties ?? {};
  const externalUpdatedAt = text(properties.hs_lastmodifieddate);

  const linked = await findLink(admin, connectionId, "orders", externalId);
  if (linked) return false;

  const { data: existingOrder, error: existingOrderError } = await admin
    .from("orders")
    .select("id")
    .eq("brand_id", brandId)
    .eq("external_order_id", externalId)
    .is("archived_at", null)
    .maybeSingle();
  if (existingOrderError) throw existingOrderError;
  if (existingOrder) {
    await saveExternalLink(admin, connectionId, "orders", externalId, String(existingOrder.id), externalUpdatedAt);
    return false;
  }

  const ownerExternalId = text(properties.hubspot_owner_id);
  const creatorId = (ownerExternalId ? owners.get(ownerExternalId) : null) ?? scope.currentAgentUserId;
  if (!creatorId) throw new Error(`No TR1 owner can be resolved for HubSpot deal ${externalId}`);

  const remoteLines = await lineItemsForDeal(client, externalId);
  const paid = new Map<string, {
    product: { id: string; tax_rate: unknown };
    quantity: number;
    freeQuantity: number;
    unitPriceHt: number;
    discountRate: number | null;
    taxRate: number;
    ean: string | null;
  }>();
  const freeByEan = new Map<string, number>();
  let ignoredLines = 0;

  for (const line of remoteLines) {
    const lp = line.properties ?? {};
    const productType = text(lp.type_de_produit_naali)?.toLowerCase() ?? "";
    const reason = text(lp.test_type_dug)?.toLowerCase() ?? "";
    const quantity = integerValue(lp.quantity) ?? 0;
    const ean = text(lp.code_ean);

    if (productType === "ug") {
      if (ean && reason.includes("conditions commerciale")) {
        freeByEan.set(ean, (freeByEan.get(ean) ?? 0) + Math.max(quantity, 0));
      } else {
        ignoredLines += 1;
      }
      continue;
    }
    if (productType.includes("échantillon") || productType.includes("echantillon")) {
      ignoredLines += 1;
      continue;
    }

    const externalProductId = text(lp.hs_product_id);
    const sku = text(lp.hs_sku)?.toLowerCase() ?? null;
    const product =
      (externalProductId ? products.byExternal.get(externalProductId) : null) ??
      (sku ? products.bySku.get(sku) : null) ??
      (ean ? products.byEan.get(ean) : null);
    if (!product || quantity <= 0) {
      ignoredLines += 1;
      continue;
    }
    const unitPriceHt = numberValue(lp.price);
    if (unitPriceHt === null) {
      ignoredLines += 1;
      continue;
    }
    const taxRate = text(lp.hs_tax_rate_group_id)
      ? TAX_RATE_BY_GROUP[text(lp.hs_tax_rate_group_id)!] ?? Number(product.tax_rate ?? 5.5)
      : Number(product.tax_rate ?? 5.5);
    paid.set(String(product.id), {
      product: { id: String(product.id), tax_rate: product.tax_rate },
      quantity,
      freeQuantity: 0,
      unitPriceHt,
      discountRate: numberValue(lp.hs_discount_percentage),
      taxRate,
      ean,
    });
  }

  for (const row of paid.values()) {
    if (row.ean) row.freeQuantity = freeByEan.get(row.ean) ?? 0;
  }

  if (!paid.size) throw new Error(`HubSpot deal ${externalId} has no importable paid line items`);

  const orderDate = text(properties.closedate) ?? text(properties.createdate) ?? new Date().toISOString();
  const finalStatus = orderStatus(properties.dealstage);
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      organization_id: organizationId,
      brand_id: brandId,
      brand_pharmacy_id: scope.brandPharmacyId,
      pharmacy_id: scope.pharmacyId,
      external_order_id: externalId,
      order_number: `HS-${externalId}`,
      order_type: requestedOrderType(properties.type_de_commande),
      order_status: "pending",
      order_date: orderDate,
      source: "import",
      source_user_id: creatorId,
      source_agent_user_id: null,
      currency_code: text(properties.deal_currency_code) ?? "EUR",
      payment_status: "not_applicable",
      notes: `Import HubSpot · ${text(properties.dealname) ?? externalId}`,
      imported_at: new Date().toISOString(),
      created_by: creatorId,
      line_items_complete: ignoredLines === 0,
    })
    .select("id")
    .single();
  if (orderError || !order) throw orderError ?? new Error("Unable to create imported order");

  try {
    const items = [...paid.values()].map((row) => ({
      organization_id: organizationId,
      brand_id: brandId,
      order_id: String(order.id),
      product_id: row.product.id,
      quantity: row.quantity,
      free_quantity: row.freeQuantity,
      unit_price_ht: row.unitPriceHt,
      discount_rate: row.discountRate,
      discount_amount_ht: 0,
      tax_rate: row.taxRate,
    }));
    const { error: itemsError } = await admin.from("order_items").insert(items);
    if (itemsError) throw itemsError;

    if (finalStatus !== "pending") {
      const { error: statusError } = await admin
        .from("orders")
        .update({
          order_status: finalStatus,
          cancellation_reason: finalStatus === "cancelled" ? "HubSpot · transaction abandonnée" : null,
        })
        .eq("id", order.id);
      if (statusError) throw statusError;
    }

    await saveExternalLink(admin, connectionId, "orders", externalId, String(order.id), externalUpdatedAt);
  } catch (error) {
    await admin.from("orders").delete().eq("id", order.id);
    throw error;
  }

  return true;
}

async function syncOrders(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connectionId: string;
  scopes: PharmacyScope[];
  owners: Map<string, string>;
  stats: SyncStats;
}) {
  const { admin, client, brandId, connectionId, scopes, owners, stats } = options;
  const { data: brand, error: brandError } = await admin
    .from("brands")
    .select("organization_id")
    .eq("id", brandId)
    .single();
  if (brandError || !brand) throw brandError ?? new Error("Brand organization not found");
  const products = await productMaps(admin, brandId, connectionId);

  for (const scope of scopes) {
    const deals = await searchAll(client, "deals", {
      filterGroups: [{
        filters: [
          { propertyName: "associations.company", operator: "EQ", value: scope.companyExternalId },
          { propertyName: "pipeline", operator: "IN", values: [COMMERCIAL_PIPELINE, AGENT_PIPELINE] },
        ],
      }],
      properties: [
        "dealname",
        "amount",
        "deal_currency_code",
        "pipeline",
        "dealstage",
        "origine_de_la_commande",
        "type_de_commande",
        "hubspot_owner_id",
        "createdate",
        "closedate",
        "hs_lastmodifieddate",
      ],
      limit: 200,
      sorts: ["createdate"],
    });

    for (const deal of deals) {
      stats.seen += 1;
      try {
        await importDeal({
          admin,
          client,
          brandId,
          connectionId,
          organizationId: String(brand.organization_id),
          scope,
          owners,
          deal,
          products,
        });
        stats.succeeded += 1;
      } catch (error) {
        stats.failed += 1;
        console.error(`[hubspot] inbound order failed: ${safeError(error)}`);
      }
    }
  }
}

function meetingTimes(properties: Record<string, unknown>) {
  const startAt = text(properties.hs_meeting_start_time) ?? text(properties.hs_timestamp);
  if (!startAt) return null;
  const endAt = text(properties.hs_meeting_end_time)
    ?? new Date(new Date(startAt).getTime() + 30 * 60_000).toISOString();
  return { startAt, endAt };
}

async function syncMeetings(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connectionId: string;
  scopes: PharmacyScope[];
  owners: Map<string, string>;
  stats: SyncStats;
}) {
  const { admin, client, brandId, connectionId, scopes, owners, stats } = options;

  for (const scope of scopes) {
    const meetings = await searchAll(client, "meetings", {
      filterGroups: [{
        filters: [{ propertyName: "associations.company", operator: "EQ", value: scope.companyExternalId }],
      }],
      properties: [
        "hs_meeting_title",
        "hs_meeting_start_time",
        "hs_meeting_end_time",
        "hs_timestamp",
        "hs_meeting_outcome",
        "hubspot_owner_id",
        "hs_activity_type",
        "hs_meeting_body",
        "hs_internal_meeting_notes",
        "hs_lastmodifieddate",
      ],
      limit: 200,
      sorts: ["hs_timestamp"],
    });

    for (const meeting of meetings) {
      stats.seen += 1;
      try {
        const externalId = meeting.id === null || meeting.id === undefined ? null : String(meeting.id);
        if (!externalId) throw new Error("HubSpot meeting is missing its ID");
        const properties = meeting.properties ?? {};
        const times = meetingTimes(properties);
        if (!times) throw new Error(`HubSpot meeting ${externalId} has no start time`);
        const externalUpdatedAt = text(properties.hs_lastmodifieddate);
        const linked = await findLink(admin, connectionId, "visits", externalId);
        const ownerExternalId = text(properties.hubspot_owner_id);
        const ownerUserId = (ownerExternalId ? owners.get(ownerExternalId) : null) ?? scope.currentAgentUserId;
        if (!ownerUserId) throw new Error(`No TR1 owner can be resolved for HubSpot meeting ${externalId}`);

        const status = visitStatus(properties.hs_meeting_outcome, times.startAt);
        const note = [
          plainText(properties.hs_meeting_body),
          plainText(properties.hs_internal_meeting_notes),
        ].filter(Boolean).join("\n\n") || null;

        if (linked) {
          const linkedUpdatedAt = linked.external_updated_at ? new Date(String(linked.external_updated_at)).getTime() : 0;
          const remoteUpdatedAt = externalUpdatedAt ? new Date(externalUpdatedAt).getTime() : 0;
          if (remoteUpdatedAt > linkedUpdatedAt) {
            const { error } = await admin
              .from("field_visits")
              .update({
                owner_user_id: ownerUserId,
                visit_kind: visitKind(properties.hs_activity_type),
                status,
                title: text(properties.hs_meeting_title) ?? "Visite HubSpot",
                scheduled_start_at: times.startAt,
                scheduled_end_at: times.endAt,
                notes: note,
                actual_start_at: status === "completed" ? times.startAt : null,
                actual_end_at: status === "completed" ? times.endAt : null,
                started_at: status === "completed" ? times.startAt : null,
                completed_at: status === "completed" ? times.endAt : null,
                source: "import",
              })
              .eq("id", linked.tr1_record_id);
            if (error) throw error;
            await saveExternalLink(admin, connectionId, "visits", externalId, String(linked.tr1_record_id), externalUpdatedAt);
          }
          stats.succeeded += 1;
          continue;
        }

        const { data: visit, error: visitError } = await admin
          .from("field_visits")
          .insert({
            owner_user_id: ownerUserId,
            pharmacy_id: scope.pharmacyId,
            visit_kind: visitKind(properties.hs_activity_type),
            status,
            title: text(properties.hs_meeting_title) ?? "Visite HubSpot",
            objective: null,
            scheduled_start_at: times.startAt,
            scheduled_end_at: times.endAt,
            notes: note,
            source: "import",
            created_by: ownerUserId,
            actual_start_at: status === "completed" ? times.startAt : null,
            actual_end_at: status === "completed" ? times.endAt : null,
            started_at: status === "completed" ? times.startAt : null,
            completed_at: status === "completed" ? times.endAt : null,
          })
          .select("id")
          .single();
        if (visitError || !visit) throw visitError ?? new Error("Unable to import HubSpot meeting");

        const { error: brandLinkError } = await admin.from("field_visit_brands").insert({
          visit_id: visit.id,
          brand_id: brandId,
          brand_pharmacy_id: scope.brandPharmacyId,
          objective: null,
          is_primary: true,
        });
        if (brandLinkError) {
          await admin.from("field_visits").delete().eq("id", visit.id);
          throw brandLinkError;
        }

        await saveExternalLink(admin, connectionId, "visits", externalId, String(visit.id), externalUpdatedAt);
        stats.succeeded += 1;
      } catch (error) {
        stats.failed += 1;
        console.error(`[hubspot] inbound meeting failed: ${safeError(error)}`);
      }
    }
  }
}

async function importHubSpotAttachment(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  interactionId: string;
  uploadedBy: string;
  fileId: string;
}) {
  const { admin, client, brandId, interactionId, uploadedBy, fileId } = options;
  const objectPathBase = `${brandId}/${interactionId}/hubspot-${fileId}`;
  const { data: existing } = await admin
    .from("interaction_attachments")
    .select("id")
    .eq("interaction_id", interactionId)
    .like("object_path", `${objectPathBase}%`)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const [metadataResponse, signedResponse] = await Promise.all([
    client.read<{ name?: string; extension?: string; type?: string; size?: number }>(
      `/files/v3/files/${encodeURIComponent(fileId)}`,
    ),
    client.read<{ url?: string }>(
      `/files/v3/files/${encodeURIComponent(fileId)}/signed-url`,
    ),
  ]);
  const signedUrl = signedResponse.data?.url;
  if (!signedUrl) throw new Error(`HubSpot file ${fileId} has no signed URL`);

  const response = await fetch(signedUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`HubSpot file ${fileId} download failed with ${response.status}`);
  const blob = await response.blob();
  const extension = text(metadataResponse.data?.extension) ?? "bin";
  const originalName = text(metadataResponse.data?.name) ?? `hubspot-${fileId}.${extension}`;
  const mimeType = response.headers.get("content-type") || text(metadataResponse.data?.type) || "application/octet-stream";
  const objectPath = `${objectPathBase}.${extension}`;

  await admin.storage.from("interaction-evidence").remove([objectPath]);
  const { error: uploadError } = await admin.storage
    .from("interaction-evidence")
    .upload(objectPath, blob, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { error: attachmentError } = await admin.from("interaction_attachments").insert({
    interaction_id: interactionId,
    brand_id: brandId,
    bucket_id: "interaction-evidence",
    object_path: objectPath,
    original_name: originalName,
    mime_type: mimeType,
    size_bytes: blob.size,
    uploaded_by: uploadedBy,
  });
  if (attachmentError) {
    await admin.storage.from("interaction-evidence").remove([objectPath]);
    throw attachmentError;
  }
}

async function syncNotes(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connectionId: string;
  scopes: PharmacyScope[];
  owners: Map<string, string>;
  stats: SyncStats;
}) {
  const { admin, client, brandId, connectionId, scopes, owners, stats } = options;

  for (const scope of scopes) {
    const notes = await searchAll(client, "notes", {
      filterGroups: [{
        filters: [{ propertyName: "associations.company", operator: "EQ", value: scope.companyExternalId }],
      }],
      properties: [
        "hs_note_body",
        "hs_timestamp",
        "hubspot_owner_id",
        "hs_attachment_ids",
        "hs_lastmodifieddate",
      ],
      limit: 200,
      sorts: ["hs_timestamp"],
    });

    for (const note of notes) {
      stats.seen += 1;
      try {
        const externalId = note.id === null || note.id === undefined ? null : String(note.id);
        if (!externalId) throw new Error("HubSpot note is missing its ID");
        const properties = note.properties ?? {};
        const externalUpdatedAt = text(properties.hs_lastmodifieddate);
        const ownerExternalId = text(properties.hubspot_owner_id);
        const ownerUserId = (ownerExternalId ? owners.get(ownerExternalId) : null) ?? scope.currentAgentUserId;
        if (!ownerUserId) throw new Error(`No TR1 owner can be resolved for HubSpot note ${externalId}`);
        const timestamp = text(properties.hs_timestamp) ?? new Date().toISOString();
        const body = plainText(properties.hs_note_body) ?? "Note HubSpot";
        const linked = await findLink(admin, connectionId, "notes", externalId);

        let interactionId: string;
        if (linked) {
          interactionId = String(linked.tr1_record_id);
          const linkedUpdatedAt = linked.external_updated_at ? new Date(String(linked.external_updated_at)).getTime() : 0;
          const remoteUpdatedAt = externalUpdatedAt ? new Date(externalUpdatedAt).getTime() : 0;
          if (remoteUpdatedAt > linkedUpdatedAt) {
            const { error } = await admin
              .from("interactions")
              .update({
                occurred_at: timestamp,
                notes: body,
                assigned_user_id: ownerUserId,
              })
              .eq("id", interactionId);
            if (error) throw error;
            await saveExternalLink(admin, connectionId, "notes", externalId, interactionId, externalUpdatedAt);
          }
        } else {
          const { data: interaction, error: interactionError } = await admin
            .from("interactions")
            .insert({
              brand_id: brandId,
              brand_pharmacy_id: scope.brandPharmacyId,
              created_by: ownerUserId,
              interaction_type: "internal_note",
              occurred_at: timestamp,
              subject: "Note HubSpot",
              notes: body,
              outcome: "other",
              assigned_user_id: ownerUserId,
              visibility: "shared",
              tags: ["hubspot"],
            })
            .select("id")
            .single();
          if (interactionError || !interaction) throw interactionError ?? new Error("Unable to import HubSpot note");
          interactionId = String(interaction.id);
          await saveExternalLink(admin, connectionId, "notes", externalId, interactionId, externalUpdatedAt);
        }

        const attachmentIds = (text(properties.hs_attachment_ids) ?? "")
          .split(/[;,]/)
          .map((value) => value.trim())
          .filter(Boolean);
        for (const fileId of attachmentIds) {
          try {
            await importHubSpotAttachment({
              admin,
              client,
              brandId,
              interactionId,
              uploadedBy: ownerUserId,
              fileId,
            });
          } catch (error) {
            if (error instanceof HubSpotApiError && (error.status === 401 || error.status === 403)) {
              console.warn(`[hubspot] file scope unavailable for attachment ${fileId}`);
              continue;
            }
            throw error;
          }
        }

        stats.succeeded += 1;
      } catch (error) {
        stats.failed += 1;
        console.error(`[hubspot] inbound note failed: ${safeError(error)}`);
      }
    }
  }
}

export async function reconcileNaaliHubSpotInbound(brandId: string, connectionId: string) {
  const admin = createAdminClient();
  const { client } = await loadConnection(admin, brandId, connectionId);
  const scopes = await mappedPharmacies(admin, brandId, connectionId);
  const owners = await ownerMap(admin, connectionId);

  const termsStats: SyncStats = { seen: 0, succeeded: 0, failed: 0 };
  await syncCommercialTerms(brandId, scopes, termsStats);

  const orders = await withRun(admin, connectionId, "orders", async (stats) => {
    await syncOrders({ admin, client, brandId, connectionId, scopes, owners, stats });
  });
  const visits = await withRun(admin, connectionId, "visits", async (stats) => {
    await syncMeetings({ admin, client, brandId, connectionId, scopes, owners, stats });
  });
  const notes = await withRun(admin, connectionId, "notes", async (stats) => {
    await syncNotes({ admin, client, brandId, connectionId, scopes, owners, stats });
  });

  return {
    pharmacies: scopes.length,
    commercialTerms: termsStats,
    orders,
    visits,
    notes,
  };
}
