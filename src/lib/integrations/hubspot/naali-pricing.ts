import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient, type HubSpotClientMode } from "./client";

type HubSpotConnection = {
  id: string;
  base_url: string | null;
  credential_reference: string | null;
  configuration: Record<string, unknown> | null;
};

type HubSpotCompanyResponse = {
  id?: string;
  properties?: {
    remise_sur_facture_appliquee?: string | null;
  };
};

function configuredMode(connection: HubSpotConnection) {
  const value = connection.configuration?.mode;
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function syncMode(connection: HubSpotConnection): HubSpotClientMode {
  const requested = process.env.TR1_HUBSPOT_MODE?.trim().toLowerCase();
  const configured = configuredMode(connection);
  const writeEnabled = connection.configuration?.write_enabled === true;

  if (requested === "dry_run") return "dry_run";
  if (!requested && configured === "dry_run") return "dry_run";
  if (
    requested === "write" &&
    configured === "write" &&
    writeEnabled &&
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

function parsePercentage(value: string | null | undefined) {
  const normalized = value?.trim().replace("%", "").replace(",", ".");
  if (!normalized) return null;
  const rate = Number(normalized);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
}

export async function getNaaliHubSpotPharmacyDiscount(brandId: string, pharmacyId: string) {
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
  if (connectionError || !connection) return null;

  const typedConnection = connection as HubSpotConnection;
  const mode = syncMode(typedConnection);
  const token = accessToken(typedConnection, mode);
  if (mode !== "write" || !token) return null;

  const [{ data: link }, { data: relation }] = await Promise.all([
    admin
      .from("connector_external_links")
      .select("external_id")
      .eq("connection_id", typedConnection.id)
      .eq("entity_type", "pharmacies")
      .eq("tr1_record_id", pharmacyId)
      .maybeSingle(),
    admin
      .from("brand_pharmacies")
      .select("external_id")
      .eq("brand_id", brandId)
      .eq("pharmacy_id", pharmacyId)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const companyId = link?.external_id || relation?.external_id;
  if (!companyId) return null;

  const client = new HubSpotClient({
    mode,
    accessToken: token,
    baseUrl: typedConnection.base_url ?? undefined,
  });
  const response = await client.read<HubSpotCompanyResponse>(
    `/crm/v3/objects/companies/${encodeURIComponent(String(companyId))}?properties=remise_sur_facture_appliquee`,
  );
  return parsePercentage(response.data?.properties?.remise_sur_facture_appliquee);
}
