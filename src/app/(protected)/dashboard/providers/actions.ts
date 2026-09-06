"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrandRole } from "@/lib/auth";
import {
  BRAND_PROVIDER_STATUSES,
  FIELD_PROVIDER_ACTIVITIES,
  FIELD_PROVIDER_TYPES,
  PROVIDER_CONTRACT_STATUSES,
} from "@/lib/field-providers";
import { assertActiveBrandCapability } from "@/lib/saas/server";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const providerType = z.enum(FIELD_PROVIDER_TYPES);
const activity = z.enum(FIELD_PROVIDER_ACTIVITIES);
const contractStatus = z.enum(PROVIDER_CONTRACT_STATUSES);
const relationStatus = z.enum(BRAND_PROVIDER_STATUSES);

async function requireProviderAdmin() {
  const [{ supabase, brand }] = await Promise.all([
    requireActiveBrandRole(["tr1_manager", "brand_admin", "super_admin"] as const),
    assertActiveBrandCapability("multi_provider"),
  ]);
  return { supabase, brand };
}

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return z.coerce.number().min(0).parse(raw);
}

function optionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? z.string().date().parse(raw) : null;
}

export async function saveBrandProviderFormAction(formData: FormData): Promise<void> {
  const fieldProviderIdValue = String(formData.get("fieldProviderId") ?? "").trim();
  const displayName = z.string().trim().min(2).max(160).parse(formData.get("displayName"));
  const email = z.string().trim().email().max(255).parse(formData.get("email"));
  const phone = z.string().trim().max(40).parse(String(formData.get("phone") ?? ""));
  const provider = providerType.parse(formData.get("providerType"));
  const activities = formData.getAll("activities").map((value) => activity.parse(value));
  const contract = contractStatus.parse(formData.get("contractStatus"));
  const dailyRate = optionalNumber(formData.get("dailyRateHt"));
  const halfDayRate = optionalNumber(formData.get("halfDayRateHt"));
  const travelRateType = z.string().trim().max(120).parse(String(formData.get("travelRateType") ?? ""));
  const preferred = String(formData.get("preferred") ?? "false") === "true";
  const priority = z.coerce.number().int().min(1).max(999).parse(formData.get("priority") ?? 100);
  const validFrom = optionalDate(formData.get("validFrom"));
  const validUntil = optionalDate(formData.get("validUntil"));
  const notes = z.string().trim().max(4000).parse(String(formData.get("notes") ?? ""));

  if (validFrom && validUntil && validUntil < validFrom) {
    throw new Error("La date de fin du contrat doit suivre sa date de début.");
  }

  const { supabase, brand } = await requireProviderAdmin();
  const { error } = await supabase.rpc("save_brand_field_provider", {
    target_brand_id: brand.id,
    target_field_provider_id: fieldProviderIdValue ? uuid.parse(fieldProviderIdValue) : null,
    target_display_name: displayName,
    target_email: email,
    target_phone: phone || null,
    target_provider_type: provider,
    target_activities: activities.length ? activities : ["other"],
    target_contract_status: contract,
    target_daily_rate_ht: dailyRate,
    target_half_day_rate_ht: halfDayRate,
    target_travel_rate_type: travelRateType || null,
    target_preferred: preferred,
    target_priority: priority,
    target_valid_from: validFrom,
    target_valid_until: validUntil,
    target_notes: notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/providers");
}

export async function setBrandProviderStatusFormAction(formData: FormData): Promise<void> {
  const relationId = uuid.parse(formData.get("relationId"));
  const status = relationStatus.parse(formData.get("status"));
  const { supabase, brand } = await requireProviderAdmin();
  const { error } = await supabase.rpc("set_brand_field_provider_status", {
    target_brand_id: brand.id,
    target_relation_id: relationId,
    target_status: status,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/providers");
}
