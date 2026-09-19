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

type CommercialTermsRow = {
  discount_rate?: unknown;
  ug_paid_quantity?: unknown;
  ug_free_quantity?: unknown;
  note?: string | null;
  hubspot_discount_rate?: unknown;
  hubspot_ug_paid_quantity?: unknown;
  hubspot_ug_free_quantity?: unknown;
  hubspot_potential?: string | null;
  hubspot_lead_status?: string | null;
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

export function resolveNaaliFreeUnitsRuleFromLeadStatus(value: string | null | undefined): NaaliFreeUnitsRule | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "client ambassadeur") return { paidQuantity: 12, freeQuantity: 2, label: "12+2" };
  if (normalized === "client partenaire") return { paidQuantity: 12, freeQuantity: 1, label: "12+1" };
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

function rowRule(
  row: { ug_paid_quantity?: unknown; ug_free_quantity?: unknown } | null | undefined,
): NaaliFreeUnitsRule | null {
  if (row?.ug_paid_quantity == null || row?.ug_free_quantity == null) return null;
  const paidQuantity = Number(row.ug_paid_quantity);
  const freeQuantity = Number(row.ug_free_quantity);
  if (!Number.isInteger(paidQuantity) || paidQuantity <= 0 || !Number.isInteger(freeQuantity) || freeQuantity < 0) return null;
  return { paidQuantity, freeQuantity, label: `${paidQuantity}+${freeQuantity}` };
}

function cachedRule(row: CommercialTermsRow | null | undefined) {
  return rowRule({
    ug_paid_quantity: row?.hubspot_ug_paid_quantity,
    ug_free_quantity: row?.hubspot_ug_free_quantity,
  });
}

function fallbackPricing(row: CommercialTermsRow | null | undefined): NaaliPharmacyPricing {
  const manualFreeUnitsRule = rowRule(row);
  const hasManualDiscount = row?.discount_rate != null;
  const manualDiscount = hasManualDiscount ? Number(row?.discount_rate) : null;
  const hubSpotDiscount = row?.hubspot_discount_rate == null ? null : Number(row.hubspot_discount_rate);
  const hubSpotLeadStatus = row?.hubspot_lead_status?.trim() || null;
  const leadStatusRule = resolveNaaliFreeUnitsRuleFromLeadStatus(hubSpotLeadStatus);
  const cachedFreeUnitsRule = cachedRule(row);
  const hubSpotFreeUnitsRule = leadStatusRule ?? cachedFreeUnitsRule;

  return {
    discountRate: hasManualDiscount ? manualDiscount : hubSpotDiscount,
    potential: row?.hubspot_potential?.trim() || null,
    leadStatus: hubSpotLeadStatus,
    freeUnitsRule: manualFreeUnitsRule ?? hubSpotFreeUnitsRule,
    discountSource: hasManualDiscount
      ? "tr1_override"
      : hubSpotDiscount == null
        ? null
        : "hubspot",
    freeUnitsSource: manualFreeUnitsRule
      ? "tr1_override"
      : leadStatusRule
        ? "hubspot_lead_status"
        : cachedFreeUnitsRule
          ? "hubspot_field"
          : null,
    overrideNote: row?.note?.trim() || null,
  };
}

export async function getNaaliHubSpotPharmacyPricing(brandId: string, pharmacyId: string): Promise<NaaliPharmacyPricing> {
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

  const { data: terms, error: termsError } = relation?.id
    ? await admin
        .from("brand_pharmacy_commercial_terms")
        .select("discount_rate,ug_paid_quantity,ug_free_quantity,note,hubspot_discount_rate,hubspot_ug_paid_quantity,hubspot_ug_free_quantity,hubspot_potential,hubspot_lead_status")
        .eq("brand_pharmacy_id", relation.id)
        .eq("brand_id", brandId)
        .maybeSingle()
    : { data: null, error: null };
  if (termsError) throw termsError;

  const fallback = terms ? fallbackPricing(terms as CommercialTermsRow) : emptyPricing();

  const { data: connection, error: connectionError } = await admin
    .from("connector_connections")
    .select("id,base_url,credential_reference,configuration,status")
    .eq("brand_id", brandId)
    .eq("provider", "hubspot")
    .in("status", ["active", "paused"])
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (connectionError || !connection || !relation?.id) return fallback;

  const typedConnection = connection as HubSpotConnection;
  const mode = syncMode(typedConnection);
  const token = accessToken(typedConnection, mode);
  if (mode !== "write" || !token) return fallback;

  const { data: link } = await admin
    .from("connector_external_links")
    .select("external_id")
    .eq("connection_id", typedConnection.id)
    .eq("entity_type", "pharmacies")
    .eq("tr1_record_id", pharmacyId)
    .maybeSingle();

  const companyId = link?.external_id || relation.external_id;
  if (!companyId) return fallback;

  try {
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
    const leadStatusRule = resolveNaaliFreeUnitsRuleFromLeadStatus(properties?.hs_lead_status);
    const explicitFieldRule = parseFreeUnitsRule(properties?.unites_gratuites);
    const effectiveHubSpotRule = leadStatusRule ?? explicitFieldRule;

    const snapshot = {
      brand_pharmacy_id: relation.id,
      brand_id: brandId,
      hubspot_discount_rate: hubSpotDiscount,
      hubspot_ug_paid_quantity: effectiveHubSpotRule?.paidQuantity ?? null,
      hubspot_ug_free_quantity: effectiveHubSpotRule?.freeQuantity ?? null,
      hubspot_potential: properties?.potentiel?.trim() || null,
      hubspot_lead_status: properties?.hs_lead_status?.trim() || null,
      hubspot_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: snapshotError } = await admin
      .from("brand_pharmacy_commercial_terms")
      .upsert(snapshot, { onConflict: "brand_pharmacy_id" });
    if (snapshotError) console.error(`[hubspot] commercial terms cache failed: ${snapshotError.message}`);

    const manual = terms ? (terms as CommercialTermsRow) : null;
    const manualFreeUnitsRule = rowRule(manual);
    const hasManualDiscount = manual?.discount_rate != null;
    const manualDiscount = hasManualDiscount ? Number(manual?.discount_rate) : null;

    return {
      discountRate: hasManualDiscount ? manualDiscount : hubSpotDiscount,
      potential: snapshot.hubspot_potential,
      leadStatus: snapshot.hubspot_lead_status,
      freeUnitsRule: manualFreeUnitsRule ?? effectiveHubSpotRule,
      discountSource: hasManualDiscount ? "tr1_override" : hubSpotDiscount == null ? null : "hubspot",
      freeUnitsSource: manualFreeUnitsRule
        ? "tr1_override"
        : leadStatusRule
          ? "hubspot_lead_status"
          : explicitFieldRule
            ? "hubspot_field"
            : null,
      overrideNote: manual?.note?.trim() || null,
    };
  } catch (error) {
    console.error(
      `[hubspot] commercial terms live read failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}`,
    );
    return fallback;
  }
}

export async function getNaaliHubSpotPharmacyDiscount(brandId: string, pharmacyId: string) {
  return (await getNaaliHubSpotPharmacyPricing(brandId, pharmacyId)).discountRate;
}
