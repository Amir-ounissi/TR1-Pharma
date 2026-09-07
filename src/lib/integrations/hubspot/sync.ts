import { HubSpotApiError, type HubSpotClient, type HubSpotClientMode } from "./client";
import { mapMeetingToHubSpot, mapNoteToHubSpot, mapOrderToHubSpot } from "./mappers";
import type {
  HubSpotBrandConfiguration,
  HubSpotMappedRecord,
  HubSpotMeetingSyncInput,
  HubSpotNoteSyncInput,
  HubSpotOrderSyncInput,
} from "./model";

export type HubSpotParentLink = {
  externalId: string;
};

export type HubSpotChildLink = {
  externalId: string;
};

export interface HubSpotExternalLinkStore {
  getParent(tr1RecordId: string): Promise<HubSpotParentLink | null>;
  saveParent(tr1RecordId: string, externalId: string): Promise<void>;
  getChild(parentTr1RecordId: string, childKey: string): Promise<HubSpotChildLink | null>;
  saveChild(parentTr1RecordId: string, childKey: string, externalId: string): Promise<void>;
}

export type HubSpotSyncEvent = {
  tr1RecordId: string;
  childKey?: string;
  eventType: "create" | "update" | "associate" | "skip" | "error";
  status: "planned" | "succeeded" | "failed";
  externalId?: string;
  providerStatus?: number;
  providerRequestId?: string;
  errorCode?: string;
  errorMessage?: string;
};

export interface HubSpotSyncJournal {
  record(event: HubSpotSyncEvent): Promise<void>;
}

export type HubSpotOrderSyncResult = {
  mode: HubSpotClientMode;
  dealExternalId: string | null;
  lineItemExternalIds: Record<string, string>;
  writes: number;
  planned: number;
};

export type HubSpotActivitySyncResult = {
  mode: HubSpotClientMode;
  externalId: string | null;
  writes: number;
  planned: number;
};

