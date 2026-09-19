import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient, type HubSpotClientMode } from "./client";
import { resolveNaaliFreeUnitsRuleFromLeadStatus } from "./naali-pricing";

type AdminClient = ReturnType<typeof createAdminClient>;

type HubSpotConnection = {
  id: string;
  base_url: string | null;
  credential_reference: string | null;
  configuration: Record<string, unknown> | null;
};

type RemoteObject = {
  id?: string | number;
  properties?: Record<string, unknown>;
};

type BatchReadResponse = {
  results?: RemoteObject[];
};

type AssociationResponse = {
  results?: Array<{ id?: string | number }>;
  paging?: { next?: { after?: string | number } };
};

type PharmacyContext = {
  companyExternalId: string;
  pharmacyId: string;
  brandPharmacyId: string;
  currentAgentUserId: string | null;
};

type ReconcileContext = {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  organizationId: string;
  connectionId: string;
  pharmaciesByCompany: Map<string, PharmacyContext>;
  activeBrandUsers: Set<string>;
  usersByHubSpotOwner: Map<string, string>;
};

type EntityStats = {
  seen: number;
  imported: number;
  linked: number;
  updated: number;
  skipped: number;
  failed: number;
  attachmentsImported: number;
  attachmentsFailed: number;
  errors: string[];
};

export type HubSpotInboundSummary = {
  commercialTermsSynced: number;
  orders: EntityStats;
  visits: EntityStats;
  notes: EntityStats;
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

function emptyStats(): EntityStats {
  return {
    seen: 0,
    imported: 0,
    linked: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    attachmentsImported: 0,
    attachmentsFailed: 0,
    errors: [],
  };
}

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

function externalId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "unassigned"
    ? value.trim()
    : null;
}

