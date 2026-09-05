"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { isSaasCapability } from "@/lib/saas/capabilities";

const planSchema = z.object({
  brandId: z.string().uuid(),
  planKey: z.string().trim().min(2).max(64).regex(/^[a-z][a-z0-9_]+$/),
  status: z.enum(["trialing", "active", "suspended"]),
  seatLimit: z.union([z.literal(""), z.coerce.number().int().positive().max(100000)]),
});

const overrideSchema = z.object({
  brandId: z.string().uuid(),
  capabilityKey: z.string().trim().min(2).max(64),
  enabled: z.enum(["true", "false"]),
  reason: z.string().trim().max(500).optional(),
  expiresAt: z.string().trim().optional(),
});

const clearOverrideSchema = z.object({
  brandId: z.string().uuid(),
  capabilityKey: z.string().trim().min(2).max(64),
});

const terminologySchema = z.object({
  brandId: z.string().uuid(),
  fieldRepSingular: z.string().trim().min(1).max(80),
  fieldRepPlural: z.string().trim().min(1).max(80),
  managerSingular: z.string().trim().min(1).max(80),
  managerPlural: z.string().trim().min(1).max(80),
  pharmacySingular: z.string().trim().min(1).max(80),
  pharmacyPlural: z.string().trim().min(1).max(80),
  customerSingular: z.string().trim().min(1).max(80),
  customerPlural: z.string().trim().min(1).max(80),
  initialOrder: z.string().trim().min(1).max(80),
  reorder: z.string().trim().min(1).max(80),
  missionSingular: z.string().trim().min(1).max(80),
  missionPlural: z.string().trim().min(1).max(80),
});

function revalidateSaas(brandId: string) {
  revalidatePath("/dashboard/admin/saas");
  revalidatePath(`/dashboard/admin/saas?brand=${brandId}`);
}

export async function setBrandPlanAction(formData: FormData) {
  const parsed = planSchema.parse({
    brandId: formData.get("brandId"),
    planKey: formData.get("planKey"),
    status: formData.get("status"),
    seatLimit: formData.get("seatLimit") ?? "",
  });
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("set_brand_saas_plan", {
    target_brand_id: parsed.brandId,
    target_plan_key: parsed.planKey,
    target_status: parsed.status,
    target_seat_limit: parsed.seatLimit === "" ? null : parsed.seatLimit,
  });
  if (error) throw new Error(error.message);
  revalidateSaas(parsed.brandId);
}

export async function setCapabilityOverrideAction(formData: FormData) {
  const parsed = overrideSchema.parse({
    brandId: formData.get("brandId"),
    capabilityKey: formData.get("capabilityKey"),
    enabled: formData.get("enabled"),
    reason: formData.get("reason") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!isSaasCapability(parsed.capabilityKey)) throw new Error("Capacité SaaS inconnue.");
  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("Date d’expiration invalide.");

  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("set_brand_capability_override", {
    target_brand_id: parsed.brandId,
    target_capability_key: parsed.capabilityKey,
    target_enabled: parsed.enabled === "true",
    target_reason: parsed.reason || null,
    target_expires_at: expiresAt?.toISOString() ?? null,
  });
  if (error) throw new Error(error.message);
  revalidateSaas(parsed.brandId);
}

export async function clearCapabilityOverrideAction(formData: FormData) {
  const parsed = clearOverrideSchema.parse({
    brandId: formData.get("brandId"),
    capabilityKey: formData.get("capabilityKey"),
  });
  if (!isSaasCapability(parsed.capabilityKey)) throw new Error("Capacité SaaS inconnue.");
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("clear_brand_capability_override", {
    target_brand_id: parsed.brandId,
    target_capability_key: parsed.capabilityKey,
  });
  if (error) throw new Error(error.message);
  revalidateSaas(parsed.brandId);
}

export async function updateBrandTerminologyAction(formData: FormData) {
  const parsed = terminologySchema.parse({
    brandId: formData.get("brandId"),
    fieldRepSingular: formData.get("fieldRepSingular"),
    fieldRepPlural: formData.get("fieldRepPlural"),
    managerSingular: formData.get("managerSingular"),
    managerPlural: formData.get("managerPlural"),
    pharmacySingular: formData.get("pharmacySingular"),
    pharmacyPlural: formData.get("pharmacyPlural"),
    customerSingular: formData.get("customerSingular"),
    customerPlural: formData.get("customerPlural"),
    initialOrder: formData.get("initialOrder"),
    reorder: formData.get("reorder"),
    missionSingular: formData.get("missionSingular"),
    missionPlural: formData.get("missionPlural"),
  });
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("update_brand_saas_settings", {
    target_brand_id: parsed.brandId,
    terminology_patch: {
      field_rep_singular: parsed.fieldRepSingular,
      field_rep_plural: parsed.fieldRepPlural,
      manager_singular: parsed.managerSingular,
      manager_plural: parsed.managerPlural,
      pharmacy_singular: parsed.pharmacySingular,
      pharmacy_plural: parsed.pharmacyPlural,
      customer_singular: parsed.customerSingular,
      customer_plural: parsed.customerPlural,
      initial_order: parsed.initialOrder,
      reorder: parsed.reorder,
      mission_singular: parsed.missionSingular,
      mission_plural: parsed.missionPlural,
    },
    configuration_patch: null,
  });
  if (error) throw new Error(error.message);
  revalidateSaas(parsed.brandId);
}