function providerId(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = (data as Record<string, unknown>).id;
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

async function journalFailure(journal: HubSpotSyncJournal, tr1RecordId: string, childKey: string | undefined, error: unknown) {
  if (error instanceof HubSpotApiError) {
    await journal.record({
      tr1RecordId,
      childKey,
      eventType: "error",
      status: "failed",
      providerStatus: error.status,
      providerRequestId: error.correlationId ?? undefined,
      errorCode: error.status === 429 ? "rate_limited" : "provider_error",
      errorMessage: error.message,
    });
    return;
  }
  await journal.record({
    tr1RecordId,
    childKey,
    eventType: "error",
    status: "failed",
    errorCode: "sync_error",
    errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown HubSpot sync error",
  });
}

async function upsertRecord(
  client: HubSpotClient,
  journal: HubSpotSyncJournal,
  tr1RecordId: string,
  childKey: string | undefined,
  objectType: string,
  mapped: HubSpotMappedRecord,
  existingExternalId: string | null,
) {
  const eventType = existingExternalId ? "update" as const : "create" as const;
  try {
    const result = existingExternalId
      ? await client.updateObject<{ id?: string | number }>(objectType, existingExternalId, mapped.properties)
      : await client.createObject<{ id?: string | number }>(objectType, mapped.properties);
    const resolvedExternalId = existingExternalId ?? providerId(result.data);
    await journal.record({
      tr1RecordId,
      childKey,
      eventType,
      status: result.mode === "write" ? "succeeded" : "planned",
      externalId: resolvedExternalId ?? undefined,
      providerStatus: result.status ?? undefined,
      providerRequestId: result.correlationId ?? undefined,
    });
    return { mode: result.mode, externalId: resolvedExternalId };
  } catch (error) {
    await journalFailure(journal, tr1RecordId, childKey, error);
    throw error;
  }
}

async function associateWithPharmacy(options: {
  client: HubSpotClient;
  journal: HubSpotSyncJournal;
  tr1RecordId: string;
  objectType: string;
  externalId: string;
  companyObjectType: string;
  pharmacyExternalId: string;
}) {
  const { client, journal, tr1RecordId, objectType, externalId, companyObjectType, pharmacyExternalId } = options;
  try {
    const association = await client.associateDefault(objectType, externalId, companyObjectType, pharmacyExternalId);
    await journal.record({
      tr1RecordId,
      eventType: "associate",
      status: association.mode === "write" ? "succeeded" : "planned",
      externalId,
      providerStatus: association.status ?? undefined,
      providerRequestId: association.correlationId ?? undefined,
    });
    return association.mode;
  } catch (error) {
    await journalFailure(journal, tr1RecordId, undefined, error);
    throw error;
  }
}

async function syncHubSpotActivity(options: {
  client: HubSpotClient;
  config: HubSpotBrandConfiguration;
  tr1RecordId: string;
  objectType: string;
  mapped: HubSpotMappedRecord;
  pharmacyExternalId?: string | null;
  links: HubSpotExternalLinkStore;
  journal: HubSpotSyncJournal;
}): Promise<HubSpotActivitySyncResult> {
  const { client, config, tr1RecordId, objectType, mapped, pharmacyExternalId, links, journal } = options;
  const parent = await links.getParent(tr1RecordId);
  const synced = await upsertRecord(client, journal, tr1RecordId, undefined, objectType, mapped, parent?.externalId ?? null);

  let writes = synced.mode === "write" ? 1 : 0;
  let planned = synced.mode === "write" ? 0 : 1;
  if (synced.mode === "write" && synced.externalId && !parent) {
    await links.saveParent(tr1RecordId, synced.externalId);
  }

  if (synced.externalId && pharmacyExternalId) {
    const associationMode = await associateWithPharmacy({
      client,
      journal,
      tr1RecordId,
      objectType,
      externalId: synced.externalId,
      companyObjectType: config.objects.companies,
      pharmacyExternalId,
    });
    if (associationMode === "write") writes += 1;
    else planned += 1;
  }

  return {
    mode: synced.mode,
    externalId: synced.externalId,
    writes,
    planned,
  };
}

export async function syncHubSpotVisit(options: {
  client: HubSpotClient;
  config: HubSpotBrandConfiguration;
  visit: HubSpotMeetingSyncInput;
  pharmacyExternalId?: string | null;
  links: HubSpotExternalLinkStore;
  journal: HubSpotSyncJournal;
}): Promise<HubSpotActivitySyncResult> {
  return syncHubSpotActivity({
    client: options.client,
    config: options.config,
    tr1RecordId: options.visit.id,
    objectType: options.config.objects.meetings,
    mapped: mapMeetingToHubSpot(options.visit, options.config),
    pharmacyExternalId: options.pharmacyExternalId,
    links: options.links,
    journal: options.journal,
  });
}

export async function syncHubSpotNote(options: {
  client: HubSpotClient;
  config: HubSpotBrandConfiguration;
  note: HubSpotNoteSyncInput;
  pharmacyExternalId?: string | null;
  links: HubSpotExternalLinkStore;
  journal: HubSpotSyncJournal;
}): Promise<HubSpotActivitySyncResult> {
  return syncHubSpotActivity({
    client: options.client,
    config: options.config,
    tr1RecordId: options.note.id,
    objectType: options.config.objects.notes,
    mapped: mapNoteToHubSpot(options.note, options.config),
    pharmacyExternalId: options.pharmacyExternalId,
    links: options.links,
    journal: options.journal,
  });
}

export async function syncHubSpotOrder(options: {
  client: HubSpotClient;
  config: HubSpotBrandConfiguration;
  order: HubSpotOrderSyncInput;
  pharmacyExternalId?: string | null;
  links: HubSpotExternalLinkStore;
  journal: HubSpotSyncJournal;
}): Promise<HubSpotOrderSyncResult> {
  const { client, config, order, pharmacyExternalId, links, journal } = options;
  const mapped = mapOrderToHubSpot(order, config);
  const parent = await links.getParent(order.id);
  const deal = await upsertRecord(client, journal, order.id, undefined, config.objects.deals, mapped.deal, parent?.externalId ?? null);

  let writes = deal.mode === "write" ? 1 : 0;
  let planned = deal.mode === "write" ? 0 : 1;
  if (deal.mode === "write" && deal.externalId && !parent) {
    await links.saveParent(order.id, deal.externalId);
  }

  if (deal.externalId && pharmacyExternalId) {
    const associationMode = await associateWithPharmacy({
      client,
      journal,
      tr1RecordId: order.id,
      objectType: config.objects.deals,
      externalId: deal.externalId,
      companyObjectType: config.objects.companies,
      pharmacyExternalId,
    });
    if (associationMode === "write") writes += 1;
    else planned += 1;
  }

  const lineItemExternalIds: Record<string, string> = {};
  for (const line of mapped.lineItems) {
    const childKey = line.tr1RecordId;
    const child = await links.getChild(order.id, childKey);
    const synced = await upsertRecord(client, journal, order.id, childKey, config.objects.lineItems, line, child?.externalId ?? null);
    if (synced.mode === "write") writes += 1;
    else planned += 1;

    if (!synced.externalId) continue;
    lineItemExternalIds[childKey] = synced.externalId;
    if (synced.mode === "write" && !child) {
      await links.saveChild(order.id, childKey, synced.externalId);
    }

    if (deal.externalId) {
      try {
        const association = await client.associateDefault(config.objects.lineItems, synced.externalId, config.objects.deals, deal.externalId);
        await journal.record({
          tr1RecordId: order.id,
          childKey,
          eventType: "associate",
          status: association.mode === "write" ? "succeeded" : "planned",
          externalId: synced.externalId,
          providerStatus: association.status ?? undefined,
          providerRequestId: association.correlationId ?? undefined,
        });
        if (association.mode === "write") writes += 1;
        else planned += 1;
      } catch (error) {
        await journalFailure(journal, order.id, childKey, error);
        throw error;
      }
    }
  }

  return {
    mode: deal.mode,
    dealExternalId: deal.externalId,
    lineItemExternalIds,
    writes,
    planned,
  };
}
