import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient, type HubSpotClientMode } from "./client";
import { hubSpotRunFailureStatus } from "./runtime-status";
import { NAALI_HUBSPOT_CONFIGURATION } from "./naali";
import { resolveNaaliFreeUnitsRuleFromLeadStatus } from "./naali-pricing";
import { syncHubSpotOrderAfterPersistence } from "./runtime";

type AdminClient = ReturnType<typeof createAdminClient>;

type HubSpotConnection = {
  id: string;
  base_url: string | null;
  credential_reference: string | null;
  configuration: Record<string, unknown> | null;
  updated_by: string | null;
  last_synced_at: string | null;
};

type HubSpotRecord = {
  id?: string | number;
  properties?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

type HubSpotSearch = {
  total?: number;
  results?: HubSpotRecord[];
  paging?: { next?: { after?: string | number } };
};

type PharmacyContext = {
  pharmacyId: string;
  brandPharmacyId: string;
  companyId: string;
  currentAgentUserId: string | null;
};

type ProductContext = {
  id: string;
  sku: string | null;
  ean: string | null;
  taxRate: number;
};

type SyncCounter = {
  seen: number;
  succeeded: number;
  failed: number;
};

export type HubSpotReconciliationSummary = {
  terms: SyncCounter;
  orders: SyncCounter;
  visits: SyncCounter;
  notes: SyncCounter;
};

const CLOSED_STAGES = new Set(["2110945491", "2111064276"]);
const ABANDONED_STAGES = new Set(["5787539670", "5787546853"]);
const NAALI_PIPELINES = ["1543644371", "1543733493"];

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

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(value: unknown) {
  const parsed = numberValue(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function externalId(record: HubSpotRecord) {
  if (record.id === null || record.id === undefined) return null;
  const value = String(record.id).trim();
  return value || null;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parsePercentage(value: unknown) {
  const normalized = text(value)?.replace("%", "").replace(",", ".");
  if (!normalized || normalized.toLowerCase() === "personnalisée") return null;
  const rate = Number(normalized);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
}

function parseExplicitFreeUnits(value: unknown) {
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

function hubSpotAttachmentIds(value: unknown) {
  return [...new Set(String(value ?? "").split(/[;,]/).map((item) => item.trim()).filter(Boolean))];
}

function safeFileName(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return safe.slice(0, 180) || "hubspot-file";
}

function stripHtml(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarySubject(body: string) {
  const firstLine = body.split(/\n/).map((line) => line.trim()).find(Boolean) || "Note HubSpot";
  return firstLine.slice(0, 180);
}

function visitKind(activityType: unknown) {
  const value = normalize(activityType);
  if (value === "visite client") return "client_visit";
  if (value === "visite prospection") return "prospecting";
  if (value === "rendez-vous client" || value === "rendez-vous prospect") return "relationship";
  if (value === "formation") return "training";
  return "other";
}

function visitStatus(outcome: unknown) {
  const value = String(outcome ?? "").trim().toUpperCase();
  if (value === "COMPLETED") return "completed";
  if (value === "CANCELED" || value === "NO_SHOW") return "cancelled";
  if (value === "SCHEDULED" || value === "RESCHEDULED") return "planned";
  return "planned";
}

function orderStatus(stage: unknown) {
  const value = String(stage ?? "").trim();
  if (CLOSED_STAGES.has(value)) return "invoiced";
  if (ABANDONED_STAGES.has(value)) return "cancelled";
  return "pending";
}

function inboundOrderType(value: unknown) {
  const normalized = normalize(value);
  if (normalized === "complement d'implantation" || normalized === "complement de reassort") {
    return "complementary";
  }
  // Initial/reorder classification is rebuilt by TR1 from the chronological
  // order history once the imported order becomes commercially valid.
  return "other";
}

async function lastSuccessfulInboundSyncAt(
  admin: AdminClient,
  connectionId: string,
  entityType: "orders" | "visits" | "notes",
) {
  const { data, error } = await admin
    .from("connector_sync_runs")
    .select("completed_at")
    .eq("connection_id", connectionId)
    .eq("entity_type", entityType)
    .eq("direction", "inbound")
    .eq("status", "succeeded")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.completed_at ? String(data.completed_at) : null;
}

function searchFiltersSince(since: string | null) {
  if (!since) return [];
  const milliseconds = new Date(since).getTime();
  return Number.isFinite(milliseconds)
    ? [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(milliseconds) }]
    : [];
}

async function activeConnection(brandId: string, connectionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference,configuration,provider,status,updated_by,last_synced_at")
    .eq("id", connectionId)
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const connection = data as HubSpotConnection;
  const mode = syncMode(connection);
  const token = accessToken(connection, mode);
  if (mode !== "write" || !token) {
    throw new Error("HubSpot runtime write/read credentials are not enabled in this environment");
  }
  const client = new HubSpotClient({
    mode,
    accessToken: token,
    baseUrl: connection.base_url ?? undefined,
  });
  return { admin, connection, client };
}

async function searchAll(
  client: HubSpotClient,
  objectType: string,
  body: Record<string, unknown>,
) {
  const results: HubSpotRecord[] = [];
  let after: string | number | undefined;
  for (let page = 0; page < 100; page += 1) {
    const response = await client.searchObjects<HubSpotSearch>(objectType, {
      ...body,
      limit: 200,
      ...(after === undefined ? {} : { after }),
    });
    const data = response.data;
    results.push(...(data?.results ?? []));
    after = data?.paging?.next?.after;
    if (after === undefined || after === null || after === "") break;
  }
  return results;
}

async function mappedPharmacies(admin: AdminClient, brandId: string, connectionId: string) {
  const { data: links, error: linksError } = await admin
    .from("connector_external_links")
    .select("tr1_record_id,external_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", "pharmacies");
  if (linksError) throw linksError;
  const pharmacyIds = (links ?? []).map((row) => String(row.tr1_record_id));
  if (!pharmacyIds.length) return [] as PharmacyContext[];

  const { data: relations, error: relationsError } = await admin
    .from("brand_pharmacies")
    .select("id,pharmacy_id,current_agent_user_id")
    .eq("brand_id", brandId)
    .in("pharmacy_id", pharmacyIds)
    .is("archived_at", null);
  if (relationsError) throw relationsError;
  const byPharmacy = new Map((relations ?? []).map((row) => [String(row.pharmacy_id), row]));

  return (links ?? []).flatMap((link) => {
    const relation = byPharmacy.get(String(link.tr1_record_id));
    if (!relation) return [];
    return [{
      pharmacyId: String(link.tr1_record_id),
      brandPharmacyId: String(relation.id),
      companyId: String(link.external_id),
      currentAgentUserId: relation.current_agent_user_id ? String(relation.current_agent_user_id) : null,
    }];
  });
}


type HubSpotAssociationList = {
  results?: Array<{ id?: string | number }>;
};

type HubSpotCompanyRead = {
  properties?: Record<string, unknown>;
  updatedAt?: string;
};

function hubSpotCompanyIdentity(value: unknown) {
  const raw = text(value) ?? "Pharmacie HubSpot";
  const parts = raw.split(/\s+-\s+/);
  const name = parts[0]?.trim() || raw;
  const cip = parts.slice(1).find((part) => /^\d{6,8}$/.test(part.trim()))?.trim() ?? null;
  return { name, cip };
}


type HubSpotNoteCandidate = {
  id: string;
  timestamp: string;
  body: string;
  updatedAt: string | null;
};

function parisDayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

async function closeoutNoteForMeeting(options: {
  client: HubSpotClient;
  companyId: string;
  ownerExternalId: string | null;
  meetingStart: string;
  nextMeetingStart: string | null;
}) {
  const meetingDay = parisDayKey(options.meetingStart);
  const lowerBound = new Date(new Date(options.meetingStart).getTime() - 36 * 60 * 60_000).toISOString();
  const filters: Record<string, unknown>[] = [
    { propertyName: "associations.company", operator: "EQ", value: options.companyId },
    { propertyName: "hs_timestamp", operator: "GTE", value: String(new Date(lowerBound).getTime()) },
  ];
  if (options.ownerExternalId) {
    filters.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: options.ownerExternalId });
  }

  const notes = await searchAll(options.client, "notes", {
    filterGroups: [{ filters }],
    properties: [
      "hs_note_body",
      "hs_timestamp",
      "hubspot_owner_id",
      "hs_lastmodifieddate",
    ],
    sorts: ["hs_timestamp"],
  });

  const nextMeetingDay = options.nextMeetingStart ? parisDayKey(options.nextMeetingStart) : null;
  const candidates = notes.flatMap((remote) => {
    const noteId = externalId(remote);
    const timestamp = text(remote.properties?.hs_timestamp) ?? remote.createdAt ?? null;
    if (!noteId || !timestamp) return [];
    const noteDay = parisDayKey(timestamp);
    if (noteDay < meetingDay) return [];
    if (nextMeetingDay && noteDay >= nextMeetingDay) return [];
    return [{
      id: noteId,
      timestamp,
      body: stripHtml(remote.properties?.hs_note_body),
      updatedAt: remote.updatedAt ?? text(remote.properties?.hs_lastmodifieddate),
    } satisfies HubSpotNoteCandidate];
  });

  candidates.sort((left, right) => {
    const leftSameDay = parisDayKey(left.timestamp) === meetingDay ? 0 : 1;
    const rightSameDay = parisDayKey(right.timestamp) === meetingDay ? 0 : 1;
    if (leftSameDay !== rightSameDay) return leftSameDay - rightSameDay;
    return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  });

  return candidates[0] ?? null;
}

async function applyHubSpotMeetingCloseout(options: {
  admin: AdminClient;
  brandId: string;
  actorId: string;
  visitId: string;
  pharmacy: PharmacyContext;
  meetingStart: string;
  meetingEnd: string;
  note: HubSpotNoteCandidate;
}) {
  const completedAt = new Date(options.note.timestamp).getTime() >= new Date(options.meetingStart).getTime()
    ? options.note.timestamp
    : options.meetingEnd;

  const { error: visitError } = await options.admin
    .from("field_visits")
    .update({
      status: "completed",
      actual_start_at: options.meetingStart,
      actual_end_at: completedAt,
      started_at: options.meetingStart,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.visitId)
    .is("archived_at", null);
  if (visitError) throw visitError;

  const { data: existingCloseout, error: closeoutLookupError } = await options.admin
    .from("field_visit_closeouts")
    .select("visit_id")
    .eq("visit_id", options.visitId)
    .maybeSingle();
  if (closeoutLookupError) throw closeoutLookupError;

  if (!existingCloseout) {
    const { error: closeoutError } = await options.admin
      .from("field_visit_closeouts")
      .insert({
        visit_id: options.visitId,
        created_by: options.actorId,
        outcome: "other",
        summary: options.note.body || "Compte rendu HubSpot présent sur la fiche pharmacie.",
        input_mode: "manual",
        structured_payload: {
          source: "hubspot_note",
          external_note_id: options.note.id,
        },
        completed_at: completedAt,
      });
    if (closeoutError) throw closeoutError;
  }

  const { data: existingInteraction, error: interactionLookupError } = await options.admin
    .from("interactions")
    .select("id")
    .eq("brand_id", options.brandId)
    .eq("field_visit_id", options.visitId)
    .eq("interaction_type", "visit")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (interactionLookupError) throw interactionLookupError;

  if (existingInteraction?.id) {
    const { error } = await options.admin
      .from("interactions")
      .update({
        notes: options.note.body || "Compte rendu HubSpot présent sur la fiche pharmacie.",
        outcome: "completed",
        occurred_at: options.meetingStart,
      })
      .eq("id", existingInteraction.id);
    if (error) throw error;
  }
}

async function objectCompanyIds(
  client: HubSpotClient,
  objectType: "meetings" | "deals",
  objectId: string,
) {
  const response = await client.read<HubSpotAssociationList>(
    `/crm/v3/objects/${objectType}/${encodeURIComponent(objectId)}/associations/companies?limit=100`,
  );
  return (response.data?.results ?? [])
    .map((row) => row.id === null || row.id === undefined ? null : String(row.id))
    .filter((value): value is string => Boolean(value));
}

async function meetingCompanyIds(client: HubSpotClient, meetingId: string) {
  return objectCompanyIds(client, "meetings", meetingId);
}

async function dealCompanyIds(client: HubSpotClient, dealId: string) {
  return objectCompanyIds(client, "deals", dealId);
}

type HubSpotCloseoutNote = {
  id: string;
  occurredAt: string;
  body: string;
};

function parisCalendarDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

async function findHubSpotCloseoutNote(options: {
  client: HubSpotClient;
  companyId: string;
  meetingStart: string;
  nextMeetingStart?: string | null;
}) {
  const meetingStartMs = new Date(options.meetingStart).getTime();
  if (!Number.isFinite(meetingStartMs)) return null;

  const filters: Array<Record<string, unknown>> = [
    {
      propertyName: "hs_timestamp",
      operator: "GTE",
      value: String(meetingStartMs - 24 * 60 * 60_000),
    },
  ];
  if (options.nextMeetingStart) {
    const nextStartMs = new Date(options.nextMeetingStart).getTime();
    if (Number.isFinite(nextStartMs)) {
      filters.push({
        propertyName: "hs_timestamp",
        operator: "LT",
        value: String(nextStartMs),
      });
    }
  }

  const notes = await searchAll(options.client, "notes", {
    filterGroups: [{
      filters: [
        { propertyName: "associations.company", operator: "EQ", value: options.companyId },
        ...filters,
      ],
    }],
    properties: ["hs_note_body", "hs_timestamp", "hs_lastmodifieddate"],
    sorts: ["hs_timestamp"],
  });

  const meetingDate = parisCalendarDate(options.meetingStart);
  const candidates = notes.flatMap((note) => {
    const id = externalId(note);
    const occurredAt = text(note.properties?.hs_timestamp) ?? note.createdAt ?? null;
    if (!id || !occurredAt) return [];
    const occurredMs = new Date(occurredAt).getTime();
    if (!Number.isFinite(occurredMs) || parisCalendarDate(occurredAt) < meetingDate) return [];
    return [{
      id,
      occurredAt,
      body: stripHtml(note.properties?.hs_note_body) || "Note HubSpot",
    }];
  }).sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());

  return candidates[0] ?? null;
}

async function ensurePharmacyForHubSpotCompany(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connectionId: string;
  actorId: string;
  ownerUserId: string;
  companyId: string;
  byCompany: Map<string, PharmacyContext>;
  sourceDetails?: string;
}) {
  const cached = options.byCompany.get(options.companyId);
  if (cached) return cached;

  const { data: mappedLink, error: mappedLinkError } = await options.admin
    .from("connector_external_links")
    .select("tr1_record_id")
    .eq("connection_id", options.connectionId)
    .eq("entity_type", "pharmacies")
    .eq("external_id", options.companyId)
    .limit(1)
    .maybeSingle();
  if (mappedLinkError) throw mappedLinkError;

  let pharmacyId = mappedLink?.tr1_record_id ? String(mappedLink.tr1_record_id) : null;
  let companyUpdatedAt: string | null = null;

  if (!pharmacyId) {
    const company = await options.client.read<HubSpotCompanyRead>(
      `/crm/v3/objects/companies/${encodeURIComponent(options.companyId)}?properties=name,address,address2,city,zip,phone,domain`,
    );
    const properties = company.data?.properties ?? {};
    companyUpdatedAt = company.data?.updatedAt ?? null;
    const identity = hubSpotCompanyIdentity(properties.name);
    const postalCode = text(properties.zip);

    let existing: { id: string } | null = null;
    if (identity.cip) {
      const { data, error } = await options.admin
        .from("pharmacies")
        .select("id")
        .eq("cip_code", identity.cip)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      existing = data ? { id: String(data.id) } : null;
    }

    if (!existing && postalCode) {
      const { data, error } = await options.admin
        .from("pharmacies")
        .select("id")
        .eq("postal_code", postalCode)
        .ilike("trade_name", identity.name)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      existing = data ? { id: String(data.id) } : null;
    }

    if (!existing && postalCode) {
      const { data, error } = await options.admin
        .from("pharmacies")
        .select("id")
        .eq("postal_code", postalCode)
        .ilike("legal_name", identity.name)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      existing = data ? { id: String(data.id) } : null;
    }

    if (existing) {
      pharmacyId = existing.id;
    } else {
      const { data: inserted, error } = await options.admin
        .from("pharmacies")
        .insert({
          legal_name: identity.name,
          trade_name: identity.name,
          cip_code: identity.cip,
          postal_code: postalCode,
          city: text(properties.city),
          address_line_1: text(properties.address),
          address_line_2: text(properties.address2),
          phone: text(properties.phone),
          website: text(properties.domain),
          created_by: options.actorId,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        throw error ?? new Error(`Unable to create TR1 pharmacy for HubSpot company ${options.companyId}`);
      }
      pharmacyId = String(inserted.id);
    }

    await saveExternalLink({
      admin: options.admin,
      connectionId: options.connectionId,
      entityType: "pharmacies",
      externalId: options.companyId,
      tr1RecordId: pharmacyId,
      externalUpdatedAt: companyUpdatedAt,
    });
  }

  const { data: relation, error: relationError } = await options.admin
    .from("brand_pharmacies")
    .select("id,current_agent_user_id")
    .eq("brand_id", options.brandId)
    .eq("pharmacy_id", pharmacyId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (relationError) throw relationError;

  let brandPharmacyId: string;
  let currentAgentUserId = relation?.current_agent_user_id ? String(relation.current_agent_user_id) : null;

  if (relation) {
    brandPharmacyId = String(relation.id);
    if (!currentAgentUserId) {
      const { error } = await options.admin
        .from("brand_pharmacies")
        .update({ current_agent_user_id: options.ownerUserId, updated_at: new Date().toISOString() })
        .eq("id", relation.id)
        .eq("brand_id", options.brandId);
      if (error) throw error;
      currentAgentUserId = options.ownerUserId;
    }
  } else {
    const { data: inserted, error } = await options.admin
      .from("brand_pharmacies")
      .insert({
        brand_id: options.brandId,
        pharmacy_id: pharmacyId,
        current_agent_user_id: options.ownerUserId,
        source: "import",
        source_details: options.sourceDetails ?? "HubSpot import",
        created_by: options.actorId,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      throw error ?? new Error(`Unable to create brand pharmacy for HubSpot company ${options.companyId}`);
    }
    brandPharmacyId = String(inserted.id);
    currentAgentUserId = options.ownerUserId;
  }

  const context: PharmacyContext = {
    pharmacyId,
    brandPharmacyId,
    companyId: options.companyId,
    currentAgentUserId,
  };
  options.byCompany.set(options.companyId, context);
  return context;
}

async function syncActorUserId(admin: AdminClient, brandId: string, connection: HubSpotConnection) {
  if (connection.updated_by) {
    const { data } = await admin
      .from("memberships")
      .select("user_id")
      .eq("brand_id", brandId)
      .eq("user_id", connection.updated_by)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return String(data.user_id);
  }

  const { data, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("brand_id", brandId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.user_id) throw new Error("No active TR1 user is available as HubSpot import actor");
  return String(data.user_id);
}

async function ownerMap(admin: AdminClient, connectionId: string) {
  const { data, error } = await admin
    .from("connector_external_links")
    .select("tr1_record_id,external_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", "users");
  if (error) throw error;
  return new Map((data ?? []).map((row) => [String(row.external_id), String(row.tr1_record_id)]));
}

async function existingExternalLinks(
  admin: AdminClient,
  connectionId: string,
  entityType: "orders" | "visits" | "notes",
) {
  const { data, error } = await admin
    .from("connector_external_links")
    .select("tr1_record_id,external_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", entityType);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [String(row.external_id), String(row.tr1_record_id)]));
}

async function saveExternalLink(options: {
  admin: AdminClient;
  connectionId: string;
  entityType: "orders" | "visits" | "notes" | "products" | "pharmacies";
  externalId: string;
  tr1RecordId: string;
  externalUpdatedAt?: string | null;
}) {
  const { error } = await options.admin.rpc("upsert_connector_external_link", {
    target_connection_id: options.connectionId,
    target_entity_type: options.entityType,
    target_external_id: options.externalId,
    target_tr1_record_id: options.tr1RecordId,
    target_external_updated_at: options.externalUpdatedAt ?? null,
    target_tr1_updated_at: new Date().toISOString(),
    target_sync_hash: null,
  });
  if (error) throw error;
}

async function saveAttachmentLink(options: {
  admin: AdminClient;
  connectionId: string;
  parentEntityType: "visits" | "notes";
  parentTr1RecordId: string;
  attachmentId: string;
  externalId: string;
}) {
  const { error } = await options.admin.rpc("upsert_connector_external_child_link", {
    target_connection_id: options.connectionId,
    target_parent_entity_type: options.parentEntityType,
    target_parent_tr1_record_id: options.parentTr1RecordId,
    target_child_type: "attachment",
    target_child_key: options.attachmentId,
    target_external_id: options.externalId,
    target_external_updated_at: null,
    target_sync_hash: null,
  });
  if (error) throw error;
}

async function runInbound(
  admin: AdminClient,
  connectionId: string,
  entityType: "orders" | "visits" | "notes",
  task: (counter: SyncCounter) => Promise<void>,
) {
  const counter: SyncCounter = { seen: 0, succeeded: 0, failed: 0 };
  const { data: runId, error: runError } = await admin.rpc("register_connector_sync_run", {
    target_connection_id: connectionId,
    target_entity_type: entityType,
    target_direction: "inbound",
    target_cursor_before: null,
  });
  if (runError || !runId) throw runError ?? new Error("HubSpot inbound sync run was not created");

  try {
    await task(counter);
    const { error } = await admin.rpc("complete_connector_sync_run", {
      target_run_id: String(runId),
      target_status: counter.failed ? "partial" : "succeeded",
      target_records_seen: counter.seen,
      target_records_succeeded: counter.succeeded,
      target_records_failed: counter.failed,
      target_cursor_after: null,
      target_error_summary: counter.failed ? `${counter.failed} record(s) require review` : null,
    });
    if (error) throw error;
    return counter;
  } catch (error) {
    await admin.rpc("complete_connector_sync_run", {
      target_run_id: String(runId),
      target_status: hubSpotRunFailureStatus(error),
      target_records_seen: Math.max(counter.seen, 1),
      target_records_succeeded: counter.succeeded,
      target_records_failed: Math.max(counter.failed, 1),
      target_cursor_after: null,
      target_error_summary: error instanceof Error ? error.message.slice(0, 500) : "HubSpot inbound sync failed",
    });
    throw error;
  }
}

async function syncNaaliCatalog(
  admin: AdminClient,
  client: HubSpotClient,
  brandId: string,
  connectionId: string,
) {
  const records = await searchAll(client, "products", {
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
  });

  for (const remote of records) {
    const properties = remote.properties ?? {};
    const remoteId = externalId(remote);
    const sku = text(properties.hs_sku);
    const name = text(properties.name);
    if (!remoteId || !sku || !name) continue;

    const { data: existing, error: existingError } = await admin
      .from("products")
      .select("id,retail_price_ttc,tax_rate,minimum_order_quantity,units_per_case")
      .eq("brand_id", brandId)
      .eq("sku", sku)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const payload = {
      name,
      description: text(properties.description),
      ean: text(properties.code_ean),
      wholesale_price_ht: numberValue(properties.hs_price_eur),
      retail_price_ttc: numberValue(properties.pvc) ?? existing?.retail_price_ttc ?? null,
      tax_rate: existing?.tax_rate ?? 5.5,
      minimum_order_quantity: numberValue(properties.quantity_rule_minimum) ?? existing?.minimum_order_quantity ?? null,
      units_per_case: numberValue(properties.quantity_rule_increment) ?? existing?.units_per_case ?? null,
      is_active: true,
      discontinued_at: null,
      updated_at: new Date().toISOString(),
    };

    let productId: string;
    if (existing) {
      const { error } = await admin.from("products").update(payload).eq("id", existing.id).eq("brand_id", brandId);
      if (error) throw error;
      productId = String(existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("products")
        .insert({ brand_id: brandId, sku, ...payload })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error(`Unable to import HubSpot product ${sku}`);
      productId = String(inserted.id);
    }

    await saveExternalLink({
      admin,
      connectionId,
      entityType: "products",
      externalId: remoteId,
      tr1RecordId: productId,
      externalUpdatedAt: remote.updatedAt ?? null,
    });
  }
}

async function syncCommercialTerms(
  admin: AdminClient,
  client: HubSpotClient,
  brandId: string,
  pharmacies: PharmacyContext[],
) {
  const counter: SyncCounter = { seen: 0, succeeded: 0, failed: 0 };
  for (const pharmacy of pharmacies) {
    counter.seen += 1;
    try {
      const response = await client.read<{ properties?: Record<string, unknown> }>(
        `/crm/v3/objects/companies/${encodeURIComponent(pharmacy.companyId)}?properties=remise_sur_facture_appliquee,potentiel,unites_gratuites,hs_lead_status`,
      );
      const properties = response.data?.properties ?? {};
      const leadRule = resolveNaaliFreeUnitsRuleFromLeadStatus(text(properties.hs_lead_status));
      const explicitRule = parseExplicitFreeUnits(properties.unites_gratuites);
      const rule = leadRule ?? explicitRule;
      const snapshot = {
        hubspot_discount_rate: parsePercentage(properties.remise_sur_facture_appliquee),
        hubspot_ug_paid_quantity: rule?.paidQuantity ?? null,
        hubspot_ug_free_quantity: rule?.freeQuantity ?? null,
        hubspot_potential: text(properties.potentiel),
        hubspot_lead_status: text(properties.hs_lead_status),
        hubspot_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: existing, error: existingError } = await admin
        .from("brand_pharmacy_commercial_terms")
        .select("brand_pharmacy_id")
        .eq("brand_pharmacy_id", pharmacy.brandPharmacyId)
        .eq("brand_id", brandId)
        .maybeSingle();
      if (existingError) throw existingError;

      const { error } = existing
        ? await admin
            .from("brand_pharmacy_commercial_terms")
            .update(snapshot)
            .eq("brand_pharmacy_id", pharmacy.brandPharmacyId)
            .eq("brand_id", brandId)
        : await admin
            .from("brand_pharmacy_commercial_terms")
            .insert({
              brand_pharmacy_id: pharmacy.brandPharmacyId,
              brand_id: brandId,
              ...snapshot,
            });
      if (error) throw error;
      counter.succeeded += 1;
    } catch {
      counter.failed += 1;
    }
  }
  return counter;
}

async function productMaps(admin: AdminClient, brandId: string) {
  const { data, error } = await admin
    .from("products")
    .select("id,sku,ean,tax_rate")
    .eq("brand_id", brandId)
    .is("discontinued_at", null);
  if (error) throw error;

  const bySku = new Map<string, ProductContext>();
  const byEan = new Map<string, ProductContext>();
  for (const row of data ?? []) {
    const product: ProductContext = {
      id: String(row.id),
      sku: row.sku ? String(row.sku) : null,
      ean: row.ean ? String(row.ean) : null,
      taxRate: Number(row.tax_rate ?? 5.5),
    };
    if (product.sku) bySku.set(product.sku.toLowerCase(), product);
    if (product.ean) byEan.set(product.ean, product);
  }
  return { bySku, byEan };
}

function taxRateFor(groupId: unknown, product: ProductContext) {
  const id = text(groupId);
  if (!id) return product.taxRate;
  const pair = Object.entries(NAALI_HUBSPOT_CONFIGURATION.order.taxRateGroupIds ?? {})
    .find(([, value]) => value === id);
  return pair ? Number(pair[0]) : product.taxRate;
}


type HubSpotOrderItem = {
  product_id: string;
  quantity: number;
  free_quantity: number;
  unit_price_ht: number;
  discount_rate: number | null;
  tax_rate: number;
  remote_line_id: string | null;
  remote_free_line_id: string | null;
};

async function loadHubSpotOrderItems(
  client: HubSpotClient,
  remoteId: string,
  products: Awaited<ReturnType<typeof productMaps>>,
) {
  const lineRecords = await searchAll(client, "line_items", {
    filterGroups: [{
      filters: [{ propertyName: "associations.deal", operator: "EQ", value: remoteId }],
    }],
    properties: [
      "name",
      "hs_sku",
      "code_ean",
      "type_de_produit_naali",
      "quantity",
      "price",
      "hs_discount_percentage",
      "hs_tax_rate_group_id",
      "test_type_dug",
    ],
  });

  const freeByEan = new Map<string, { quantity: number; externalId: string | null }>();
  for (const line of lineRecords) {
    const properties = line.properties ?? {};
    const type = normalize(properties.type_de_produit_naali);
    const reason = normalize(properties.test_type_dug);
    const ean = text(properties.code_ean);
    const quantity = integerValue(properties.quantity);
    if (type === "ug" && reason.includes("conditions commerciale") && ean && quantity !== null && quantity >= 0) {
      const previous = freeByEan.get(ean);
      freeByEan.set(ean, {
        quantity: (previous?.quantity ?? 0) + quantity,
        externalId: previous?.externalId ?? externalId(line),
      });
    }
  }

  const items: HubSpotOrderItem[] = [];
  const unresolved: string[] = [];

  for (const line of lineRecords) {
    const properties = line.properties ?? {};
    const type = normalize(properties.type_de_produit_naali);
    if (type === "ug" || type.includes("echantillon")) continue;

    const quantity = integerValue(properties.quantity);
    const price = numberValue(properties.price);
    if (quantity === null || quantity <= 0 || price === null) continue;

    const sku = text(properties.hs_sku);
    const ean = text(properties.code_ean);
    const product = (sku ? products.bySku.get(sku.toLowerCase()) : null) ?? (ean ? products.byEan.get(ean) : null);
    if (!product) {
      unresolved.push(sku || ean || text(properties.name) || externalId(line) || "ligne inconnue");
      continue;
    }

    const free = ean ? freeByEan.get(ean) : null;
    items.push({
      product_id: product.id,
      quantity,
      free_quantity: free?.quantity ?? 0,
      unit_price_ht: price,
      discount_rate: parsePercentage(properties.hs_discount_percentage),
      tax_rate: taxRateFor(properties.hs_tax_rate_group_id, product),
      remote_line_id: externalId(line),
      remote_free_line_id: free?.externalId ?? null,
    });
  }

  return { items, unresolved };
}

async function insertHubSpotOrderItems(options: {
  admin: AdminClient;
  connectionId: string;
  brandId: string;
  orderId: string;
  items: HubSpotOrderItem[];
}) {
  for (const item of options.items) {
    const { remote_line_id, remote_free_line_id, ...persistedItem } = item;
    const { data: insertedItem, error: itemError } = await options.admin
      .from("order_items")
      .insert({
        ...persistedItem,
        brand_id: options.brandId,
        order_id: options.orderId,
      })
      .select("id")
      .single();
    if (itemError || !insertedItem) {
      throw itemError ?? new Error(`Unable to import HubSpot line for order ${options.orderId}`);
    }

    const itemId = String(insertedItem.id);
    if (remote_line_id) {
      const { error: linkError } = await options.admin.rpc("upsert_connector_external_child_link", {
        target_connection_id: options.connectionId,
        target_parent_entity_type: "orders",
        target_parent_tr1_record_id: options.orderId,
        target_child_type: "line_item",
        target_child_key: itemId,
        target_external_id: remote_line_id,
        target_external_updated_at: null,
        target_sync_hash: null,
      });
      if (linkError) throw linkError;
    }
    if (remote_free_line_id && item.free_quantity > 0) {
      const { error: freeLinkError } = await options.admin.rpc("upsert_connector_external_child_link", {
        target_connection_id: options.connectionId,
        target_parent_entity_type: "orders",
        target_parent_tr1_record_id: options.orderId,
        target_child_type: "line_item",
        target_child_key: `${itemId}:free`,
        target_external_id: remote_free_line_id,
        target_external_updated_at: null,
        target_sync_hash: null,
      });
      if (freeLinkError) throw freeLinkError;
    }
  }
}

async function importOrder(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  organizationId: string;
  connectionId: string;
  actorId: string;
  pharmacy: PharmacyContext;
  remote: HubSpotRecord;
  orderLinks: Map<string, string>;
  products: Awaited<ReturnType<typeof productMaps>>;
}) {
  const { admin, client, brandId, organizationId, connectionId, actorId, pharmacy, remote, orderLinks, products } = options;
  const remoteId = externalId(remote);
  if (!remoteId) throw new Error("HubSpot deal has no id");

  const linkedOrderId = orderLinks.get(remoteId) ?? null;
  const { data: existingOrder, error: existingError } = await admin
    .from("orders")
    .select("id,source,order_status,external_order_id,order_number,net_amount_ht")
    .eq("brand_id", brandId)
    .eq(linkedOrderId ? "id" : "external_order_id", linkedOrderId ?? remoteId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingOrder?.id) {
    const existingOrderId = String(existingOrder.id);
    const properties = remote.properties ?? {};
    const sourceAmount = numberValue(properties.amount);
    const desiredStatus = orderStatus(properties.dealstage);
    const date = CLOSED_STAGES.has(String(properties.dealstage ?? ""))
      ? text(properties.closedate) ?? text(properties.createdate) ?? remote.createdAt
      : text(properties.createdate) ?? remote.createdAt ?? text(properties.closedate);
    const isHubSpotOrigin = String(existingOrder.external_order_id ?? "") === remoteId
      || String(existingOrder.order_number ?? "") === `HS-${remoteId}`;

    await saveExternalLink({
      admin,
      connectionId,
      entityType: "orders",
      externalId: remoteId,
      tr1RecordId: existingOrderId,
      externalUpdatedAt: remote.updatedAt ?? text(properties.hs_lastmodifieddate),
    });
    orderLinks.set(remoteId, existingOrderId);

    // Preserve TR1-created orders (mapping strategy: tr1_wins). Only records
    // that originated from HubSpot are refreshed from HubSpot.
    if (isHubSpotOrigin && existingOrder.source === "import" && existingOrder.order_status !== "needs_correction") {
      const existingAmount = Number(existingOrder.net_amount_ht ?? 0);
      const amountChanged = sourceAmount !== null && Math.abs(existingAmount - sourceAmount) > 0.15;

      if (amountChanged) {
        const { items, unresolved } = await loadHubSpotOrderItems(client, remoteId, products);
        if (!items.length || unresolved.length) {
          const { error: correctionError } = await admin
            .from("orders")
            .update({
              order_status: "needs_correction",
              line_items_complete: false,
              notes: `Import HubSpot à revoir · montant HubSpot ${sourceAmount?.toFixed(2) ?? "inconnu"} · références à mapper : ${unresolved.join(", ") || "aucune ligne exploitable"}`,
            })
            .eq("id", existingOrderId)
            .eq("brand_id", brandId);
          if (correctionError) throw correctionError;
          return;
        }

        const { error: childLinksError } = await admin
          .from("connector_external_child_links")
          .delete()
          .eq("connection_id", connectionId)
          .eq("parent_entity_type", "orders")
          .eq("parent_tr1_record_id", existingOrderId);
        if (childLinksError) throw childLinksError;

        const { error: deleteItemsError } = await admin
          .from("order_items")
          .delete()
          .eq("order_id", existingOrderId)
          .eq("brand_id", brandId);
        if (deleteItemsError) throw deleteItemsError;

        await insertHubSpotOrderItems({
          admin,
          connectionId,
          brandId,
          orderId: existingOrderId,
          items,
        });

        const { data: refreshedTotals, error: refreshedTotalsError } = await admin
          .from("orders")
          .select("net_amount_ht")
          .eq("id", existingOrderId)
          .single();
        if (refreshedTotalsError) throw refreshedTotalsError;
        const recalculated = Number(refreshedTotals?.net_amount_ht ?? 0);
        if (sourceAmount !== null && Math.abs(recalculated - sourceAmount) > 0.15) {
          const { error: correctionError } = await admin
            .from("orders")
            .update({
              order_status: "needs_correction",
              line_items_complete: false,
              notes: `Import HubSpot à revoir · écart lignes/source ${recalculated.toFixed(2)} vs ${sourceAmount.toFixed(2)}`,
            })
            .eq("id", existingOrderId)
            .eq("brand_id", brandId);
          if (correctionError) throw correctionError;
          return;
        }
      }

      const { error: refreshError } = await admin
        .from("orders")
        .update({
          order_status: desiredStatus,
          cancellation_reason: desiredStatus === "cancelled" ? "Abandonnée dans HubSpot" : null,
          ...(date ? { order_date: date } : {}),
          currency_code: text(properties.deal_currency_code) ?? "EUR",
          imported_at: new Date().toISOString(),
          line_items_complete: true,
        })
        .eq("id", existingOrderId)
        .eq("brand_id", brandId);
      if (refreshError) throw refreshError;
    }
    return;
  }

  const { items, unresolved } = await loadHubSpotOrderItems(client, remoteId, products);

  const properties = remote.properties ?? {};
  const sourceAmount = numberValue(properties.amount);
  const targetStatus = orderStatus(properties.dealstage);
  const date = CLOSED_STAGES.has(String(properties.dealstage ?? ""))
    ? text(properties.closedate) ?? text(properties.createdate) ?? remote.createdAt
    : text(properties.createdate) ?? remote.createdAt ?? text(properties.closedate);
  if (!date) throw new Error(`HubSpot deal ${remoteId} has no usable date`);

  const needsCorrectionBeforeTotals = !items.length || unresolved.length > 0;
  const notes = [
    "Import HubSpot Naali bidirectionnel",
    text(properties.hubspot_owner_id) ? `propriétaire HubSpot ${text(properties.hubspot_owner_id)}` : null,
    sourceAmount !== null ? `montant source HT ${sourceAmount.toFixed(2)}` : null,
    unresolved.length ? `références à mapper : ${unresolved.join(", ")}` : null,
  ].filter(Boolean).join(" · ");

  const { data: inserted, error: insertError } = await admin
    .from("orders")
    .insert({
      organization_id: organizationId,
      brand_id: brandId,
      brand_pharmacy_id: pharmacy.brandPharmacyId,
      pharmacy_id: pharmacy.pharmacyId,
      created_by: actorId,
      source_user_id: actorId,
      order_status: "pending",
      order_date: date,
      external_order_id: remoteId,
      order_number: `HS-${remoteId}`,
      order_type: inboundOrderType(properties.type_de_commande),
      source: "import",
      currency_code: text(properties.deal_currency_code) ?? "EUR",
      notes: text(properties.dealname) ? `${notes} · ${text(properties.dealname)}` : notes,
      imported_at: new Date().toISOString(),
      line_items_complete: !needsCorrectionBeforeTotals,
    })
    .select("id")
    .single();
  if (insertError || !inserted) throw insertError ?? new Error(`Unable to import HubSpot deal ${remoteId}`);
  const orderId = String(inserted.id);

  await insertHubSpotOrderItems({
    admin,
    connectionId,
    brandId,
    orderId,
    items,
  });

  const { data: totals, error: totalsError } = await admin
    .from("orders")
    .select("net_amount_ht")
    .eq("id", orderId)
    .single();
  if (totalsError) throw totalsError;
  const calculated = Number(totals?.net_amount_ht ?? 0);
  const mismatch = sourceAmount !== null && Math.abs(calculated - sourceAmount) > 0.15;
  const finalStatus = needsCorrectionBeforeTotals || mismatch ? "needs_correction" : targetStatus;
  const { error: updateError } = await admin
    .from("orders")
    .update({
      order_status: finalStatus,
      line_items_complete: !needsCorrectionBeforeTotals && !mismatch,
      notes: mismatch
        ? `${notes} · écart lignes/source ${calculated.toFixed(2)} vs ${sourceAmount?.toFixed(2)}`
        : notes,
    })
    .eq("id", orderId);
  if (updateError) throw updateError;

  await saveExternalLink({
    admin,
    connectionId,
    entityType: "orders",
    externalId: remoteId,
    tr1RecordId: orderId,
    externalUpdatedAt: remote.updatedAt ?? text(properties.hs_lastmodifieddate),
  });
  orderLinks.set(remoteId, orderId);

  if (finalStatus === "needs_correction") {
    console.warn(`[hubspot] imported deal ${remoteId} requires correction`);
  }
}

async function importHubSpotAttachments(options: {
  admin: AdminClient;
  client: HubSpotClient;
  connectionId: string;
  brandId: string;
  actorId: string;
  parentEntityType: "visits" | "notes";
  parentTr1RecordId: string;
  interactionId: string;
  externalIds: string[];
}) {
  for (const fileId of options.externalIds) {
    try {
      const downloaded = await options.client.downloadFile(fileId);
      const fileName = safeFileName(downloaded.fileName || `hubspot-${fileId}`);
      const objectPath = `${options.brandId}/${options.interactionId}/hubspot-${fileId}-${fileName}`;
      const { error: uploadError } = await options.admin.storage
        .from("interaction-evidence")
        .upload(objectPath, downloaded.blob, { contentType: downloaded.contentType, upsert: false });
      if (uploadError && !String(uploadError.message).toLowerCase().includes("already exists")) throw uploadError;

      const { data: existing } = await options.admin
        .from("interaction_attachments")
        .select("id")
        .eq("interaction_id", options.interactionId)
        .eq("object_path", objectPath)
        .is("archived_at", null)
        .maybeSingle();

      let attachmentId = existing?.id ? String(existing.id) : null;
      if (!attachmentId) {
        const { data: inserted, error } = await options.admin
          .from("interaction_attachments")
          .insert({
            interaction_id: options.interactionId,
            brand_id: options.brandId,
            bucket_id: "interaction-evidence",
            object_path: objectPath,
            original_name: fileName,
            mime_type: downloaded.contentType,
            size_bytes: downloaded.blob.size,
            uploaded_by: options.actorId,
          })
          .select("id")
          .single();
        if (error || !inserted) throw error ?? new Error(`Unable to persist HubSpot file ${fileId}`);
        attachmentId = String(inserted.id);
      }

      await saveAttachmentLink({
        admin: options.admin,
        connectionId: options.connectionId,
        parentEntityType: options.parentEntityType,
        parentTr1RecordId: options.parentTr1RecordId,
        attachmentId,
        externalId: fileId,
      });
    } catch (error) {
      console.error(
        `[hubspot] attachment ${fileId} import failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown"}`,
      );
    }
  }
}

async function importVisit(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connectionId: string;
  actorId: string;
  pharmacy: PharmacyContext;
  remote: HubSpotRecord;
  visitLinks: Map<string, string>;
  owners: Map<string, string>;
  nextMeetingStart?: string | null;
}) {
  const remoteId = externalId(options.remote);
  if (!remoteId) throw new Error("HubSpot meeting has no id");

  const properties = options.remote.properties ?? {};
  const start = text(properties.hs_meeting_start_time) ?? text(properties.hs_timestamp);
  if (!start) throw new Error(`HubSpot meeting ${remoteId} has no start time`);
  const rawEnd = text(properties.hs_meeting_end_time);
  const startMs = new Date(start).getTime();
  const rawEndMs = rawEnd ? new Date(rawEnd).getTime() : Number.NaN;
  const end = Number.isFinite(rawEndMs) && rawEndMs > startMs
    ? rawEnd!
    : new Date(startMs + 30 * 60_000).toISOString();
  const ownerExternalId = text(properties.hubspot_owner_id);
  const ownerUserId = (ownerExternalId ? options.owners.get(ownerExternalId) : null) ?? options.actorId;
  const providerStatus = visitStatus(properties.hs_meeting_outcome);
  const closeoutNote = await findHubSpotCloseoutNote({
    client: options.client,
    companyId: options.pharmacy.companyId,
    meetingStart: start,
    nextMeetingStart: options.nextMeetingStart,
  });
  const status = providerStatus === "cancelled" ? "cancelled" : closeoutNote ? "completed" : "planned";
  const body = [stripHtml(properties.hs_meeting_body), stripHtml(properties.hs_internal_meeting_notes)]
    .filter(Boolean)
    .join("\n\n");
  const attachmentIds = hubSpotAttachmentIds(properties.hs_attachment_ids);

  let existingVisitId = options.visitLinks.get(remoteId) ?? null;
  if (!existingVisitId) {
    const lower = new Date(startMs - 5 * 60_000).toISOString();
    const upper = new Date(startMs + 5 * 60_000).toISOString();
    const { data: candidates, error: candidateError } = await options.admin
      .from("field_visits")
      .select("id")
      .eq("pharmacy_id", options.pharmacy.pharmacyId)
      .is("archived_at", null)
      .gte("scheduled_start_at", lower)
      .lte("scheduled_start_at", upper)
      .limit(2);
    if (candidateError) throw candidateError;
    if (candidates?.length === 1) existingVisitId = String(candidates[0].id);
  }

  if (existingVisitId) {
    await saveExternalLink({
      admin: options.admin,
      connectionId: options.connectionId,
      entityType: "visits",
      externalId: remoteId,
      tr1RecordId: existingVisitId,
      externalUpdatedAt: options.remote.updatedAt ?? text(properties.hs_lastmodifieddate),
    });
    options.visitLinks.set(remoteId, existingVisitId);

    if (closeoutNote) {
      const { error: visitUpdateError } = await options.admin
        .from("field_visits")
        .update({
          status: "completed",
          actual_start_at: start,
          actual_end_at: end,
          started_at: start,
          completed_at: closeoutNote.occurredAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingVisitId)
        .neq("status", "completed");
      if (visitUpdateError) throw visitUpdateError;

      const { data: existingCloseout, error: closeoutReadError } = await options.admin
        .from("field_visit_closeouts")
        .select("id")
        .eq("visit_id", existingVisitId)
        .limit(1)
        .maybeSingle();
      if (closeoutReadError) throw closeoutReadError;

      if (!existingCloseout) {
        const { error: closeoutError } = await options.admin
          .from("field_visit_closeouts")
          .insert({
            visit_id: existingVisitId,
            created_by: options.actorId,
            outcome: "other",
            summary: closeoutNote.body,
            input_mode: "manual",
            structured_payload: {
              source: "hubspot",
              hubspot_meeting_id: remoteId,
              hubspot_note_id: closeoutNote.id,
            },
            completed_at: closeoutNote.occurredAt,
          });
        if (closeoutError) throw closeoutError;
      }
    }

    const { data: existingInteraction, error: existingInteractionError } = await options.admin
      .from("interactions")
      .select("id")
      .eq("brand_id", options.brandId)
      .eq("field_visit_id", existingVisitId)
      .eq("interaction_type", "visit")
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (existingInteractionError) throw existingInteractionError;

    let interactionId = existingInteraction?.id ? String(existingInteraction.id) : null;
    if (!interactionId) {
      const { data: createdInteraction, error: createInteractionError } = await options.admin
        .from("interactions")
        .insert({
          brand_id: options.brandId,
          brand_pharmacy_id: options.pharmacy.brandPharmacyId,
          created_by: options.actorId,
          interaction_type: "visit",
          occurred_at: start,
          subject: text(properties.hs_meeting_title) ?? "Meeting HubSpot",
          notes: body || "Meeting importé depuis HubSpot.",
          outcome: status === "completed" ? "completed" : "other",
          assigned_user_id: ownerUserId,
          visibility: "shared",
          field_visit_id: existingVisitId,
          tags: ["hubspot_meeting_import"],
        })
        .select("id")
        .single();
      if (createInteractionError || !createdInteraction) {
        throw createInteractionError ?? new Error("Unable to create imported meeting interaction");
      }
      interactionId = String(createdInteraction.id);
    }

    if (attachmentIds.length) {
      await importHubSpotAttachments({
        admin: options.admin,
        client: options.client,
        connectionId: options.connectionId,
        brandId: options.brandId,
        actorId: options.actorId,
        parentEntityType: "visits",
        parentTr1RecordId: existingVisitId,
        interactionId,
        externalIds: attachmentIds,
      });
    }
    return existingVisitId;
  }

  const { data: inserted, error } = await options.admin
    .from("field_visits")
    .insert({
      owner_user_id: ownerUserId,
      pharmacy_id: options.pharmacy.pharmacyId,
      visit_kind: visitKind(properties.hs_activity_type),
      status,
      title: text(properties.hs_meeting_title) ?? "Meeting HubSpot",
      objective: null,
      scheduled_start_at: start,
      scheduled_end_at: end,
      notes: [
        body || null,
        ownerExternalId && !options.owners.has(ownerExternalId) ? `Import HubSpot · propriétaire externe ${ownerExternalId}` : null,
      ].filter(Boolean).join("\n\n") || null,
      source: "import",
      created_by: options.actorId,
      actual_start_at: status === "completed" ? start : null,
      actual_end_at: status === "completed" ? end : null,
      started_at: status === "completed" ? start : null,
      completed_at: status === "completed" ? closeoutNote?.occurredAt ?? end : null,
      outcome: null,
    })
    .select("id")
    .single();
  if (error || !inserted) throw error ?? new Error(`Unable to import HubSpot meeting ${remoteId}`);
  const visitId = String(inserted.id);

  const { error: brandLinkError } = await options.admin
    .from("field_visit_brands")
    .insert({
      visit_id: visitId,
      brand_id: options.brandId,
      brand_pharmacy_id: options.pharmacy.brandPharmacyId,
      objective: null,
      is_primary: true,
    });
  if (brandLinkError) throw brandLinkError;

  if (status === "completed") {
    const { error: closeoutError } = await options.admin
      .from("field_visit_closeouts")
      .insert({
        visit_id: visitId,
        created_by: options.actorId,
        outcome: "other",
        summary: closeoutNote?.body || body || text(properties.hs_meeting_title) || "Meeting HubSpot complété.",
        input_mode: "manual",
        structured_payload: {
          source: "hubspot",
          hubspot_meeting_id: remoteId,
          hubspot_note_id: closeoutNote?.id ?? null,
        },
        completed_at: closeoutNote?.occurredAt ?? end,
      });
    if (closeoutError) throw closeoutError;
  }

  await saveExternalLink({
    admin: options.admin,
    connectionId: options.connectionId,
    entityType: "visits",
    externalId: remoteId,
    tr1RecordId: visitId,
    externalUpdatedAt: options.remote.updatedAt ?? text(properties.hs_lastmodifieddate),
  });
  options.visitLinks.set(remoteId, visitId);

  const { data: interaction, error: interactionError } = await options.admin
    .from("interactions")
    .insert({
      brand_id: options.brandId,
      brand_pharmacy_id: options.pharmacy.brandPharmacyId,
      created_by: options.actorId,
      interaction_type: "visit",
      occurred_at: start,
      subject: text(properties.hs_meeting_title) ?? "Meeting HubSpot",
      notes: body || "Meeting importé depuis HubSpot.",
      outcome: status === "completed" ? "completed" : "other",
      assigned_user_id: ownerUserId,
      visibility: "shared",
      field_visit_id: visitId,
      tags: ["hubspot_meeting_import"],
    })
    .select("id")
    .single();
  if (interactionError || !interaction) throw interactionError ?? new Error("Unable to create meeting interaction");

  if (attachmentIds.length) {
    await importHubSpotAttachments({
      admin: options.admin,
      client: options.client,
      connectionId: options.connectionId,
      brandId: options.brandId,
      actorId: options.actorId,
      parentEntityType: "visits",
      parentTr1RecordId: visitId,
      interactionId: String(interaction.id),
      externalIds: attachmentIds,
    });
  }

  return visitId;
}

async function importNote(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connectionId: string;
  actorId: string;
  pharmacy: PharmacyContext;
  remote: HubSpotRecord;
  noteLinks: Map<string, string>;
  owners: Map<string, string>;
}) {
  const remoteId = externalId(options.remote);
  if (!remoteId) throw new Error("HubSpot note has no id");

  const properties = options.remote.properties ?? {};
  const body = stripHtml(properties.hs_note_body);
  const occurredAt = text(properties.hs_timestamp) ?? options.remote.createdAt ?? new Date().toISOString();
  const ownerExternalId = text(properties.hubspot_owner_id);
  const ownerUserId = (ownerExternalId ? options.owners.get(ownerExternalId) : null) ?? options.actorId;
  const remoteAttachments = hubSpotAttachmentIds(properties.hs_attachment_ids);

  let existingInteractionId = options.noteLinks.get(remoteId) ?? null;
  if (!existingInteractionId) {
    const lower = new Date(new Date(occurredAt).getTime() - 60_000).toISOString();
    const upper = new Date(new Date(occurredAt).getTime() + 60_000).toISOString();
    const { data: candidates, error: candidatesError } = await options.admin
      .from("interactions")
      .select("id,notes")
      .eq("brand_id", options.brandId)
      .eq("brand_pharmacy_id", options.pharmacy.brandPharmacyId)
      .eq("interaction_type", "internal_note")
      .is("archived_at", null)
      .gte("occurred_at", lower)
      .lte("occurred_at", upper)
      .limit(3);
    if (candidatesError) throw candidatesError;
    const matching = (candidates ?? []).filter((candidate) => (candidate.notes ?? "") === (body || "Note HubSpot sans contenu texte."));
    if (matching.length === 1) existingInteractionId = String(matching[0].id);
  }

  if (existingInteractionId) {
    await saveExternalLink({
      admin: options.admin,
      connectionId: options.connectionId,
      entityType: "notes",
      externalId: remoteId,
      tr1RecordId: existingInteractionId,
      externalUpdatedAt: options.remote.updatedAt ?? text(properties.hs_lastmodifieddate),
    });
    options.noteLinks.set(remoteId, existingInteractionId);
    if (remoteAttachments.length) {
      await importHubSpotAttachments({
        admin: options.admin,
        client: options.client,
        connectionId: options.connectionId,
        brandId: options.brandId,
        actorId: ownerUserId,
        parentEntityType: "notes",
        parentTr1RecordId: existingInteractionId,
        interactionId: existingInteractionId,
        externalIds: remoteAttachments,
      });
    }
    return;
  }

  const { data: interaction, error } = await options.admin
    .from("interactions")
    .insert({
      brand_id: options.brandId,
      brand_pharmacy_id: options.pharmacy.brandPharmacyId,
      created_by: ownerUserId,
      interaction_type: "internal_note",
      occurred_at: occurredAt,
      subject: summarySubject(body),
      notes: body || "Note HubSpot sans contenu texte.",
      outcome: "other",
      assigned_user_id: ownerUserId,
      visibility: "shared",
      tags: ["hubspot_import"],
    })
    .select("id")
    .single();
  if (error || !interaction) throw error ?? new Error(`Unable to import HubSpot note ${remoteId}`);
  const interactionId = String(interaction.id);

  await saveExternalLink({
    admin: options.admin,
    connectionId: options.connectionId,
    entityType: "notes",
    externalId: remoteId,
    tr1RecordId: interactionId,
    externalUpdatedAt: options.remote.updatedAt ?? text(properties.hs_lastmodifieddate),
  });
  options.noteLinks.set(remoteId, interactionId);

  await importHubSpotAttachments({
    admin: options.admin,
    client: options.client,
    connectionId: options.connectionId,
    brandId: options.brandId,
    actorId: ownerUserId,
    parentEntityType: "notes",
    parentTr1RecordId: interactionId,
    interactionId,
    externalIds: remoteAttachments,
  });
}

async function syncInboundOrders(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  organizationId: string;
  connection: HubSpotConnection;
  pharmacies: PharmacyContext[];
  actorId: string;
  owners: Map<string, string>;
}) {
  const since = await lastSuccessfulInboundSyncAt(options.admin, options.connection.id, "orders" as const);
  const products = await productMaps(options.admin, options.brandId);
  const links = await existingExternalLinks(options.admin, options.connection.id, "orders");
  const byCompany = new Map(options.pharmacies.map((pharmacy) => [pharmacy.companyId, pharmacy]));
  const ownerExternalIds = [...options.owners.keys()];

  return runInbound(options.admin, options.connection.id, "orders", async (counter) => {
    const records = ownerExternalIds.length
      ? await searchAll(options.client, "deals", {
          filterGroups: [{
            filters: [
              { propertyName: "hubspot_owner_id", operator: "IN", values: ownerExternalIds },
              { propertyName: "pipeline", operator: "IN", values: NAALI_PIPELINES },
              ...searchFiltersSince(since),
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
          sorts: ["createdate"],
        })
      : [];

    for (const remote of records) {
      counter.seen += 1;
      try {
        const remoteId = externalId(remote);
        if (!remoteId) throw new Error("HubSpot deal has no id");

        const ownerExternalId = text(remote.properties?.hubspot_owner_id);
        const ownerUserId = (ownerExternalId ? options.owners.get(ownerExternalId) : null) ?? options.actorId;
        const companyIds = await dealCompanyIds(options.client, remoteId);
        if (!companyIds.length) throw new Error(`HubSpot deal ${remoteId} has no company association`);

        let pharmacy = companyIds.map((companyId) => byCompany.get(companyId)).find(Boolean) ?? null;
        if (!pharmacy) {
          let lastError: unknown = null;
          for (const companyId of companyIds) {
            try {
              pharmacy = await ensurePharmacyForHubSpotCompany({
                admin: options.admin,
                client: options.client,
                brandId: options.brandId,
                connectionId: options.connection.id,
                actorId: options.actorId,
                ownerUserId,
                companyId,
                byCompany,
                sourceDetails: "HubSpot deal import",
              });
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (!pharmacy) {
            throw lastError ?? new Error(`Unable to resolve pharmacy for HubSpot deal ${remoteId}`);
          }
        }

        await importOrder({
          admin: options.admin,
          client: options.client,
          brandId: options.brandId,
          organizationId: options.organizationId,
          connectionId: options.connection.id,
          actorId: options.actorId,
          pharmacy,
          remote,
          orderLinks: links,
          products,
        });
        counter.succeeded += 1;
      } catch (error) {
        counter.failed += 1;
        console.error(
          `[hubspot] inbound order failed: ${error instanceof Error ? error.message.slice(0, 400) : "unknown"}`,
        );
      }
    }
  });
}

async function isNaaliClientCompany(
  client: HubSpotClient,
  companyId: string,
  cache: Map<string, boolean>,
) {
  const cached = cache.get(companyId);
  if (cached !== undefined) return cached;

  const response = await client.read<{ properties?: Record<string, unknown> }>(
    `/crm/v3/objects/companies/${encodeURIComponent(companyId)}?properties=client_naali`,
  );
  const value = normalize(response.data?.properties?.client_naali);
  const isClient = value === "true" || value === "oui" || value === "yes" || value === "1";
  cache.set(companyId, isClient);
  return isClient;
}

async function syncInboundVisits(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connection: HubSpotConnection;
  pharmacies: PharmacyContext[];
  actorId: string;
  owners: Map<string, string>;
}) {
  const since = await lastSuccessfulInboundSyncAt(options.admin, options.connection.id, "visits" as const);
  const links = await existingExternalLinks(options.admin, options.connection.id, "visits");
  const byCompany = new Map(options.pharmacies.map((pharmacy) => [pharmacy.companyId, pharmacy]));
  const clientStatusByCompany = new Map<string, boolean>();
  const ownerExternalIds = [...options.owners.keys()];

  return runInbound(options.admin, options.connection.id, "visits", async (counter) => {
    const freshnessFilters = since
      ? searchFiltersSince(since)
      : [{
          propertyName: "hs_meeting_start_time",
          operator: "GTE",
          value: String(Date.now() - 120 * 24 * 60 * 60_000),
        }];

    const records = ownerExternalIds.length
      ? await searchAll(options.client, "meetings", {
          filterGroups: [{
            filters: [
              { propertyName: "hubspot_owner_id", operator: "IN", values: ownerExternalIds },
              ...freshnessFilters,
            ],
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
            "hs_attachment_ids",
            "hs_lastmodifieddate",
          ],
          sorts: ["hs_timestamp"],
        })
      : [];

    const resolved: Array<{
      remote: HubSpotRecord;
      pharmacy: PharmacyContext;
      start: string;
      startMs: number;
    }> = [];

    for (const remote of records) {
      counter.seen += 1;
      try {
        const remoteId = externalId(remote);
        if (!remoteId) throw new Error("HubSpot meeting has no id");
        const start = text(remote.properties?.hs_meeting_start_time) ?? text(remote.properties?.hs_timestamp);
        const startMs = start ? new Date(start).getTime() : Number.NaN;
        if (!start || !Number.isFinite(startMs)) throw new Error(`HubSpot meeting ${remoteId} has no valid start time`);

        const ownerExternalId = text(remote.properties?.hubspot_owner_id);
        const ownerUserId = (ownerExternalId ? options.owners.get(ownerExternalId) : null) ?? options.actorId;
        const companyIds = await meetingCompanyIds(options.client, remoteId);
        if (!companyIds.length) throw new Error(`HubSpot meeting ${remoteId} has no company association`);

        const clientCompanyIds: string[] = [];
        for (const companyId of companyIds) {
          if (await isNaaliClientCompany(options.client, companyId, clientStatusByCompany)) {
            clientCompanyIds.push(companyId);
          }
        }
        if (!clientCompanyIds.length) {
          counter.succeeded += 1;
          continue;
        }

        let pharmacy = clientCompanyIds.map((companyId) => byCompany.get(companyId)).find(Boolean) ?? null;
        if (!pharmacy) {
          let lastError: unknown = null;
          for (const companyId of clientCompanyIds) {
            try {
              pharmacy = await ensurePharmacyForHubSpotCompany({
                admin: options.admin,
                client: options.client,
                brandId: options.brandId,
                connectionId: options.connection.id,
                actorId: options.actorId,
                ownerUserId,
                companyId,
                byCompany,
              });
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (!pharmacy) throw lastError ?? new Error(`Unable to resolve pharmacy for HubSpot meeting ${remoteId}`);
        }

        resolved.push({ remote, pharmacy, start, startMs });
      } catch (error) {
        counter.failed += 1;
        console.error(
          `[hubspot] inbound meeting resolution failed: ${error instanceof Error ? error.message.slice(0, 400) : "unknown"}`,
        );
      }
    }

    resolved.sort((left, right) => left.startMs - right.startMs);

    for (let index = 0; index < resolved.length; index += 1) {
      const current = resolved[index];
      const nextForPharmacy = resolved
        .slice(index + 1)
        .find((candidate) => candidate.pharmacy.companyId === current.pharmacy.companyId);

      try {
        await importVisit({
          admin: options.admin,
          client: options.client,
          brandId: options.brandId,
          connectionId: options.connection.id,
          actorId: options.actorId,
          pharmacy: current.pharmacy,
          remote: current.remote,
          visitLinks: links,
          owners: options.owners,
          nextMeetingStart: nextForPharmacy?.start ?? null,
        });
        counter.succeeded += 1;
      } catch (error) {
        counter.failed += 1;
        console.error(
          `[hubspot] inbound meeting failed: ${error instanceof Error ? error.message.slice(0, 400) : "unknown"}`,
        );
      }
    }
  });
}

async function syncInboundNotes(options: {
  admin: AdminClient;
  client: HubSpotClient;
  brandId: string;
  connection: HubSpotConnection;
  pharmacies: PharmacyContext[];
  actorId: string;
  owners: Map<string, string>;
}) {
  const since = await lastSuccessfulInboundSyncAt(options.admin, options.connection.id, "notes" as const);
  const links = await existingExternalLinks(options.admin, options.connection.id, "notes");
  return runInbound(options.admin, options.connection.id, "notes", async (counter) => {
    for (const pharmacy of options.pharmacies) {
      const records = await searchAll(options.client, "notes", {
        filterGroups: [{
          filters: [
            { propertyName: "associations.company", operator: "EQ", value: pharmacy.companyId },
            ...searchFiltersSince(since),
          ],
        }],
        properties: [
          "hs_note_body",
          "hs_timestamp",
          "hubspot_owner_id",
          "hs_attachment_ids",
          "hs_lastmodifieddate",
        ],
        sorts: ["hs_timestamp"],
      });
      for (const remote of records) {
        counter.seen += 1;
        try {
          await importNote({
            admin: options.admin,
            client: options.client,
            brandId: options.brandId,
            connectionId: options.connection.id,
            actorId: options.actorId,
            pharmacy,
            remote,
            noteLinks: links,
            owners: options.owners,
          });
          counter.succeeded += 1;
        } catch (error) {
          counter.failed += 1;
          console.error(
            `[hubspot] inbound note failed: ${error instanceof Error ? error.message.slice(0, 400) : "unknown"}`,
          );
        }
      }
    }
  });
}

function statusOf(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const status = (data as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

async function replayOrdersCreatedWhileInactive(brandId: string, connectionId: string) {
  const admin = createAdminClient();
  const { data: logs, error: logsError } = await admin
    .from("activity_logs")
    .select("old_data,new_data,created_at")
    .eq("entity_type", "connector_connections")
    .eq("entity_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (logsError) throw logsError;

  const activation = (logs ?? []).find((log) =>
    ["paused", "error"].includes(statusOf(log.old_data) ?? "") &&
    statusOf(log.new_data) === "active",
  );
  if (!activation) return;
  const inactiveStatus = statusOf(activation.old_data);
  const inactiveStart = (logs ?? []).find((log) =>
    new Date(log.created_at).getTime() < new Date(activation.created_at).getTime() &&
    statusOf(log.old_data) === "active" &&
    statusOf(log.new_data) === inactiveStatus,
  );
  if (!inactiveStart) return;

  const pauseAt = String(inactiveStart.created_at);
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
    if (!alreadySynced.has(orderId)) await syncHubSpotOrderAfterPersistence(brandId, orderId);
  }
}

export type HubSpotAgentSyncStatus = {
  available: boolean;
  lastFullSyncAt: string | null;
};

export async function getHubSpotAgentSyncStatus(
  brandId: string,
  userId: string,
): Promise<HubSpotAgentSyncStatus> {
  const admin = createAdminClient();
  const { data: connection, error: connectionError } = await admin
    .from("connector_connections")
    .select("id")
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (connectionError || !connection?.id) {
    return { available: false, lastFullSyncAt: null };
  }

  const connectionId = String(connection.id);
  const { data: userLink, error: userLinkError } = await admin
    .from("connector_external_links")
    .select("external_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", "users")
    .eq("tr1_record_id", userId)
    .limit(1)
    .maybeSingle();
  if (userLinkError || !userLink?.external_id) {
    return { available: false, lastFullSyncAt: null };
  }

  const { data: runs, error: runsError } = await admin
    .from("connector_sync_runs")
    .select("entity_type,completed_at")
    .eq("connection_id", connectionId)
    .eq("direction", "inbound")
    .in("entity_type", ["orders", "visits", "notes"])
    .in("status", ["succeeded", "partial"])
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(60);
  if (runsError) {
    return { available: true, lastFullSyncAt: null };
  }

  const latest = new Map<string, string>();
  for (const run of runs ?? []) {
    const entityType = String(run.entity_type);
    const completedAt = run.completed_at ? String(run.completed_at) : null;
    if (completedAt && !latest.has(entityType)) latest.set(entityType, completedAt);
  }

  const required = ["orders", "visits", "notes"];
  if (!required.every((entityType) => latest.has(entityType))) {
    return { available: true, lastFullSyncAt: null };
  }

  const lastFullSyncAt = required
    .map((entityType) => latest.get(entityType)!)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];

  return { available: true, lastFullSyncAt };
}

export async function reconcileHubSpotVisitsIfStale(
  brandId: string,
  maxAgeMs = 15 * 60_000,
) {
  try {
    const admin = createAdminClient();
    const { data: connection, error: connectionError } = await admin
      .from("connector_connections")
      .select("id,base_url,credential_reference,configuration,updated_by,last_synced_at")
      .eq("brand_id", brandId)
      .eq("provider", "hubspot")
      .eq("status", "active")
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (connectionError || !connection) return null;

    await replayOrdersCreatedWhileInactive(brandId, String(connection.id));
    const lastSyncAt = await lastSuccessfulInboundSyncAt(admin, String(connection.id), "visits");
    if (lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < maxAgeMs) return null;

    const runtime = await activeConnection(brandId, String(connection.id));
    if (!runtime) return null;
    const pharmacies = await mappedPharmacies(runtime.admin, brandId, String(connection.id));
    const actorId = await syncActorUserId(runtime.admin, brandId, runtime.connection);
    const owners = await ownerMap(runtime.admin, String(connection.id));

    return await syncInboundVisits({
      admin: runtime.admin,
      client: runtime.client,
      brandId,
      connection: runtime.connection,
      pharmacies,
      actorId,
      owners,
    });
  } catch (error) {
    console.error(
      `[hubspot] background meeting reconcile failed: ${error instanceof Error ? error.message.slice(0, 500) : "unknown"}`,
    );
    return null;
  }
}

export async function reconcileHubSpotConnection(
  brandId: string,
  connectionId: string,
): Promise<HubSpotReconciliationSummary> {
  const runtime = await activeConnection(brandId, connectionId);
  if (!runtime) throw new Error("HubSpot connection is not active");
  const { admin, connection, client } = runtime;

  const { data: brand, error: brandError } = await admin
    .from("brands")
    .select("organization_id")
    .eq("id", brandId)
    .single();
  if (brandError || !brand?.organization_id) throw brandError ?? new Error("Brand organization unavailable");
  const organizationId = String(brand.organization_id);

  const pharmacies = await mappedPharmacies(admin, brandId, connectionId);
  const actorId = await syncActorUserId(admin, brandId, connection);
  const owners = await ownerMap(admin, connectionId);

  await syncNaaliCatalog(admin, client, brandId, connectionId);
  const terms = await syncCommercialTerms(admin, client, brandId, pharmacies);
  const orders = await syncInboundOrders({
    admin,
    client,
    brandId,
    organizationId,
    connection,
    pharmacies,
    actorId,
    owners,
  });
  const visits = await syncInboundVisits({ admin, client, brandId, connection, pharmacies, actorId, owners });
  const notes = await syncInboundNotes({ admin, client, brandId, connection, pharmacies, actorId, owners });
  await replayOrdersCreatedWhileInactive(brandId, connectionId);

  const failed = terms.failed + orders.failed + visits.failed + notes.failed;
  const { error: connectionError } = await admin
    .from("connector_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_error: failed ? `${failed} élément(s) HubSpot nécessitent une revue` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("brand_id", brandId);
  if (connectionError) throw connectionError;

  return { terms, orders, visits, notes };
}

export async function reconcileHubSpotConnectionAfterActivation(brandId: string, connectionId: string) {
  return reconcileHubSpotConnection(brandId, connectionId);
}
