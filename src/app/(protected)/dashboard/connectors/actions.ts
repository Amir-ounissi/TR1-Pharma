"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrandRole } from "@/lib/auth";
import {
  CONNECTOR_ENTITY_TYPES,
  isConnectorProvider,
  isCredentialReference,
  isSafeConnectorConfiguration,
  normalizeConnectorBaseUrl,
} from "@/lib/connectors";
import { assertActiveBrandCapability } from "@/lib/saas/server";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const connectionStatus = z.enum(["draft", "ready", "active", "paused", "error"]);
const mappingDirection = z.enum(["inbound", "outbound", "bidirectional"]);
const conflictStrategy = z.enum(["manual", "external_wins", "tr1_wins", "newest_wins"]);
const entityType = z.enum(CONNECTOR_ENTITY_TYPES);

async function requireConnectorAdmin() {
  const [{ supabase, brand }] = await Promise.all([
    requireActiveBrandRole(["tr1_manager", "brand_admin", "super_admin"] as const),
    assertActiveBrandCapability("connectors"),
  ]);
  return { supabase, brand };
}

function parseOptionalJsonObject(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return {} as Record<string, unknown>;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("La configuration JSON est invalide.");
  }
  if (!isSafeConnectorConfiguration(parsed)) {
    throw new Error("La configuration ne doit contenir aucun mot de passe, token, clé API ou secret.");
  }
  return parsed;
}

export async function saveConnectorConnectionFormAction(formData: FormData): Promise<void> {
  const connectionIdValue = String(formData.get("connectionId") ?? "").trim();
  const providerValue = String(formData.get("provider") ?? "").trim();
  const name = z.string().trim().min(2).max(120).parse(formData.get("name"));
  const externalAccountId = z.string().trim().max(255).parse(String(formData.get("externalAccountId") ?? ""));
  const baseUrlRaw = String(formData.get("baseUrl") ?? "").trim();
  const credentialReference = z.string().trim().max(255).parse(String(formData.get("credentialReference") ?? ""));
  const configuration = parseOptionalJsonObject(formData.get("configuration"));

  if (!isConnectorProvider(providerValue)) throw new Error("Fournisseur de connecteur invalide.");
  const connectionId = connectionIdValue ? uuid.parse(connectionIdValue) : null;
  const baseUrl = baseUrlRaw ? normalizeConnectorBaseUrl(baseUrlRaw) : null;
  if (baseUrlRaw && !baseUrl) throw new Error("URL de base invalide.");
  if (credentialReference && !isCredentialReference(credentialReference)) {
    throw new Error("La référence d’identifiants doit pointer vers un secret externe (oauth://, vault:// ou secret://).");
  }

  const { supabase, brand } = await requireConnectorAdmin();
  const { error } = await supabase.rpc("save_connector_connection", {
    target_brand_id: brand.id,
    target_connection_id: connectionId,
    target_provider: providerValue,
    target_name: name,
    target_external_account_id: externalAccountId || null,
    target_base_url: baseUrl,
    target_credential_reference: credentialReference || null,
    target_configuration: configuration,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/connectors");
}

export async function setConnectorStatusFormAction(formData: FormData): Promise<void> {
  const connectionId = uuid.parse(formData.get("connectionId"));
  const status = connectionStatus.parse(formData.get("status"));
  const { supabase } = await requireConnectorAdmin();
  const { error } = await supabase.rpc("set_connector_connection_status", {
    target_connection_id: connectionId,
    target_status: status,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/connectors");
}

export async function archiveConnectorConnectionFormAction(formData: FormData): Promise<void> {
  const connectionId = uuid.parse(formData.get("connectionId"));
  const { supabase } = await requireConnectorAdmin();
  const { error } = await supabase.rpc("archive_connector_connection", { target_connection_id: connectionId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/connectors");
}

export async function saveConnectorMappingFormAction(formData: FormData): Promise<void> {
  const connectionId = uuid.parse(formData.get("connectionId"));
  const mappingIdValue = String(formData.get("mappingId") ?? "").trim();
  const externalObject = z.string().trim().min(1).max(160).parse(formData.get("externalObject"));
  const cursorField = z.string().trim().max(160).parse(String(formData.get("cursorField") ?? ""));
  const mappingProfileValue = String(formData.get("mappingProfileId") ?? "").trim();
  const enabled = String(formData.get("enabled") ?? "true") !== "false";

  const mappingId = mappingIdValue ? uuid.parse(mappingIdValue) : null;
  const mappingProfileId = mappingProfileValue ? uuid.parse(mappingProfileValue) : null;
  const parsedEntity = entityType.parse(formData.get("entityType"));
  const direction = mappingDirection.parse(formData.get("direction"));
  const conflict = conflictStrategy.parse(formData.get("conflictStrategy"));

  const { supabase } = await requireConnectorAdmin();
  const { error } = await supabase.rpc("save_connector_entity_mapping", {
    target_connection_id: connectionId,
    target_mapping_id: mappingId,
    target_entity_type: parsedEntity,
    target_external_object: externalObject,
    target_direction: direction,
    target_mapping_profile_id: mappingProfileId,
    target_conflict_strategy: conflict,
    target_cursor_field: cursorField || null,
    target_is_enabled: enabled,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/connectors");
}
