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
import {
  HUBSPOT_FIELD_DEFINITIONS,
  isHubSpotFieldMappingEntity,
  normalizeHubSpotFieldMapping,
} from "@/lib/integrations/hubspot/mapping-profile";
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

export async function saveHubSpotFieldMappingProfileAction(formData: FormData): Promise<void> {
  const connectorMappingId = uuid.parse(formData.get("connectorMappingId"));
  const rawEntityType = String(formData.get("entityType") ?? "").trim();
  if (!isHubSpotFieldMappingEntity(rawEntityType)) {
    throw new Error("Cet objet n’est pas encore pris en charge par le Mapping Studio HubSpot.");
  }

  const submitted: Record<string, unknown> = {};
  for (const definition of HUBSPOT_FIELD_DEFINITIONS[rawEntityType]) {
    const value = String(formData.get(`field:${definition.key}`) ?? "").trim();
    submitted[definition.key] = value || null;
  }
  const fieldMapping = normalizeHubSpotFieldMapping(rawEntityType, submitted);

  const { supabase, brand } = await requireConnectorAdmin();
  const { data: mapping, error: mappingError } = await supabase
    .from("connector_entity_mappings")
    .select("id,connection_id,entity_type,external_object,direction,mapping_profile_id,conflict_strategy,cursor_field,is_enabled")
    .eq("id", connectorMappingId)
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (mappingError) throw new Error(mappingError.message);
  if (!mapping || mapping.entity_type !== rawEntityType) throw new Error("Mapping connecteur introuvable.");

  const { data: connection, error: connectionError } = await supabase
    .from("connector_connections")
    .select("id,provider")
    .eq("id", mapping.connection_id)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection || connection.provider !== "hubspot") throw new Error("Ce mapping n’appartient pas à une connexion HubSpot.");

  const { data: profileId, error: profileError } = await supabase.rpc("save_data_mapping_profile", {
    target_brand_id: brand.id,
    target_profile_id: mapping.mapping_profile_id,
    target_name: `HubSpot · ${rawEntityType}`,
    target_entity_type: rawEntityType,
    target_source_system: `hubspot_${mapping.external_object}`,
    target_mapping: fieldMapping,
    target_transforms: {},
    target_is_default: false,
  });
  if (profileError) throw new Error(profileError.message);
  if (!profileId) throw new Error("Le profil de mapping HubSpot n’a pas pu être créé.");

  const { error: attachError } = await supabase.rpc("save_connector_entity_mapping", {
    target_connection_id: mapping.connection_id,
    target_mapping_id: mapping.id,
    target_entity_type: rawEntityType,
    target_external_object: mapping.external_object,
    target_direction: mapping.direction,
    target_mapping_profile_id: String(profileId),
    target_conflict_strategy: mapping.conflict_strategy,
    target_cursor_field: mapping.cursor_field,
    target_is_enabled: mapping.is_enabled,
  });
  if (attachError) throw new Error(attachError.message);

  revalidatePath("/dashboard/connectors");
}
