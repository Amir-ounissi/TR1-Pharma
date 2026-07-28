"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

const uuid = z.string().uuid();

export async function createMissionFollowupAction(formData: FormData) {
  const parsed = z.object({
    missionId: uuid,
    dueAt: z.string().min(1),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { supabase, brand } = await requireActiveBrand();
  const { data: rows, error: impactError } = await supabase.rpc("get_mission_impact", {
    target_mission_id: parsed.data.missionId,
  });
  const impact = rows?.[0];
  if (impactError || !impact || impact.brand_id !== brand.id || !impact.followup_recommended) return;

  const dueAt = new Date(parsed.data.dueAt);
  if (Number.isNaN(dueAt.getTime())) return;
  const { error } = await supabase.rpc("create_agent_task", {
    target_brand_pharmacy_id: impact.brand_pharmacy_id,
    target_task_type: "follow_up",
    target_title: `Suivi après mission — ${impact.mission_title}`,
    target_due_at: dueAt.toISOString(),
    target_priority: "normal",
    target_description: "Vérifier les résultats observés et convenir de la prochaine action avec la pharmacie.",
  });
  if (error) return;

  await supabase.rpc("track_product_event", {
    target_event: "mission_followup_created",
    target_brand_id: brand.id,
    target_pharmacy_id: impact.pharmacy_id,
    target_source: "mission_impact",
    target_metadata: { mission_id: impact.mission_id },
  });
  revalidatePath("/dashboard/mission-performance");
  revalidatePath(`/dashboard/missions/${impact.mission_id}`);
  revalidatePath(`/dashboard/pharmacies/${impact.brand_pharmacy_id}`);
}

export async function trackMissionImpactAction(
  eventName: "mission_impact_viewed" | "mission_performance_dashboard_viewed" | "mission_type_comparison_viewed",
  missionId?: string,
) {
  const parsed = z.object({ eventName: z.enum(["mission_impact_viewed", "mission_performance_dashboard_viewed", "mission_type_comparison_viewed"]), missionId: uuid.optional() })
    .safeParse({ eventName, missionId });
  if (!parsed.success) return;
  const { supabase, brand } = await requireActiveBrand();
  await supabase.rpc("track_product_event", {
    target_event: parsed.data.eventName,
    target_brand_id: brand.id,
    target_pharmacy_id: null,
    target_source: "mission_impact",
    target_metadata: parsed.data.missionId ? { mission_id: parsed.data.missionId } : {},
  });
}

