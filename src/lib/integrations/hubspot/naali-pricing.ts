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
    hs_lead_status?: string | null;
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
  leadStatus: string | null;
  freeUnitsRule: NaaliFreeUnitsRule | null;
  discountSource: "tr1_override" | "hubspot" | null;
  freeUnitsSource: "tr1_override" | "hubspot_lead_status" | "hubspot_field" | null;
  overrideNote: string | null;
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

  const match = normalized.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (!match) return null;
  const paidQuantity = Number(match[1]);
  const freeQuantity = Number(match[2]);
  if (!Number.isInteger(paidQuantity) || paidQuantity <= 0 || !Number.isInteger(freeQuantity) || freeQuantity < 0) {
    return null;
  }
  return { paidQuantity, freeQuantity, label: `${paidQuantity}+${freeQuantity}` };
}

function freeUnitsRuleFromLeadStatus(value: string | null | undefined): NaaliFreeUnitsRule | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "client ambassadeur") {
    return { paidQuantity: 12, freeQuantity: 2, label: "12+2" };
  }
  if (normalized === "client partenaire") {
    return { paidQuantity: 12, freeQuantity: 1, label: "12+1" };
  }
  return null;
}

function emptyPricing(): NaaliPharmacyPricing {
  return {
    discountRate: null,
    potential: null,
    leadStatus: null,
    freeUnitsRule: null,
    discountSource: null,
    freeUnitsSource: null,
    overrideNote: null,
  };
}

export async function getNaaliHubSpotPharmacyPricing(brandId: string, pharmacyId: string): Promise<NaaliPharmacyPricing> {
  const empty = emptyPricing();
  const admin = createAdminClient();
  const { data: relation, error: relationError } = await admin
    .from("brand_pharmacies")
    .select("id,external_id")
    .eq("brand_id", brandId)
    .eq("pharmacy_id", pharmacyId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (relationError) throw relationError;

  const { data: override, error: overrideError } = relation?.id
    ? await admin
        .from("brand_pharmacy_commercial_terms")
        .select("discount_rate,ug_paid_quantity,ug_free_quantity,note")
        .eq("brand_pharmacy_id", relation.id)
        .eq("brand_id", brandId)
        .maybeSingle()
    : { data: null, error: null };
  if (overrideError) throw overrideError;

  const { data: connection, error: connectionError } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference,configuration,status")
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .in("status", ["active", "paused"])
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (connectionError || !connection) {
    const manualRule =
      override?.ug_paid_quantity != null && override?.ug_free_quantity != null
        ? {
            paidQuantity: Number(override.ug_paid_quantity),
            freeQuantity: Number(override.ug_free_quantity),
            label: `${Number(override.ug_paid_quantity)}+${Number(override.ug_free_quantity)}`,
          }
        : null;
    return {
      ...empty,
      discountRate: override?.discount_rate == null ? null : Number(override.discount_rate),
      freeUnitsRule: manualRule,
      discountSource: override?.discount_rate == null ? null : "tr1_override",
      freeUnitsSource: manualRule ? "tr1_override" : null,
      overrideNote: override?.note?.trim() || null,
    };
  }

  const typedConnection = connection as HubSpotConnection;
  const mode = syncMode(typedConnection);
  const token = accessToken(typedConnection, mode);
  if (mode !== "write" || !token) {
    const manualRule =
      override?.ug_paid_quantity != null && override?.ug_free_quantity != null
        ? {
            paidQuantity: Number(override.ug_paid_quantity),
            freeQuantity: Number(override.ug_free_quantity),
            label: `${Number(override.ug_paid_quantity)}+${Number(override.ug_free_quantity)}`,
          }
        : null;
    return {
      ...empty,
      discountRate: override?.discount_rate == null ? null : Number(override.discount_rate),
      freeUnitsRule: manualRule,
      discountSource: override?.discount_rate == null ? null : "tr1_override",
      freeUnitsSource: manualRule ? "tr1_override" : null,
      overrideNote: override?.note?.trim() || null,
    };
  }

  const { data: link } = await admin
    .from("connector_external_links")
    .select("external_id")
    .eq("connection_id", typedConnection.id)
    .eq("entity_type", "pharmacies")
    .eq("tr1_record_id", pharmacyId)
    .maybeSingle();

  const companyId = link?.external_id || relation?.external_id;
  if (!companyId) return empty;

  const client = new HubSpotClient({
    mode,
    accessToken: token,
    baseUrl: typedConnection.base_url ?? undefined,
  });
  const response = await client.read<HubSpotCompanyResponse>(
    `/crm/v3/objects/companies/${encodeURIComponent(String(companyId))}?properties=remise_sur_facture_appliquee,potentiel,unites_gratuites,hs_lead_status`,
  );
  const properties = response.data?.properties;
  const hubSpotDiscount = parsePercentage(properties?.remise_sur_facture_appliquee);
  const leadStatusRule = freeUnitsRuleFromLeadStatus(properties?.hs_lead_status);
  const explicitFieldRule = parseFreeUnitsRule(properties?.unites_gratuites);
  const manualRule =
    override?.ug_paid_quantity != null && override?.ug_free_quantity != null
      ? {
          paidQuantity: Number(override.ug_paid_quantity),
          freeQuantity: Number(override.ug_free_quantity),
          label: `${Number(override.ug_paid_quantity)}+${Number(override.ug_free_quantity)}`,
        }
      : null;

  return {
    discountRate: override?.discount_rate == null ? hubSpotDiscount : Number(override.discount_rate),
    potential: properties?.potentiel?.trim() || null,
    leadStatus: properties?.hs_lead_status?.trim() || null,
    freeUnitsRule: manualRule ?? leadStatusRule ?? explicitFieldRule,
    discountSource: override?.discount_rate == null ? (hubSpotDiscount == null ? null : "hubspot") : "tr1_override",
    freeUnitsSource: manualRule
      ? "tr1_override"
      : leadStatusRule
        ? "hubspot_lead_status"
        : explicitFieldRule
          ? "hubspot_field"
          : null,
    overrideNote: override?.note?.trim() || null,
  };
}

export async function getNaaliHubSpotPharmacyDiscount(brandId: string, pharmacyId: string) {
  return (await getNaaliHubSpotPharmacyPricing(brandId, pharmacyId)).discountRate;
}
