"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

const uuid = z.string().uuid();

export type ObjectiveActionState = { success?: string; error?: string };

const objectiveSchema = z.object({
  objectiveId: z.union([uuid, z.literal("")]).optional(),
  scopeType: z.enum(["brand", "territory", "agent"]),
  metricKey: z.enum([
    "revenue_ht",
    "implantations",
    "reorders",
    "first_reorder_rate",
    "active_pharmacies",
    "avg_distribution_rate",
    "strategic_distribution_rate",
    "missions",
    "animations",
    "trainings",
  ]),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  territoryId: z.union([uuid, z.literal(""), z.literal("none")]).optional(),
  userId: z.union([uuid, z.literal(""), z.literal("none")]).optional(),
  targetValue: z.coerce.number().min(0),
  note: z.string().trim().max(1000).optional(),
});

export async function saveObjectiveAction(_: ObjectiveActionState, formData: FormData): Promise<ObjectiveActionState> {
  const parsed = objectiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Objectif invalide." };
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.rpc("save_performance_objective", {
    target_objective_id: parsed.data.objectiveId || null,
    target_brand_id: brand.id,
    target_scope_type: parsed.data.scopeType,
    target_metric_key: parsed.data.metricKey,
    target_period_start: parsed.data.periodStart,
    target_period_end: parsed.data.periodEnd,
    target_target_value: parsed.data.targetValue,
    target_territory_id: !parsed.data.territoryId || parsed.data.territoryId === "none" ? null : parsed.data.territoryId,
    target_user_id: !parsed.data.userId || parsed.data.userId === "none" ? null : parsed.data.userId,
    target_note: parsed.data.note || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/network");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agent/performance");
  return { success: "Objectif enregistré." };
}

export async function archiveObjectiveAction(objectiveId: string): Promise<ObjectiveActionState> {
  const parsed = uuid.safeParse(objectiveId);
  if (!parsed.success) return { error: "Identifiant invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("archive_performance_objective", { target_objective_id: parsed.data });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/network");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agent/performance");
  return { success: "Objectif archivé." };
}

export async function archiveObjectiveFormAction(formData: FormData): Promise<void> {
  const objectiveId = String(formData.get("objectiveId") ?? "");
  await archiveObjectiveAction(objectiveId);
}
