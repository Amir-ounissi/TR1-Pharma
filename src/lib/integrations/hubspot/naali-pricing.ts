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
    potentiel?: string | null;
    unites_gratuites?: string | null;
  };
};

export type NaaliFreeUnitsRule = {
  paidQuantity: number;
  freeQuantity: number;
  label: string;
};

export type NaaliPharmacyPricing = {
  discountRate: number | null;
  potential: string | null;
  freeUnitsRule: NaaliFreeUnitsRule | null;
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
  if (!normalized || normalized.toLowerCase() === "personnalisée") return null;
  const rate = Number(normalized);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
}

function parseFreeUnitsRule(value: string | null | undefined): NaaliFreeUnitsRule | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  // HubSpot currently stores enum internals as true/false for the labels 12+1 / 24+3.
  if (normalized === "true") return { paidQuantity: 12, freeQuantity: 1, label: "12+1" };
  if (normalized === "false") return { paidQuantity: 24, freeQuantity: 3, label: "24+3" };

  // Future-proof the parser if HubSpot switches to explicit labels (e.g. 12+2).
  const match = normalized.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (!match) return null;
  const paidQuantity = Number(match[1]);
  const freeQuantity = Number(match[2]);
  if (!Number.isInteger(paidQuantity) || paidQuantity <= 0 || !Number.isInteger(freeQuantity) || freeQuantity < 0) {
    return null;
  }
  return { paidQuantity, freeQuantity, label: `${paidQuantity}+${freeQuantity}` };
}

export async function getNaaliHubSpotPharmacyPricing(brandId: string, pharmacyId: string): Promise<NaaliPharmacyPricing> {
  const empty: NaaliPharmacyPricing = { discountRate: null, potential: null, freeUnitsRule: null };
  const admin = createAdminClient();
  const { data: connection, error: connectionError } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference,configuration,status")
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .in("status", ["active", "paused"])
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (connectionError || !connection) return empty;

  const typedConnection = connection as HubSpotConnection;
  const mode = syncMode(typedConnection);
  const token = accessToken(typedConnection, mode);
  if (mode !== "write" || !token) return empty;

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
  if (!companyId) return empty;

  const client = new HubSpotClient({
    mode,
    accessToken: token,
    baseUrl: typedConnection.base_url ?? undefined,
  });
  const response = await client.read<HubSpotCompanyResponse>(
    `/crm/v3/objects/companies/${encodeURIComponent(String(companyId))}?properties=remise_sur_facture_appliquee,potentiel,unites_gratuites`,
  );
  const properties = response.data?.properties;
  return {
    discountRate: parsePercentage(properties?.remise_sur_facture_appliquee),
    potential: properties?.potentiel?.trim() || null,
    freeUnitsRule: parseFreeUnitsRule(properties?.unites_gratuites),
  };
}

export async function getNaaliHubSpotPharmacyDiscount(brandId: string, pharmacyId: string) {
  return (await getNaaliHubSpotPharmacyPricing(brandId, pharmacyId)).discountRate;
}
