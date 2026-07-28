"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

export type CommercialHealthActionState = { error?: string; success?: string };

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export async function createReorderFollowupAction(
  _state: CommercialHealthActionState,
  formData: FormData,
): Promise<CommercialHealthActionState> {
  const parsed = z.object({
    brandPharmacyId: uuid,
    dueAt: z.string().min(1),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Relance invalide." };

  const { supabase, brand } = await requireActiveBrand();
  const { data: rows, error: healthError } = await supabase.rpc("get_commercial_health", {
    target_brand_pharmacy_id: parsed.data.brandPharmacyId,
  });
  const health = rows?.[0];
  if (healthError || !health || health.brand_id !== brand.id) return { error: "Compte inaccessible." };

  const dueAt = new Date(parsed.data.dueAt);
  if (Number.isNaN(dueAt.getTime())) return { error: "Échéance invalide." };
  const { error } = await supabase.rpc("create_agent_task", {
    target_brand_pharmacy_id: health.brand_pharmacy_id,
    target_task_type: "call",
    target_title: `Relance réassort — ${health.pharmacy_name}`,
    target_due_at: dueAt.toISOString(),
    target_priority: health.priority_score >= 70 ? "urgent" : "high",
    target_description: health.recommendation,
  });
  if (error) return { error: error.message };

  await supabase.rpc("track_product_event", {
    target_event: "reorder_followup_created",
    target_brand_id: brand.id,
    target_pharmacy_id: health.pharmacy_id,
    target_source: "commercial_health",
    target_metadata: { health_status: health.health_status },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commercial-health");
  revalidatePath("/dashboard/agent");
  revalidatePath(`/dashboard/pharmacies/${health.brand_pharmacy_id}`);
  return { success: "Relance créée et ajoutée à votre journée." };
}

export async function updateCommercialHealthSettingsAction(
  _state: CommercialHealthActionState,
  formData: FormData,
): Promise<CommercialHealthActionState> {
  const parsed = z.object({
    defaultInterval: z.coerce.number().int().min(1).max(365),
    firstReorder: z.coerce.number().int().min(1).max(365),
    dueSoon: z.coerce.number().int().min(1).max(90),
    atRisk: z.coerce.number().min(1.01).max(4.99),
    dormant: z.coerce.number().min(1.01).max(9.99),
    eligibility: z.coerce.number().int().min(1).max(365),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.atRisk >= parsed.data.dormant || parsed.data.dueSoon >= parsed.data.firstReorder) {
    return { error: "Paramètres de réassort incohérents." };
  }
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.rpc("update_commercial_health_settings", {
    target_brand_id: brand.id,
    target_default_interval_days: parsed.data.defaultInterval,
    target_first_reorder_days: parsed.data.firstReorder,
    target_due_soon_days: parsed.data.dueSoon,
    target_at_risk_multiplier: parsed.data.atRisk,
    target_dormant_multiplier: parsed.data.dormant,
    target_eligibility_days: parsed.data.eligibility,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commercial-health");
  return { success: "Règles de réassort enregistrées." };
}

export async function trackCommercialEventAction(eventName: string, pharmacyId?: string) {
  const parsed = z.object({
    eventName: z.enum([
      "manager_commercial_dashboard_viewed",
      "commercial_priority_opened",
      "reorder_opportunity_opened",
      "first_reorder_viewed",
      "at_risk_account_opened",
      "dormant_account_opened",
      "commercial_health_viewed",
    ]),
    pharmacyId: uuid.optional(),
  }).safeParse({ eventName, pharmacyId });
  if (!parsed.success) return;
  const { supabase, brand } = await requireActiveBrand();
  await supabase.rpc("track_product_event", {
    target_event: parsed.data.eventName,
    target_brand_id: brand.id,
    target_pharmacy_id: parsed.data.pharmacyId ?? null,
    target_source: "commercial_health",
    target_metadata: {},
  });
}
