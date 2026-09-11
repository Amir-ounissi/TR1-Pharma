import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { HubSpotBrandConfiguration } from "./model";
import { buildHubSpotRuntimeProfile } from "./mapping-profile";

type RuntimeEntity = "orders" | "visits" | "notes";

export async function loadHubSpotRuntimeProfile(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  entityType: RuntimeEntity,
  baseConfig: HubSpotBrandConfiguration,
) {
  const { data: entityMapping, error: mappingError } = await admin
    .from("connector_entity_mappings")
    .select("mapping_profile_id")
    .eq("connection_id", connectionId)
    .eq("entity_type", entityType)
    .eq("is_enabled", true)
    .in("direction", ["outbound", "bidirectional"])
    .limit(1)
    .maybeSingle();
  if (mappingError) throw mappingError;

  const profileId = entityMapping?.mapping_profile_id ? String(entityMapping.mapping_profile_id) : null;
  if (!profileId) {
    return buildHubSpotRuntimeProfile({ baseConfig, entityType });
  }

  const { data: profile, error: profileError } = await admin
    .from("data_mapping_profiles")
    .select("entity_type,source_system,mapping,transforms,is_active")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw profileError;

  if (
    !profile
    || profile.is_active !== true
    || String(profile.source_system).toLowerCase() !== "hubspot"
    || String(profile.entity_type) !== entityType
  ) {
    return buildHubSpotRuntimeProfile({ baseConfig, entityType });
  }

  return buildHubSpotRuntimeProfile({
    baseConfig,
    entityType,
    mapping: profile.mapping,
    transforms: profile.transforms,
  });
}
