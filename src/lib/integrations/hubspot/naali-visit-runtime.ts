import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient, type HubSpotClientMode } from "./client";
import { resolveHubSpotMappedValue } from "./mapping-profile";
import { loadHubSpotRuntimeProfile } from "./mapping-profile-runtime";
import { assertHubSpotBrandConfiguration, type HubSpotMeetingSyncInput } from "./model";
import { NAALI_HUBSPOT_CONFIGURATION, resolveNaaliHubSpotVisitType } from "./naali";
import {
  syncHubSpotVisit,
  type HubSpotExternalLinkStore,
  type HubSpotSyncEvent,
  type HubSpotSyncJournal,
} from "./sync";

type HubSpotConnection = {
  id: string;
  base_url: string | null;
  credential_reference: string | null;
  configuration: Record<string, unknown> | null;
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
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown HubSpot visit sync error";
}

async function externalIdFor(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  entityType: "pharmacies" | "users" | "visits",
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

async function saveVisitExternalId(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  visitId: string,
  externalId: string,
) {
  const { error } = await admin.rpc("upsert_connector_external_link", {
    target_connection_id: connectionId,
    target_entity_type: "visits",
    target_external_id: externalId,
    target_tr1_record_id: visitId,
    target_external_updated_at: null,
    target_tr1_updated_at: null,
    target_sync_hash: null,
  });
  if (error) throw error;
}

function formatMeetingBody(
  visitNotes: unknown,
  rows: Array<{ subject: unknown; notes: unknown }> | null,
) {
  const blocks: string[] = [];
  if (visitNotes) {
    const value = String(visitNotes).trim();
    if (value) blocks.push(value);
  }
  for (const row of rows ?? []) {
    const subject = row.subject ? String(row.subject).trim() : "";
    const notes = row.notes ? String(row.notes).trim() : "";
    if (subject && notes) blocks.push(`${subject}\n\n${notes}`);
    else if (notes || subject) blocks.push(notes || subject);
  }
  return blocks.join("\n\n---\n\n") || null;
}

export async function syncNaaliHubSpotVisitAfterPersistence(brandId: string, visitId: string) {
  try {
    const admin = createAdminClient();
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
    if (!connection) return;

    const { data: mapping, error: mappingError } = await admin
      .from("connector_entity_mappings")
      .select("id")
      .eq("connection_id", connection.id)
      .eq("entity_type", "visits")
      .eq("is_enabled", true)
      .in("direction", ["outbound", "bidirectional"])
      .limit(1)
      .maybeSingle();
    if (mappingError) throw mappingError;
    if (!mapping) return;

    const profile = await loadHubSpotRuntimeProfile(
      admin,
      String(connection.id),
      "visits",
      NAALI_HUBSPOT_CONFIGURATION,
    );
    assertHubSpotBrandConfiguration(profile.config);

    const typedConnection = connection as HubSpotConnection;
    const mode = syncMode(typedConnection);
    const client = new HubSpotClient({
      mode,
      accessToken: accessToken(typedConnection, mode),
      baseUrl: typedConnection.base_url ?? undefined,
    });

    const { data: runId, error: runError } = await admin.rpc("register_connector_sync_run", {
      target_connection_id: connection.id,
      target_entity_type: "visits",
      target_direction: "outbound",
      target_cursor_before: null,
    });
    if (runError || !runId) throw runError ?? new Error("HubSpot visit sync run was not created");
    const run = String(runId);

    const journal: HubSpotSyncJournal = {
      async record(event: HubSpotSyncEvent) {
        const { error } = await admin.rpc("record_connector_sync_event", {
          target_run_id: run,
          target_connection_id: connection.id,
          target_entity_type: "visits",
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

    const links: HubSpotExternalLinkStore = {
      async getParent(tr1RecordId) {
        const externalId = await externalIdFor(admin, connection.id, "visits", tr1RecordId);
        return externalId ? { externalId } : null;
      },
      async saveParent(tr1RecordId, externalId) {
        await saveVisitExternalId(admin, connection.id, tr1RecordId, externalId);
      },
      async getChild() {
        return null;
      },
      async saveChild() {},
    };

    try {
      const { data: visit, error: visitError } = await admin
        .from("field_visits")
        .select("id,pharmacy_id,owner_user_id,status,visit_kind,title,notes,scheduled_start_at,scheduled_end_at,actual_start_at,actual_end_at")
        .eq("id", visitId)
        .is("archived_at", null)
        .maybeSingle();
      if (visitError) throw visitError;
      if (!visit || visit.status !== "completed") {
        const { error: skippedError } = await admin.rpc("complete_connector_sync_run", {
          target_run_id: run,
          target_status: "succeeded",
          target_records_seen: 1,
          target_records_succeeded: 1,
          target_records_failed: 0,
          target_cursor_after: null,
          target_error_summary: null,
        });
        if (skippedError) throw skippedError;
        return;
      }

      const { data: relation, error: relationError } = await admin
        .from("brand_pharmacies")
        .select("id")
        .eq("brand_id", brandId)
        .eq("pharmacy_id", visit.pharmacy_id)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle();
      if (relationError) throw relationError;
      if (!relation) throw new Error(`TR1 visit ${visitId} is not linked to the active brand`);

      const ownerTr1UserId = visit.owner_user_id ? String(visit.owner_user_id) : null;
      if (!ownerTr1UserId) throw new Error(`TR1 visit ${visitId} has no owner`);
      const ownerExternalId = await externalIdFor(admin, connection.id, "users", ownerTr1UserId);
      if (!ownerExternalId) throw new Error(`HubSpot owner mapping missing for TR1 user ${ownerTr1UserId}`);

      const pharmacyExternalId = await externalIdFor(admin, connection.id, "pharmacies", String(visit.pharmacy_id));
      if (!pharmacyExternalId) throw new Error(`HubSpot company mapping missing for TR1 pharmacy ${visit.pharmacy_id}`);

      const { data: notes, error: notesError } = await admin
        .from("interactions")
        .select("subject,notes,occurred_at")
        .eq("brand_id", brandId)
        .eq("field_visit_id", visitId)
        .eq("interaction_type", "internal_note")
        .is("archived_at", null)
        .order("occurred_at", { ascending: true });
      if (notesError) throw notesError;

      const visitKind = String(visit.visit_kind);
      const activityType = resolveHubSpotMappedValue(
        profile.transforms.visitTypeValues,
        visitKind,
        resolveNaaliHubSpotVisitType(visitKind),
      );
      if (!activityType) throw new Error(`HubSpot activity type missing for TR1 visit kind ${visitKind}`);

      const payload: HubSpotMeetingSyncInput = {
        id: String(visit.id),
        title: String(visit.title || "Visite terrain"),
        startAt: String(visit.actual_start_at || visit.scheduled_start_at),
        endAt: (visit.actual_end_at || visit.scheduled_end_at) ? String(visit.actual_end_at || visit.scheduled_end_at) : null,
        outcome: "COMPLETED",
        ownerExternalId,
        activityType,
        body: formatMeetingBody(visit.notes, notes),
      };

      await syncHubSpotVisit({
        client,
        config: profile.config,
        visit: payload,
        pharmacyExternalId,
        links,
        journal,
      });

      const { error: completeError } = await admin.rpc("complete_connector_sync_run", {
        target_run_id: run,
        target_status: "succeeded",
        target_records_seen: 1,
        target_records_succeeded: 1,
        target_records_failed: 0,
        target_cursor_after: null,
        target_error_summary: null,
      });
      if (completeError) throw completeError;
    } catch (error) {
      try {
        await admin.rpc("complete_connector_sync_run", {
          target_run_id: run,
          target_status: "failed",
          target_records_seen: 1,
          target_records_succeeded: 0,
          target_records_failed: 1,
          target_cursor_after: null,
          target_error_summary: safeError(error),
        });
      } catch {
        // The TR1 visit is already persisted; connector journal failures stay isolated.
      }
      throw error;
    }
  } catch (error) {
    console.error(`[hubspot] visit:${visitId} sync failed: ${safeError(error)}`);
  }
}
