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
  HUBSPOT_ACTIVITY_TYPE_OPTIONS,
  HUBSPOT_ORDER_TYPE_OPTIONS,
  MEETING_PROPERTY_KEYS,
  ORDER_PROPERTY_KEYS,
  TR1_ORDER_TYPE_KEYS,
  TR1_VISIT_KIND_KEYS,
  isSafeHubSpotPropertyName,
} from "@/lib/integrations/hubspot/mapping-profile";
import { assertActiveBrandCapability } from "@/lib/saas/server";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const connectionStatus = z.enum(["draft", "ready", "active", "paused", "error"]);
const mappingDirection = z.enum(["inbound", "outbound", "bidirectional"]);
const conflictStrategy = z.enum(["manual", "external_wins", "tr1_wins", "newest_wins"]);
const entityType = z.enum(CONNECTOR_ENTITY_TYPES);
const hubSpotAdminEntity = z.enum(["orders", "visits"]);
const hubSpotProperty = z.string().trim().max(160).refine((value) => !value || isSafeHubSpotPropertyName(value), "Champ HubSpot invalide.");
const requiredOrderProperties = new Set(["name", "amountHt", "ownerId", "pipeline", "stage"]);
const requiredVisitProperties = new Set(["name", "startAt", "endAt", "outcome", "ownerId", "activityType", "body"]);

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

export async function saveHubSpotFieldMappingFormAction(formData: FormData): Promise<void> {
  const connectionId = uuid.parse(formData.get("connectionId"));
  const parsedEntity = hubSpotAdminEntity.parse(formData.get("entityType"));
  const { supabase, brand } = await requireConnectorAdmin();

  const { data: connection, error: connectionError } = await supabase
    .from("connector_connections")
    .select("id,provider")
    .eq("id", connectionId)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection || connection.provider !== "hubspot") throw new Error("Connexion HubSpot introuvable.");

  const { data: connectorMapping, error: connectorMappingError } = await supabase
    .from("connector_entity_mappings")
    .select("id,entity_type,external_object,direction,mapping_profile_id,conflict_strategy,cursor_field,is_enabled")
    .eq("connection_id", connectionId)
    .eq("brand_id", brand.id)
    .eq("entity_type", parsedEntity)
    .limit(1)
    .maybeSingle();
  if (connectorMappingError) throw new Error(connectorMappingError.message);
  if (!connectorMapping) throw new Error(`Activez d’abord la synchronisation ${parsedEntity === "orders" ? "Commandes" : "Visites"}.`);
  if (!connectorMapping.is_enabled || !["outbound", "bidirectional"].includes(connectorMapping.direction)) {
    throw new Error("Ce flux HubSpot n’est pas configuré pour envoyer les données TR1.");
  }

  const propertyKeys = parsedEntity === "orders" ? ORDER_PROPERTY_KEYS : MEETING_PROPERTY_KEYS;
  const requiredProperties = parsedEntity === "orders" ? requiredOrderProperties : requiredVisitProperties;
  const propertyMapping: Record<string, string> = {};
  for (const key of propertyKeys) {
    const value = hubSpotProperty.parse(String(formData.get(`property_${key}`) ?? ""));
    if (requiredProperties.has(key) && !value) {
      throw new Error(`Le champ HubSpot ${key} est obligatoire pour ce flux.`);
    }
    propertyMapping[key] = value;
  }

  const transforms: Record<string, Record<string, string>> = {};
  if (parsedEntity === "orders") {
    const allowed = new Set<string>(HUBSPOT_ORDER_TYPE_OPTIONS);
    const values: Record<string, string> = {};
    for (const key of TR1_ORDER_TYPE_KEYS) {
      const value = String(formData.get(`value_${key}`) ?? "").trim();
      if (value && !allowed.has(value)) throw new Error(`Type de commande HubSpot invalide pour ${key}.`);
      values[key] = value;
    }
    transforms.orderTypeValues = values;
  } else {
    const allowed = new Set<string>(HUBSPOT_ACTIVITY_TYPE_OPTIONS);
    const values: Record<string, string> = {};
    for (const key of TR1_VISIT_KIND_KEYS) {
      const value = String(formData.get(`value_${key}`) ?? "").trim();
      if (!value || !allowed.has(value)) throw new Error(`Type de visite HubSpot invalide pour ${key}.`);
      values[key] = value;
    }
    transforms.visitTypeValues = values;
  }

  let existingHubSpotProfileId: string | null = null;
  if (connectorMapping.mapping_profile_id) {
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("data_mapping_profiles")
      .select("id,source_system")
      .eq("id", connectorMapping.mapping_profile_id)
      .eq("brand_id", brand.id)
      .maybeSingle();
    if (existingProfileError) throw new Error(existingProfileError.message);
    if (existingProfile && String(existingProfile.source_system).toLowerCase() === "hubspot") {
      existingHubSpotProfileId = String(existingProfile.id);
    }
  }

  const mapping = parsedEntity === "orders"
    ? { order: propertyMapping }
    : { meeting: propertyMapping };
  const profileName = parsedEntity === "orders" ? "HubSpot · Commandes" : "HubSpot · Visites";
  const { data: profileId, error: profileError } = await supabase.rpc("save_data_mapping_profile", {
    target_brand_id: brand.id,
    target_profile_id: existingHubSpotProfileId,
    target_name: profileName,
    target_entity_type: parsedEntity,
    target_source_system: "hubspot",
    target_mapping: mapping,
    target_transforms: transforms,
    target_is_default: false,
  });
  if (profileError || !profileId) throw new Error(profileError?.message ?? "Le mapping HubSpot n’a pas pu être enregistré.");

  const { error: linkError } = await supabase.rpc("save_connector_entity_mapping", {
    target_connection_id: connectionId,
    target_mapping_id: connectorMapping.id,
    target_entity_type: parsedEntity,
    target_external_object: connectorMapping.external_object,
    target_direction: connectorMapping.direction,
    target_mapping_profile_id: profileId,
    target_conflict_strategy: connectorMapping.conflict_strategy,
    target_cursor_field: connectorMapping.cursor_field,
    target_is_enabled: connectorMapping.is_enabled,
  });
  if (linkError) throw new Error(linkError.message);

  revalidatePath("/dashboard/connectors");
}
