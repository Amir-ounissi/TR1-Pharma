import { redirect } from "next/navigation";
import { getBrandContexts, getOptionalActiveBrand, requireActiveBrand } from "@/lib/auth";
import {
  isSaasCapability,
  resolveBrandTerminology,
  type BrandTerminology,
  type SaasCapability,
} from "./capabilities";

type CapabilityRow = {
  capability_key: string;
  enabled: boolean;
  source: "override" | "plan" | "legacy_full" | "none";
};

export class SaasCapabilityUnavailableError extends Error {
  constructor(readonly capability: SaasCapability) {
    super(`SaaS capability unavailable: ${capability}`);
  }
}

export type ActiveBrandSaasContext = {
  brandId: string;
  capabilities: ReadonlySet<SaasCapability>;
  capabilitySources: ReadonlyMap<SaasCapability, CapabilityRow["source"]>;
  terminology: BrandTerminology;
  configuration: Record<string, unknown>;
};

function enabledCapabilities(rows: CapabilityRow[] | null) {
  return new Set<SaasCapability>(
    (rows ?? [])
      .filter((row) => row.enabled && isSaasCapability(row.capability_key))
      .map((row) => row.capability_key as SaasCapability),
  );
}

export async function getActiveBrandSaasContext(): Promise<ActiveBrandSaasContext> {
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: rows, error: capabilityError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.rpc("get_my_brand_capabilities", { target_brand_id: brand.id }),
    supabase
      .from("brand_saas_settings")
      .select("terminology,configuration")
      .eq("brand_id", brand.id)
      .maybeSingle(),
  ]);

  if (capabilityError) throw capabilityError;
  if (settingsError) throw settingsError;

  const capabilities = new Set<SaasCapability>();
  const capabilitySources = new Map<SaasCapability, CapabilityRow["source"]>();
  for (const row of (rows ?? []) as CapabilityRow[]) {
    if (!isSaasCapability(row.capability_key)) continue;
    capabilitySources.set(row.capability_key, row.source);
    if (row.enabled) capabilities.add(row.capability_key);
  }

  return {
    brandId: brand.id,
    capabilities,
    capabilitySources,
    terminology: resolveBrandTerminology(settings?.terminology),
    configuration:
      settings?.configuration && typeof settings.configuration === "object" && !Array.isArray(settings.configuration)
        ? (settings.configuration as Record<string, unknown>)
        : {},
  };
}

export async function activeBrandHasCapability(capability: SaasCapability) {
  const context = await getActiveBrandSaasContext();
  return context.capabilities.has(capability);
}

export async function assertActiveBrandCapability(capability: SaasCapability) {
  const context = await getActiveBrandSaasContext();
  if (!context.capabilities.has(capability)) throw new SaasCapabilityUnavailableError(capability);
  return context;
}

export async function requireActiveBrandCapability(
  capability: SaasCapability,
  fallback = "/dashboard",
) {
  const context = await getActiveBrandSaasContext();
  if (!context.capabilities.has(capability)) redirect(fallback);
  return context;
}

export async function requireAnyActiveBrandCapability(
  capabilities: readonly SaasCapability[],
  fallback = "/dashboard",
) {
  const context = await getActiveBrandSaasContext();
  if (!capabilities.some((capability) => context.capabilities.has(capability))) redirect(fallback);
  return context;
}

/**
 * Guards a workspace that can either be scoped to one active brand or, for a
 * facilitator-only account, span several brands at once.
 *
 * Facilitators never gain cross-tenant data access here: the RPC remains
 * tenant-scoped and only evaluates brands for which the current user already
 * has an active membership. Page queries continue to rely on their own RLS.
 */
export async function requireAnyWorkspaceCapability(
  capabilities: readonly SaasCapability[],
  fallback = "/dashboard",
) {
  const session = await getOptionalActiveBrand();

  if (session.brand) {
    const { data, error } = await session.supabase.rpc("get_my_brand_capabilities", {
      target_brand_id: session.brand.id,
    });
    if (error) throw error;
    const enabled = enabledCapabilities((data ?? []) as CapabilityRow[]);
    if (!capabilities.some((capability) => enabled.has(capability))) redirect(fallback);
    return { mode: "brand" as const, brandIds: [session.brand.id] };
  }

  const contexts = await getBrandContexts();
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");
  if (!facilitatorOnly) redirect(fallback);

  const checks = await Promise.all(
    contexts.map(async (context) => {
      const { data, error } = await session.supabase.rpc("get_my_brand_capabilities", {
        target_brand_id: context.id,
      });
      if (error) throw error;
      const enabled = enabledCapabilities((data ?? []) as CapabilityRow[]);
      return capabilities.some((capability) => enabled.has(capability)) ? context.id : null;
    }),
  );

  const brandIds = checks.filter((brandId): brandId is string => Boolean(brandId));
  if (brandIds.length === 0) redirect(fallback);
  return { mode: "facilitator" as const, brandIds };
}

export async function requireWorkspaceCapability(
  capability: SaasCapability,
  fallback = "/dashboard",
) {
  return requireAnyWorkspaceCapability([capability], fallback);
}
