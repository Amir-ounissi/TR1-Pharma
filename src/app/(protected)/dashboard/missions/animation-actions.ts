"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { parisLocalToIso } from "@/lib/agenda";

export type AnimationRequestActionState = {
  error?: string;
};

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

const uuid = z.string().uuid();

export async function createAnimationRequestAction(
  _state: AnimationRequestActionState,
  formData: FormData,
): Promise<AnimationRequestActionState> {
  const parsed = z.object({
    brandPharmacyId: uuid,
    assignedUserId: z.string().optional(),
    title: z.string().trim().min(3).max(180),
    objective: z.string().trim().min(3).max(2000),
    briefing: z.string().trim().max(10000).optional(),
    scheduledStartAt: z.string().min(16),
    scheduledEndAt: z.string().min(16),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    providerCostHt: z.coerce.number().min(0).max(100000),
    travelCostHt: z.coerce.number().min(0).max(100000),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Vérifiez la pharmacie, le créneau et les conditions de l’animation." };
  }

  let startAt: string;
  let endAt: string;
  try {
    startAt = parisLocalToIso(parsed.data.scheduledStartAt);
    endAt = parisLocalToIso(parsed.data.scheduledEndAt);
  } catch {
    return { error: "Le créneau de l’animation est invalide." };
  }

  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return { error: "La fin de l’animation doit être postérieure au début." };
  }

  const assignedUserId = parsed.data.assignedUserId?.trim() || null;
  if (assignedUserId && !uuid.safeParse(assignedUserId).success) {
    return { error: "L’animateur sélectionné est invalide." };
  }

  const selectedProductIds = formData.getAll("productId").map(String).filter(Boolean);
  const productPayload: Array<{
    product_id: string;
    target_quantity: number | null;
    priority: "normal" | "high";
    briefing_notes: string | null;
  }> = [];

  for (const productId of selectedProductIds) {
    if (!uuid.safeParse(productId).success) continue;
    const rawTarget = String(formData.get(`productTarget:${productId}`) ?? "").trim();
    const target = rawTarget === "" ? null : Number(rawTarget);
    if (target !== null && (!Number.isInteger(target) || target < 0 || target > 100000)) {
      return { error: "Un objectif produit est invalide." };
    }
    productPayload.push({
      product_id: productId,
      target_quantity: target,
      priority: formData.get(`productPriority:${productId}`) === "on" ? "high" : "normal",
      briefing_notes: String(formData.get(`productBrief:${productId}`) ?? "").trim() || null,
    });
  }

  const providerCostHt = parsed.data.providerCostHt;
  const travelCostHt = parsed.data.travelCostHt;
  const estimatedCostHt = Math.round((providerCostHt + travelCostHt) * 100) / 100;

  const executionRequirements = {
    report_required: true,
    merch_plan_required: formData.get("merchPlanRequired") === "on",
    merch_result_required: formData.get("merchResultRequired") === "on",
    cash_register_required: formData.get("cashRegisterRequired") === "on",
    before_after_required: formData.get("beforeAfterRequired") === "on",
    sales_by_product_required: formData.get("salesByProductRequired") === "on",
  };

  const { supabase, brand } = await requireActiveBrand();
  const { data, error } = await (supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => RpcResult<string>)("request_animation", {
    target_brand_pharmacy_id: parsed.data.brandPharmacyId,
    target_assigned_user_id: assignedUserId,
    mission_payload: {
      title: parsed.data.title,
      objective: parsed.data.objective,
      briefing: parsed.data.briefing || null,
      scheduled_start_at: startAt,
      scheduled_end_at: endAt,
      priority: parsed.data.priority,
      budget_estimated_ht: estimatedCostHt,
      cost_estimated_ht: estimatedCostHt,
      provider_cost_ht: providerCostHt,
      travel_cost_ht: travelCostHt,
      execution_requirements: executionRequirements,
    },
    product_payload: productPayload,
  });

  if (error) return { error: error.message };
  redirect(`/dashboard/missions/${data}?brand=${brand.id}`);
}
