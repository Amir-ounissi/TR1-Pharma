import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient, type HubSpotClientMode } from "./client";
import { NAALI_HUBSPOT_CONFIGURATION } from "./naali";
import { syncHubSpotNote, type HubSpotExternalLinkStore, type HubSpotSyncEvent, type HubSpotSyncJournal } from "./sync";

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
  ) return "write";
  return "disabled";
}

function accessToken(connection: HubSpotConnection, mode: HubSpotClientMode) {
  if (mode !== "write") return null;
  const reference = connection.credential_reference?.trim();
  if (reference && /^[A-Z][A-Z0-9_]*$/.test(reference)) return process.env[reference] ?? null;
  return process.env.HUBSPOT_ACCESS_TOKEN ?? null;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown HubSpot note sync error";
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "preuve";
}

async function externalIdFor(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  entityType: "pharmacies" | "users" | "notes",
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

async function saveExternalId(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  interactionId: string,
  externalId: string,
) {
  const { error } = await admin.rpc("upsert_connector_external_link", {
    target_connection_id: connectionId,
    target_entity_type: "notes",
    target_external_id: externalId,
    target_tr1_record_id: interactionId,
    target_external_updated_at: null,
    target_tr1_updated_at: null,
    target_sync_hash: null,
  });
  if (error) throw error;
}

async function attachmentExternalId(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  interactionId: string,
  attachmentId: string,
) {
  const { data, error } = await admin
    .from("connector_external_child_links")
    .select("external_id")
    .eq("connection_id", connectionId)
    .eq("parent_entity_type", "notes")
    .eq("parent_tr1_record_id", interactionId)
    .eq("child_type", "attachment")
    .eq("child_key", attachmentId)
    .maybeSingle();
  if (error) throw error;
  return data?.external_id ? String(data.external_id) : null;
}

async function saveAttachmentExternalId(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  interactionId: string,
  attachmentId: string,
  externalId: string,
) {
  const { error } = await admin.rpc("upsert_connector_external_child_link", {
    target_connection_id: connectionId,
    target_parent_entity_type: "notes",
    target_parent_tr1_record_id: interactionId,
    target_child_type: "attachment",
    target_child_key: attachmentId,
    target_external_id: externalId,
    target_external_updated_at: null,
    target_sync_hash: null,
  });
  if (error) throw error;
}

function providerId(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const raw = (data as Record<string, unknown>).id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return null;
}

export async function syncNaaliHubSpotInteractionAfterPersistence(brandId: string, interactionId: string) {
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
      .eq("entity_type", "notes")
      .eq("is_enabled", true)
      .in("direction", ["outbound", "bidirectional"])
      .limit(1)
      .maybeSingle();
    if (mappingError) throw mappingError;
    if (!mapping) return;

    const typedConnection = connection as HubSpotConnection;
    const mode = syncMode(typedConnection);
    const token = accessToken(typedConnection, mode);
    if (mode !== "write" || !token) return;

    const client = new HubSpotClient({
      mode,
      accessToken: token,
      baseUrl: typedConnection.base_url ?? undefined,
    });

    const { data: interaction, error: interactionError } = await admin
      .from("interactions")
      .select("id,brand_id,brand_pharmacy_id,created_by,subject,notes,occurred_at,interaction_type,archived_at")
      .eq("id", interactionId)
      .eq("brand_id", brandId)
      .is("archived_at", null)
      .maybeSingle();
    if (interactionError) throw interactionError;
    if (!interaction || !["visit", "internal_note"].includes(String(interaction.interaction_type))) return;

    const { data: relation, error: relationError } = await admin
      .from("brand_pharmacies")
      .select("pharmacy_id")
      .eq("id", interaction.brand_pharmacy_id)
      .eq("brand_id", brandId)
      .is("archived_at", null)
      .maybeSingle();
    if (relationError) throw relationError;
    if (!relation?.pharmacy_id) throw new Error(`TR1 interaction ${interactionId} has no active pharmacy relation`);

    const pharmacyExternalId = await externalIdFor(admin, connection.id, "pharmacies", String(relation.pharmacy_id));
    if (!pharmacyExternalId) throw new Error(`HubSpot company mapping missing for TR1 pharmacy ${relation.pharmacy_id}`);
    const ownerExternalId = interaction.created_by
      ? await externalIdFor(admin, connection.id, "users", String(interaction.created_by))
      : null;

    const { data: attachments, error: attachmentsError } = await admin
      .from("interaction_attachments")
      .select("id,bucket_id,object_path,original_name,mime_type")
      .eq("interaction_id", interactionId)
      .eq("brand_id", brandId)
      .is("archived_at", null)
      .order("created_at", { ascending: true });
    if (attachmentsError) throw attachmentsError;

    const attachmentExternalIds: string[] = [];
    for (const attachment of attachments ?? []) {
      let externalId = await attachmentExternalId(admin, connection.id, interactionId, String(attachment.id));
      if (!externalId) {
        const { data: blob, error: downloadError } = await admin.storage
          .from(String(attachment.bucket_id))
          .download(String(attachment.object_path));
        if (downloadError || !blob) throw downloadError ?? new Error("Unable to read TR1 evidence file");

        const upload = await client.uploadFile({
          file: blob,
          filename: safeFilename(String(attachment.original_name)),
          folderPath: `/TR1-Pharma/${brandId}/${interactionId}`,
          access: "PRIVATE",
        });
        externalId = providerId(upload.data);
        if (!externalId) throw new Error(`HubSpot file upload returned no file ID for attachment ${attachment.id}`);
        await saveAttachmentExternalId(admin, connection.id, interactionId, String(attachment.id), externalId);
      }
      attachmentExternalIds.push(externalId);
    }

    const { data: runId, error: runError } = await admin.rpc("register_connector_sync_run", {
      target_connection_id: connection.id,
      target_entity_type: "notes",
      target_direction: "outbound",
      target_cursor_before: null,
    });
    if (runError || !runId) throw runError ?? new Error("HubSpot note sync run was not created");
    const run = String(runId);

    const links: HubSpotExternalLinkStore = {
      async getParent(tr1RecordId) {
        const externalId = await externalIdFor(admin, connection.id, "notes", tr1RecordId);
        return externalId ? { externalId } : null;
      },
      async saveParent(tr1RecordId, externalId) {
        await saveExternalId(admin, connection.id, tr1RecordId, externalId);
      },
      async getChild() { return null; },
      async saveChild() {},
    };

    const journal: HubSpotSyncJournal = {
      async record(event: HubSpotSyncEvent) {
        const { error } = await admin.rpc("record_connector_sync_event", {
          target_run_id: run,
          target_connection_id: connection.id,
          target_entity_type: "notes",
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

    const subject = String(interaction.subject || "Compte rendu terrain").trim();
    const noteText = interaction.notes ? String(interaction.notes).trim() : "";
    const body = noteText ? `${subject}\n\n${noteText}` : subject;

    try {
      await syncHubSpotNote({
        client,
        config: NAALI_HUBSPOT_CONFIGURATION,
        note: {
          id: String(interaction.id),
          body,
          timestamp: String(interaction.occurred_at),
          ownerExternalId,
          attachmentExternalIds,
        },
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
      await admin.rpc("complete_connector_sync_run", {
        target_run_id: run,
        target_status: "failed",
        target_records_seen: 1,
        target_records_succeeded: 0,
        target_records_failed: 1,
        target_cursor_after: null,
        target_error_summary: safeError(error),
      });
      throw error;
    }
  } catch (error) {
    console.error(`[hubspot] note:${interactionId} sync failed: ${safeError(error)}`);
  }
}