function number(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown) {
  const parsed = number(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function date(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function plainText(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  return raw
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || null;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown HubSpot inbound reconciliation error";
}

function addError(stats: EntityStats, label: string, error: unknown) {
  stats.failed += 1;
  if (stats.errors.length < 20) stats.errors.push(`${label}: ${safeError(error)}`);
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function parseFreeUnitsField(value: unknown) {
  const normalized = text(value);
  if (!normalized) return null;
  if (normalized === "true") return { paidQuantity: 12, freeQuantity: 1 };
  if (normalized === "false") return { paidQuantity: 24, freeQuantity: 3 };
  const match = normalized.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (!match) return null;
  const paidQuantity = Number(match[1]);
  const freeQuantity = Number(match[2]);
  return Number.isInteger(paidQuantity) && paidQuantity > 0 && Number.isInteger(freeQuantity) && freeQuantity >= 0
    ? { paidQuantity, freeQuantity }
    : null;
}

function discountRate(value: unknown) {
  const raw = text(value)?.replace("%", "").replace(",", ".");
  if (!raw || raw.toLowerCase() === "personnalisée") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function orderStatus(stage: unknown) {
  const value = text(stage);
  if (value && CLOSED_STAGES.has(value)) return "invoiced" as const;
  if (value && CANCELLED_STAGES.has(value)) return "cancelled" as const;
  return "pending" as const;
}

function orderType(value: unknown) {
  const normalized = text(value)?.toLowerCase();
  if (normalized === "implantation") return "initial" as const;
  if (normalized === "réassort") return "reorder" as const;
  if (normalized === "complément d'implantation" || normalized === "complément de réassort") return "complementary" as const;
  return "other" as const;
}

function visitKind(value: unknown) {
  const normalized = text(value)?.toLowerCase();
  if (normalized === "visite client") return "client_visit" as const;
  if (normalized === "visite prospection") return "prospecting" as const;
  if (normalized === "rendez-vous client" || normalized === "rendez-vous prospect") return "relationship" as const;
  if (normalized === "formation") return "training" as const;
  return "other" as const;
}

function visitStatus(outcome: unknown, startAt: string) {
  const normalized = text(outcome)?.toUpperCase();
  if (normalized === "COMPLETED") return "completed" as const;
  if (normalized === "CANCELED" || normalized === "NO_SHOW") return "cancelled" as const;
  if (normalized === "SCHEDULED" || normalized === "RESCHEDULED") return "planned" as const;
  return Date.parse(startAt) < Date.now() ? "completed" as const : "planned" as const;
}

function attachmentIds(value: unknown) {
  const raw = text(value);
  if (!raw) return [];
  return [...new Set(raw.split(";").map((item) => item.trim()).filter(Boolean))];
}

function safeFileName(value: string | null, fileId: string, contentType: string) {
  const fallbackExtension = contentType === "image/png"
    ? "png"
    : contentType === "image/webp"
      ? "webp"
      : contentType === "image/jpeg"
        ? "jpg"
        : "bin";
  const raw = (value || `hubspot-${fileId}.${fallbackExtension}`)
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .trim();
  return raw || `hubspot-${fileId}.${fallbackExtension}`;
}

async function activeConnection(brandId: string, connectionId: string) {
  const admin = createAdminClient();
  const { data: connection, error } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference,configuration,provider,status")
    .eq("id", connectionId)
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!connection) return null;

  const typedConnection = connection as HubSpotConnection;
  const mode = syncMode(typedConnection);
  const token = accessToken(typedConnection, mode);
  if (mode !== "write" || !token) {
    throw new Error("HubSpot inbound reconciliation requires the active write-mode server credential");
  }

  const { data: brand, error: brandError } = await admin
    .from("brands")
    .select("id,organization_id,slug")
    .eq("id", brandId)
    .maybeSingle();
  if (brandError || !brand) throw brandError ?? new Error("Brand unavailable");
  if (String(brand.slug).trim().toLowerCase() !== "naali") return null;

  const client = new HubSpotClient({
    mode,
    accessToken: token,
    baseUrl: typedConnection.base_url ?? undefined,
  });

  return { admin, client, connection: typedConnection, organizationId: String(brand.organization_id) };
}

async function loadContext(brandId: string, connectionId: string): Promise<ReconcileContext | null> {
  const runtime = await activeConnection(brandId, connectionId);
  if (!runtime) return null;
  const { admin, client, organizationId } = runtime;

  const { data: pharmacyLinks, error: pharmacyLinksError } = await admin
    .from("connector_external_links")
    .select("tr1_record_id,external_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", "pharmacies");
  if (pharmacyLinksError) throw pharmacyLinksError;

  const pharmacyIds = [...new Set((pharmacyLinks ?? []).map((row) => String(row.tr1_record_id)))];
  if (!pharmacyIds.length) {
    return {
      admin,
      client,
      brandId,
      organizationId,
      connectionId,
      pharmaciesByCompany: new Map(),
      activeBrandUsers: new Set(),
      usersByHubSpotOwner: new Map(),
    };
  }

  const [{ data: relations, error: relationsError }, { data: memberships, error: membershipsError }, { data: userLinks, error: userLinksError }] = await Promise.all([
    admin
      .from("brand_pharmacies")
      .select("id,pharmacy_id,current_agent_user_id")
      .eq("brand_id", brandId)
      .in("pharmacy_id", pharmacyIds)
      .is("archived_at", null),
    admin
      .from("memberships")
      .select("user_id")
      .eq("brand_id", brandId)
      .eq("status", "active"),
    admin
      .from("connector_external_links")
      .select("tr1_record_id,external_id")
      .eq("connection_id", connectionId)
      .eq("entity_type", "users"),
  ]);
  if (relationsError || membershipsError || userLinksError) throw relationsError ?? membershipsError ?? userLinksError;

  const relationByPharmacy = new Map((relations ?? []).map((row) => [String(row.pharmacy_id), row]));
  const activeBrandUsers = new Set((memberships ?? []).map((row) => String(row.user_id)));
  const usersByHubSpotOwner = new Map<string, string>();
  for (const row of userLinks ?? []) {
    const userId = String(row.tr1_record_id);
    if (activeBrandUsers.has(userId)) usersByHubSpotOwner.set(String(row.external_id), userId);
  }

  const pharmaciesByCompany = new Map<string, PharmacyContext>();
  for (const link of pharmacyLinks ?? []) {
    const pharmacyId = String(link.tr1_record_id);
    const relation = relationByPharmacy.get(pharmacyId);
    if (!relation) continue;
    pharmaciesByCompany.set(String(link.external_id), {
      companyExternalId: String(link.external_id),
      pharmacyId,
      brandPharmacyId: String(relation.id),
      currentAgentUserId: relation.current_agent_user_id ? String(relation.current_agent_user_id) : null,
    });
  }

  return {
    admin,
    client,
    brandId,
    organizationId,
    connectionId,
    pharmaciesByCompany,
    activeBrandUsers,
    usersByHubSpotOwner,
  };
}

function actorFor(context: ReconcileContext, pharmacy: PharmacyContext, ownerExternalId: unknown) {
  const owner = text(ownerExternalId);
  const mappedOwner = owner ? context.usersByHubSpotOwner.get(owner) : null;
  if (mappedOwner && context.activeBrandUsers.has(mappedOwner)) return mappedOwner;
  if (pharmacy.currentAgentUserId && context.activeBrandUsers.has(pharmacy.currentAgentUserId)) {
    return pharmacy.currentAgentUserId;
  }
  return null;
}

async function mappingEnabled(context: ReconcileContext, entityType: "orders" | "visits" | "notes") {
  const { data, error } = await context.admin
    .from("connector_entity_mappings")
    .select("id")
    .eq("connection_id", context.connectionId)
    .eq("entity_type", entityType)
    .eq("is_enabled", true)
    .in("direction", ["inbound", "bidirectional"])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function upsertExternalLink(
  context: ReconcileContext,
  entityType: "orders" | "visits" | "notes",
  externalRecordId: string,
  tr1RecordId: string,
  externalUpdatedAt?: string | null,
) {
  const { error } = await context.admin.rpc("upsert_connector_external_link", {
    target_connection_id: context.connectionId,
    target_entity_type: entityType,
    target_external_id: externalRecordId,
    target_tr1_record_id: tr1RecordId,
    target_external_updated_at: externalUpdatedAt ?? null,
    target_tr1_updated_at: null,
    target_sync_hash: null,
  });
  if (error) throw error;
}

async function upsertChildLink(
  context: ReconcileContext,
  parentEntityType: "orders" | "visits" | "notes",
  parentTr1RecordId: string,
  childType: "line_item" | "attachment",
  childKey: string,
  externalRecordId: string,
  externalUpdatedAt?: string | null,
) {
  const { error } = await context.admin.rpc("upsert_connector_external_child_link", {
    target_connection_id: context.connectionId,
    target_parent_entity_type: parentEntityType,
    target_parent_tr1_record_id: parentTr1RecordId,
    target_child_type: childType,
    target_child_key: childKey,
    target_external_id: externalRecordId,
    target_external_updated_at: externalUpdatedAt ?? null,
    target_sync_hash: null,
  });
  if (error) throw error;
}

async function associationIds(
  client: HubSpotClient,
  fromType: string,
  fromId: string,
  toType: string,
) {
  const ids: string[] = [];
  let after: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const query = after ? `?limit=500&after=${encodeURIComponent(after)}` : "?limit=500";
    const response = await client.read<AssociationResponse>(
      `/crm/v3/objects/${encodeURIComponent(fromType)}/${encodeURIComponent(fromId)}/associations/${encodeURIComponent(toType)}${query}`,
    );
    for (const row of response.data?.results ?? []) {
      const id = externalId(row.id);
      if (id) ids.push(id);
    }
    const next = response.data?.paging?.next?.after;
    if (next === null || next === undefined || String(next) === after) break;
    after = String(next);
  }

  return [...new Set(ids)];
}

async function batchRead(
  client: HubSpotClient,
  objectType: string,
  ids: string[],
  properties: string[],
) {
  const result: RemoteObject[] = [];
  for (const chunk of chunks([...new Set(ids)], 100)) {
    const response = await client.batchReadObjects<BatchReadResponse>(objectType, chunk, properties);
    result.push(...(response.data?.results ?? []));
  }
  return result;
}

async function openRun(context: ReconcileContext, entityType: "orders" | "visits" | "notes") {
  const { data, error } = await context.admin.rpc("register_connector_sync_run", {
    target_connection_id: context.connectionId,
    target_entity_type: entityType,
    target_direction: "inbound",
    target_cursor_before: null,
  });
  if (error || !data) throw error ?? new Error("Inbound sync run was not created");
  return String(data);
}

async function closeRun(
  context: ReconcileContext,
  runId: string,
  stats: EntityStats,
  failedHard: boolean,
) {
  const { error } = await context.admin.rpc("complete_connector_sync_run", {
    target_run_id: runId,
    target_status: failedHard ? "failed" : "succeeded",
    target_records_seen: stats.seen,
    target_records_succeeded: Math.max(0, stats.seen - stats.failed),
    target_records_failed: stats.failed,
    target_cursor_after: null,
    target_error_summary: stats.errors.length ? stats.errors.join(" | ").slice(0, 2000) : null,
  });
  if (error) throw error;
}

async function syncCommercialTerms(context: ReconcileContext) {
  const companyIds = [...context.pharmaciesByCompany.keys()];
  if (!companyIds.length) return 0;

  const companies = await batchRead(context.client, "companies", companyIds, [
    "remise_sur_facture_appliquee",
    "potentiel",
    "unites_gratuites",
    "hs_lead_status",
    "hs_lastmodifieddate",
  ]);

  let synced = 0;
  for (const remote of companies) {
    const companyId = externalId(remote.id);
    const pharmacy = companyId ? context.pharmaciesByCompany.get(companyId) : null;
    if (!companyId || !pharmacy) continue;
    const properties = remote.properties ?? {};
    const leadStatus = text(properties.hs_lead_status);
    const leadRule = resolveNaaliFreeUnitsRuleFromLeadStatus(leadStatus);
    const explicitRule = parseFreeUnitsField(properties.unites_gratuites);
    const rule = leadRule ?? explicitRule;

    const { error } = await context.admin
      .from("brand_pharmacy_commercial_terms")
      .upsert({
        brand_pharmacy_id: pharmacy.brandPharmacyId,
        brand_id: context.brandId,
        hubspot_discount_rate: discountRate(properties.remise_sur_facture_appliquee),
        hubspot_ug_paid_quantity: rule?.paidQuantity ?? null,
        hubspot_ug_free_quantity: rule?.freeQuantity ?? null,
        hubspot_potential: text(properties.potentiel),
        hubspot_lead_status: leadStatus,
        hubspot_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "brand_pharmacy_id" });
    if (error) throw error;
    synced += 1;
  }
  return synced;
}

async function loadProducts(context: ReconcileContext) {
  const { data, error } = await context.admin
    .from("products")
    .select("id,sku,ean,name,wholesale_price_ht,tax_rate")
    .eq("brand_id", context.brandId)
    .eq("is_active", true);
  if (error) throw error;
  const bySku = new Map<string, NonNullable<typeof data>[number]>();
  const byEan = new Map<string, NonNullable<typeof data>[number]>();
  for (const product of data ?? []) {
    if (product.sku) bySku.set(String(product.sku).trim().toLowerCase(), product);
    if (product.ean) byEan.set(String(product.ean).trim(), product);
  }
  return { bySku, byEan };
}

function matchProduct(
  maps: Awaited<ReturnType<typeof loadProducts>>,
  properties: Record<string, unknown>,
) {
  const sku = text(properties.hs_sku)?.toLowerCase();
  const ean = text(properties.code_ean);
  return (sku ? maps.bySku.get(sku) : null) ?? (ean ? maps.byEan.get(ean) : null) ?? null;
}

async function maybeUpdateExistingOrder(
  context: ReconcileContext,
  orderId: string,
  source: unknown,
  currentStatus: unknown,
  desiredStatus: "pending" | "invoiced" | "cancelled",
) {
  if (text(source) !== "import" || text(currentStatus) === desiredStatus) return false;
  const { error } = await context.admin
    .from("orders")
    .update({
      order_status: desiredStatus,
      cancellation_reason: desiredStatus === "cancelled" ? "Abandonnée dans HubSpot" : null,
    })
    .eq("id", orderId)
    .eq("brand_id", context.brandId);
  if (error) throw error;
  return true;
}

async function importOrder(
  context: ReconcileContext,
  pharmacy: PharmacyContext,
  deal: RemoteObject,
  productMaps: Awaited<ReturnType<typeof loadProducts>>,
) {
  const dealId = externalId(deal.id);
  if (!dealId) throw new Error("HubSpot deal has no id");
  const properties = deal.properties ?? {};
  const actor = actorFor(context, pharmacy, properties.hubspot_owner_id);
  if (!actor) throw new Error(`No active TR1 user can own HubSpot deal ${dealId}`);

  const lineIds = await associationIds(context.client, "deals", dealId, "line_items");
  if (!lineIds.length) throw new Error(`HubSpot deal ${dealId} has no line items`);
  const remoteLines = await batchRead(context.client, "line_items", lineIds, [
    "name",
    "hs_sku",
    "code_ean",
    "primary_product_id",
    "type_de_produit_naali",
    "quantity",
    "price",
    "hs_discount_percentage",
    "hs_tax_rate_group_id",
    "test_type_dug",
    "hs_lastmodifieddate",
  ]);

  const paidLines: Array<{
    remoteId: string;
    remoteUpdatedAt: string | null;
    product: ReturnType<typeof matchProduct> extends infer T ? T : never;
    quantity: number;
    unitPrice: number;
    discount: number | null;
    taxRate: number;
    ean: string | null;
  }> = [];
  const freeByProduct = new Map<string, { quantity: number; remoteIds: string[]; remoteUpdatedAt: string | null }>();
  let complete = true;

  for (const remoteLine of remoteLines) {
    const remoteId = externalId(remoteLine.id);
    const line = remoteLine.properties ?? {};
    if (!remoteId) continue;
    const type = text(line.type_de_produit_naali)?.toLowerCase() ?? "normal";
    const quantity = integer(line.quantity) ?? 0;
    const product = matchProduct(productMaps, line);

    if (type === "normal") {
      if (!product || quantity <= 0) {
        complete = false;
        continue;
      }
      const unitPrice = number(line.price) ?? number(product.wholesale_price_ht) ?? 0;
      if (unitPrice < 0) {
        complete = false;
        continue;
      }
      const groupId = text(line.hs_tax_rate_group_id);
      const taxRate = (groupId ? TAX_RATE_BY_GROUP[groupId] : null) ?? number(product.tax_rate) ?? 5.5;
      paidLines.push({
        remoteId,
        remoteUpdatedAt: date(line.hs_lastmodifieddate),
        product,
        quantity,
        unitPrice,
        discount: discountRate(line.hs_discount_percentage),
        taxRate,
        ean: text(line.code_ean),
      });
      continue;
    }

    if (type === "ug") {
      if (!product || quantity <= 0) {
        complete = false;
        continue;
      }
      const key = String(product.id);
      const existing = freeByProduct.get(key);
      freeByProduct.set(key, {
        quantity: (existing?.quantity ?? 0) + quantity,
        remoteIds: [...(existing?.remoteIds ?? []), remoteId],
        remoteUpdatedAt: date(line.hs_lastmodifieddate) ?? existing?.remoteUpdatedAt ?? null,
      });
      continue;
    }

    // Samples and portal-specific gift lines remain visible in HubSpot but are
    // not forced into TR1's paid-line model.
    complete = false;
  }

  if (!paidLines.length) throw new Error(`HubSpot deal ${dealId} has no importable paid lines`);

  const finalStatus = orderStatus(properties.dealstage);
  const orderDate = date(properties.closedate) ?? date(properties.createdate) ?? new Date().toISOString();
  const notes = [
    "Import HubSpot Naali bidirectionnel",
    number(properties.amount) == null ? null : `montant source HT ${Number(properties.amount).toFixed(2)}`,
    complete ? null : "certaines lignes cadeaux/échantillons ne sont pas représentables dans TR1",
  ].filter(Boolean).join(" · ");

  const { data: insertedOrder, error: orderError } = await context.admin
    .from("orders")
    .insert({
      organization_id: context.organizationId,
      brand_id: context.brandId,
      brand_pharmacy_id: pharmacy.brandPharmacyId,
      pharmacy_id: pharmacy.pharmacyId,
      external_order_id: dealId,
      order_number: `HS-${dealId}`,
      order_type: orderType(properties.type_de_commande),
      order_status: "pending",
      order_date: orderDate,
      source: "import",
      source_user_id: actor,
      source_agent_user_id: null,
      shipping_amount_ht: 0,
      currency_code: text(properties.deal_currency_code) ?? "EUR",
      payment_status: "not_applicable",
      notes,
      imported_at: new Date().toISOString(),
      created_by: actor,
      line_items_complete: complete,
    })
    .select("id")
    .single();
  if (orderError || !insertedOrder) throw orderError ?? new Error("TR1 order insert failed");
  const orderId = String(insertedOrder.id);

  const firstLocalItemByProduct = new Map<string, string>();
  for (const line of paidLines) {
    const productId = String(line.product!.id);
    const free = firstLocalItemByProduct.has(productId) ? 0 : (freeByProduct.get(productId)?.quantity ?? 0);
    const { data: insertedItem, error: itemError } = await context.admin
      .from("order_items")
      .insert({
        organization_id: context.organizationId,
        brand_id: context.brandId,
        order_id: orderId,
        product_id: productId,
        product_reference_id: null,
        quantity: line.quantity,
        free_quantity: free,
        unit_price_ht: line.unitPrice,
        discount_rate: line.discount,
        discount_amount_ht: 0,
        tax_rate: line.taxRate,
      })
      .select("id")
      .single();
    if (itemError || !insertedItem) throw itemError ?? new Error(`TR1 line insert failed for ${line.remoteId}`);

    const localItemId = String(insertedItem.id);
    if (!firstLocalItemByProduct.has(productId)) firstLocalItemByProduct.set(productId, localItemId);
    await upsertChildLink(context, "orders", orderId, "line_item", localItemId, line.remoteId, line.remoteUpdatedAt);
  }

  for (const [productId, free] of freeByProduct) {
    const localItemId = firstLocalItemByProduct.get(productId);
    if (!localItemId) {
      complete = false;
      continue;
    }
    const [firstFreeId] = free.remoteIds;
    if (firstFreeId) {
      await upsertChildLink(
        context,
        "orders",
        orderId,
        "line_item",
        `${localItemId}:free`,
        firstFreeId,
        free.remoteUpdatedAt,
      );
    }
  }

  const { data: totals, error: totalsError } = await context.admin
    .from("orders")
    .select("net_amount_ht")
    .eq("id", orderId)
    .single();
  if (totalsError) throw totalsError;

  const remoteAmount = number(properties.amount);
  const computedAmount = number(totals?.net_amount_ht);
  if (remoteAmount !== null && computedAmount !== null && Math.abs(remoteAmount - computedAmount) > 0.1) {
    complete = false;
    const mismatch = `Écart import HubSpot : source ${remoteAmount.toFixed(2)} € HT / lignes TR1 ${computedAmount.toFixed(2)} € HT`;
    await context.admin
      .from("orders")
      .update({
        line_items_complete: false,
        notes: `${notes} · ${mismatch}`,
      })
      .eq("id", orderId);
  } else if (!complete) {
    await context.admin.from("orders").update({ line_items_complete: false }).eq("id", orderId);
  }

  if (finalStatus !== "pending") {
    const { error: statusError } = await context.admin
      .from("orders")
      .update({
        order_status: finalStatus,
        cancellation_reason: finalStatus === "cancelled" ? "Abandonnée dans HubSpot" : null,
      })
      .eq("id", orderId);
    if (statusError) throw statusError;
  }

  await upsertExternalLink(
    context,
    "orders",
    dealId,
    orderId,
    date(properties.hs_lastmodifieddate),
  );
  return orderId;
}

async function reconcileOrders(context: ReconcileContext) {
  const stats = emptyStats();
  if (!(await mappingEnabled(context, "orders"))) return stats;
  const runId = await openRun(context, "orders");
  let failedHard = false;

  try {
    const productMaps = await loadProducts(context);
    const dealToCompany = new Map<string, string>();

    for (const companyId of context.pharmaciesByCompany.keys()) {
      try {
        for (const dealId of await associationIds(context.client, "companies", companyId, "deals")) {
          if (!dealToCompany.has(dealId)) dealToCompany.set(dealId, companyId);
        }
      } catch (error) {
        if (stats.errors.length < 20) stats.errors.push(`company ${companyId}: ${safeError(error)}`);
      }
    }

    const deals = await batchRead(context.client, "deals", [...dealToCompany.keys()], [
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
    ]);

    const { data: links, error: linksError } = await context.admin
      .from("connector_external_links")
      .select("external_id,tr1_record_id")
      .eq("connection_id", context.connectionId)
      .eq("entity_type", "orders");
    if (linksError) throw linksError;
    const orderByExternalLink = new Map((links ?? []).map((row) => [String(row.external_id), String(row.tr1_record_id)]));

    const { data: existingOrders, error: existingOrdersError } = await context.admin
      .from("orders")
      .select("id,external_order_id,source,order_status")
      .eq("brand_id", context.brandId)
      .is("archived_at", null)
      .not("external_order_id", "is", null);
    if (existingOrdersError) throw existingOrdersError;
    const orderByExternalId = new Map((existingOrders ?? []).map((row) => [String(row.external_order_id), row]));

    for (const deal of deals) {
      const dealId = externalId(deal.id);
      const properties = deal.properties ?? {};
      if (!dealId || ![COMMERCIAL_PIPELINE, AGENT_PIPELINE].includes(text(properties.pipeline) ?? "")) continue;
      stats.seen += 1;
      const companyId = dealToCompany.get(dealId);
      const pharmacy = companyId ? context.pharmaciesByCompany.get(companyId) : null;
      if (!pharmacy) {
        stats.skipped += 1;
        continue;
      }

      try {
        const desiredStatus = orderStatus(properties.dealstage);
        const linkedOrderId = orderByExternalLink.get(dealId);
        const existing = orderByExternalId.get(dealId);
        const existingOrderId = linkedOrderId ?? (existing ? String(existing.id) : null);

        if (existingOrderId) {
          if (!linkedOrderId) {
            await upsertExternalLink(context, "orders", dealId, existingOrderId, date(properties.hs_lastmodifieddate));
            stats.linked += 1;
          }
          if (existing && await maybeUpdateExistingOrder(
            context,
            existingOrderId,
            existing.source,
            existing.order_status,
            desiredStatus,
          )) {
            stats.updated += 1;
          } else {
            stats.skipped += 1;
          }
          continue;
        }

        const orderId = await importOrder(context, pharmacy, deal, productMaps);
        orderByExternalLink.set(dealId, orderId);
        stats.imported += 1;
      } catch (error) {
        addError(stats, `deal ${dealId}`, error);
      }
    }
  } catch (error) {
    failedHard = true;
    if (stats.errors.length < 20) stats.errors.push(safeError(error));
  }

  await closeRun(context, runId, stats, failedHard);
  if (failedHard) throw new Error(stats.errors[stats.errors.length - 1] ?? "Inbound order reconciliation failed");
  return stats;
}

async function findExistingVisit(
  context: ReconcileContext,
  pharmacyId: string,
  startAt: string,
) {
  const lower = new Date(Date.parse(startAt) - 5 * 60_000).toISOString();
  const upper = new Date(Date.parse(startAt) + 5 * 60_000).toISOString();
  const { data, error } = await context.admin
    .from("field_visits")
    .select("id")
    .eq("pharmacy_id", pharmacyId)
    .is("archived_at", null)
    .gte("scheduled_start_at", lower)
    .lte("scheduled_start_at", upper)
    .limit(2);
  if (error) throw error;
  return data?.length === 1 ? String(data[0].id) : null;
}

async function importAttachments(
  context: ReconcileContext,
  interactionId: string,
  actor: string,
  remoteFileIds: string[],
  stats: EntityStats,
) {
  for (const fileId of remoteFileIds) {
    try {
      const { data: existingLink, error: existingLinkError } = await context.admin
        .from("connector_external_child_links")
        .select("child_key")
        .eq("connection_id", context.connectionId)
        .eq("parent_entity_type", "notes")
        .eq("parent_tr1_record_id", interactionId)
        .eq("child_type", "attachment")
        .eq("external_id", fileId)
        .limit(1)
        .maybeSingle();
      if (existingLinkError) throw existingLinkError;
      if (existingLink) continue;

      const downloaded = await context.client.downloadFile(fileId);
      const fileName = safeFileName(downloaded.fileName, fileId, downloaded.contentType);
      const objectPath = `${context.brandId}/${interactionId}/hubspot-${fileId}-${fileName}`;

      const { error: uploadError } = await context.admin.storage
        .from("interaction-evidence")
        .upload(objectPath, await downloaded.blob.arrayBuffer(), {
          contentType: downloaded.contentType,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: existingAttachment, error: existingAttachmentError } = await context.admin
        .from("interaction_attachments")
        .select("id")
        .eq("interaction_id", interactionId)
        .eq("object_path", objectPath)
        .is("archived_at", null)
        .maybeSingle();
      if (existingAttachmentError) throw existingAttachmentError;

      let localAttachmentId = existingAttachment?.id ? String(existingAttachment.id) : null;
      if (!localAttachmentId) {
        const { data: inserted, error: insertError } = await context.admin
          .from("interaction_attachments")
          .insert({
            interaction_id: interactionId,
            brand_id: context.brandId,
            bucket_id: "interaction-evidence",
            object_path: objectPath,
            original_name: fileName,
            mime_type: downloaded.contentType,
            size_bytes: downloaded.blob.size,
            uploaded_by: actor,
          })
          .select("id")
          .single();
        if (insertError || !inserted) throw insertError ?? new Error("TR1 attachment insert failed");
        localAttachmentId = String(inserted.id);
      }

      await upsertChildLink(
        context,
        "notes",
        interactionId,
        "attachment",
        localAttachmentId,
        fileId,
        null,
      );
      stats.attachmentsImported += 1;
    } catch (error) {
      stats.attachmentsFailed += 1;
      if (stats.errors.length < 20) stats.errors.push(`file ${fileId}: ${safeError(error)}`);
    }
  }
}

async function reconcileVisits(context: ReconcileContext) {
  const stats = emptyStats();
  if (!(await mappingEnabled(context, "visits"))) return stats;
  const runId = await openRun(context, "visits");
  let failedHard = false;

  try {
    const meetingToCompany = new Map<string, string>();
    for (const companyId of context.pharmaciesByCompany.keys()) {
      try {
        for (const meetingId of await associationIds(context.client, "companies", companyId, "meetings")) {
          if (!meetingToCompany.has(meetingId)) meetingToCompany.set(meetingId, companyId);
        }
      } catch (error) {
        if (stats.errors.length < 20) stats.errors.push(`company ${companyId}: ${safeError(error)}`);
      }
    }

    const meetings = await batchRead(context.client, "meetings", [...meetingToCompany.keys()], [
      "hs_meeting_title",
      "hs_meeting_start_time",
      "hs_meeting_end_time",
      "hs_timestamp",
      "hs_meeting_outcome",
      "hubspot_owner_id",
      "hs_activity_type",
      "hs_meeting_body",
      "hs_internal_meeting_notes",
      "hs_attachment_ids",
      "hs_lastmodifieddate",
    ]);

    const { data: links, error: linksError } = await context.admin
      .from("connector_external_links")
      .select("external_id,tr1_record_id")
      .eq("connection_id", context.connectionId)
      .eq("entity_type", "visits");
    if (linksError) throw linksError;
    const linked = new Map((links ?? []).map((row) => [String(row.external_id), String(row.tr1_record_id)]));

    for (const meeting of meetings) {
      const meetingId = externalId(meeting.id);
      if (!meetingId) continue;
      stats.seen += 1;
      const companyId = meetingToCompany.get(meetingId);
      const pharmacy = companyId ? context.pharmaciesByCompany.get(companyId) : null;
      if (!pharmacy) {
        stats.skipped += 1;
        continue;
      }

      try {
        if (linked.has(meetingId)) {
          stats.skipped += 1;
          continue;
        }

        const properties = meeting.properties ?? {};
        const startAt = date(properties.hs_meeting_start_time) ?? date(properties.hs_timestamp);
        if (!startAt) {
          stats.skipped += 1;
          continue;
        }
        const actor = actorFor(context, pharmacy, properties.hubspot_owner_id);
        if (!actor) throw new Error(`No active TR1 user can own HubSpot meeting ${meetingId}`);

        const existingVisitId = await findExistingVisit(context, pharmacy.pharmacyId, startAt);
        if (existingVisitId) {
          await upsertExternalLink(context, "visits", meetingId, existingVisitId, date(properties.hs_lastmodifieddate));
          linked.set(meetingId, existingVisitId);
          stats.linked += 1;
          continue;
        }

        const rawEndAt = date(properties.hs_meeting_end_time);
        const endAt = rawEndAt && Date.parse(rawEndAt) > Date.parse(startAt)
          ? rawEndAt
          : new Date(Date.parse(startAt) + 45 * 60_000).toISOString();
        const status = visitStatus(properties.hs_meeting_outcome, startAt);
        const title = text(properties.hs_meeting_title) ?? "Activité HubSpot";
        const body = [plainText(properties.hs_meeting_body), plainText(properties.hs_internal_meeting_notes)]
          .filter(Boolean)
          .join("\n\n") || null;

        const { data: insertedVisit, error: visitError } = await context.admin
          .from("field_visits")
          .insert({
            owner_user_id: actor,
            pharmacy_id: pharmacy.pharmacyId,
            visit_kind: visitKind(properties.hs_activity_type),
            status,
            title,
            objective: body,
            scheduled_start_at: startAt,
            scheduled_end_at: endAt,
            notes: body,
            source: "import",
            created_by: actor,
            actual_start_at: status === "completed" ? startAt : null,
            actual_end_at: status === "completed" ? endAt : null,
            started_at: status === "completed" ? startAt : null,
            completed_at: status === "completed" ? endAt : null,
          })
          .select("id")
          .single();
        if (visitError || !insertedVisit) throw visitError ?? new Error("TR1 visit insert failed");
        const visitId = String(insertedVisit.id);

        const { error: brandLinkError } = await context.admin
          .from("field_visit_brands")
          .insert({
            visit_id: visitId,
            brand_id: context.brandId,
            brand_pharmacy_id: pharmacy.brandPharmacyId,
            objective: body,
            is_primary: true,
          });
        if (brandLinkError) throw brandLinkError;

        const { data: interaction, error: interactionError } = await context.admin
          .from("interactions")
          .insert({
            brand_id: context.brandId,
            created_by: actor,
            interaction_type: "visit",
            occurred_at: startAt,
            subject: title,
            notes: body,
            brand_pharmacy_id: pharmacy.brandPharmacyId,
            outcome: "completed",
            assigned_user_id: actor,
            visibility: "shared",
            field_visit_id: visitId,
            tags: [],
          })
          .select("id")
          .single();
        if (interactionError || !interaction) throw interactionError ?? new Error("TR1 visit interaction insert failed");
        const interactionId = String(interaction.id);

        await upsertExternalLink(context, "visits", meetingId, visitId, date(properties.hs_lastmodifieddate));
        linked.set(meetingId, visitId);
        await importAttachments(context, interactionId, actor, attachmentIds(properties.hs_attachment_ids), stats);
        stats.imported += 1;
      } catch (error) {
        addError(stats, `meeting ${meetingId}`, error);
      }
    }
  } catch (error) {
    failedHard = true;
    if (stats.errors.length < 20) stats.errors.push(safeError(error));
  }

  await closeRun(context, runId, stats, failedHard);
  if (failedHard) throw new Error(stats.errors[stats.errors.length - 1] ?? "Inbound visit reconciliation failed");
  return stats;
}

async function reconcileNotes(context: ReconcileContext) {
  const stats = emptyStats();
  if (!(await mappingEnabled(context, "notes"))) return stats;
  const runId = await openRun(context, "notes");
  let failedHard = false;

  try {
    const noteToCompany = new Map<string, string>();
    for (const companyId of context.pharmaciesByCompany.keys()) {
      try {
        for (const noteId of await associationIds(context.client, "companies", companyId, "notes")) {
          if (!noteToCompany.has(noteId)) noteToCompany.set(noteId, companyId);
        }
      } catch (error) {
        if (stats.errors.length < 20) stats.errors.push(`company ${companyId}: ${safeError(error)}`);
      }
    }

    const notes = await batchRead(context.client, "notes", [...noteToCompany.keys()], [
      "hs_note_body",
      "hs_timestamp",
      "hubspot_owner_id",
      "hs_attachment_ids",
      "hs_lastmodifieddate",
    ]);

    const { data: links, error: linksError } = await context.admin
      .from("connector_external_links")
      .select("external_id,tr1_record_id")
      .eq("connection_id", context.connectionId)
      .eq("entity_type", "notes");
    if (linksError) throw linksError;
    const linked = new Map((links ?? []).map((row) => [String(row.external_id), String(row.tr1_record_id)]));

    for (const note of notes) {
      const noteId = externalId(note.id);
      if (!noteId) continue;
      stats.seen += 1;
      const companyId = noteToCompany.get(noteId);
      const pharmacy = companyId ? context.pharmaciesByCompany.get(companyId) : null;
      if (!pharmacy) {
        stats.skipped += 1;
        continue;
      }

      try {
        if (linked.has(noteId)) {
          stats.skipped += 1;
          continue;
        }
        const properties = note.properties ?? {};
        const occurredAt = date(properties.hs_timestamp) ?? new Date().toISOString();
        const actor = actorFor(context, pharmacy, properties.hubspot_owner_id);
        if (!actor) throw new Error(`No active TR1 user can own HubSpot note ${noteId}`);
        const body = plainText(properties.hs_note_body);
        const firstLine = body?.split("\n").map((item) => item.trim()).find(Boolean);
        const subject = (firstLine || "Note HubSpot").slice(0, 240);

        const { data: interaction, error: interactionError } = await context.admin
          .from("interactions")
          .insert({
            brand_id: context.brandId,
            created_by: actor,
            interaction_type: "internal_note",
            occurred_at: occurredAt,
            subject,
            notes: body,
            brand_pharmacy_id: pharmacy.brandPharmacyId,
            outcome: "completed",
            assigned_user_id: actor,
            visibility: "shared",
            tags: [],
          })
          .select("id")
          .single();
        if (interactionError || !interaction) throw interactionError ?? new Error("TR1 note insert failed");
        const interactionId = String(interaction.id);

        await upsertExternalLink(context, "notes", noteId, interactionId, date(properties.hs_lastmodifieddate));
        linked.set(noteId, interactionId);
        await importAttachments(context, interactionId, actor, attachmentIds(properties.hs_attachment_ids), stats);
        stats.imported += 1;
      } catch (error) {
        addError(stats, `note ${noteId}`, error);
      }
    }
  } catch (error) {
    failedHard = true;
    if (stats.errors.length < 20) stats.errors.push(safeError(error));
  }

  await closeRun(context, runId, stats, failedHard);
  if (failedHard) throw new Error(stats.errors[stats.errors.length - 1] ?? "Inbound note reconciliation failed");
  return stats;
}

export async function reconcileNaaliHubSpotInbound(
  brandId: string,
  connectionId: string,
): Promise<HubSpotInboundSummary> {
  const context = await loadContext(brandId, connectionId);
  if (!context) {
    return {
      commercialTermsSynced: 0,
      orders: emptyStats(),
      visits: emptyStats(),
      notes: emptyStats(),
    };
  }

  const commercialTermsSynced = await syncCommercialTerms(context);
  const orders = await reconcileOrders(context);
  const visits = await reconcileVisits(context);
  const notes = await reconcileNotes(context);

  return { commercialTermsSynced, orders, visits, notes };
}
