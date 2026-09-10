"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { parisLocalToIso } from "@/lib/agenda";

export type AnimationRequestActionState = {
  error?: string;
};

export type AnimationScheduleActionState = {
  error?: string;
};

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

const uuid = z.string().uuid();
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthToDate(value: string) {
  return `${value}-01`;
}

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
    daysPerMonth: z.coerce.number().int().min(1).max(31),
    startMonth: z.string().regex(monthPattern),
    endMonth: z.string().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    remunerationModel: z.enum(["fixed", "tiered"]),
    fixedAmountHt: z.string().optional(),
    travelCostHt: z.coerce.number().min(0).max(100000),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Vérifiez la pharmacie, le rythme mensuel et les conditions de l’animation." };
  }

  const assignedUserId = parsed.data.assignedUserId?.trim() || null;
  if (assignedUserId && !uuid.safeParse(assignedUserId).success) {
    return { error: "L’animateur sélectionné est invalide." };
  }

  const endMonth = parsed.data.endMonth?.trim() || null;
  if (endMonth && !monthPattern.test(endMonth)) {
    return { error: "Le mois de fin est invalide." };
  }
  if (endMonth && endMonth < parsed.data.startMonth) {
    return { error: "Le mois de fin ne peut pas précéder le mois de démarrage." };
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

  let remunerationConfig: Record<string, unknown>;
  let providerCostHt = 0;

  if (parsed.data.remunerationModel === "fixed") {
    const fixedAmount = Number(parsed.data.fixedAmountHt ?? "");
    if (!Number.isFinite(fixedAmount) || fixedAmount < 0 || fixedAmount > 100000) {
      return { error: "Le montant fixe par journée est invalide." };
    }
    providerCostHt = fixedAmount;
    remunerationConfig = { fixed_amount_ht: fixedAmount };
  } else {
    const minimums = formData.getAll("tierMin").map(String);
    const maximums = formData.getAll("tierMax").map(String);
    const amounts = formData.getAll("tierAmountHt").map(String);

    const tiers: Array<{ min_sales: number; max_sales: number | null; amount_ht: number }> = [];
    for (let index = 0; index < minimums.length; index += 1) {
      const minSales = Number(minimums[index]);
      const rawMax = maximums[index]?.trim() ?? "";
      const maxSales = rawMax === "" ? null : Number(rawMax);
      const amountHt = Number(amounts[index]);
      if (
        !Number.isInteger(minSales) || minSales < 0 ||
        (maxSales !== null && (!Number.isInteger(maxSales) || maxSales < minSales)) ||
        !Number.isFinite(amountHt) || amountHt < 0 || amountHt > 100000
      ) {
        return { error: "Un palier de rémunération est invalide." };
      }
      tiers.push({ min_sales: minSales, max_sales: maxSales, amount_ht: amountHt });
    }

    if (!tiers.length) return { error: "Ajoutez au moins un palier de rémunération." };
    tiers.sort((a, b) => a.min_sales - b.min_sales);
    for (let index = 1; index < tiers.length; index += 1) {
      const previous = tiers[index - 1];
      const current = tiers[index];
      if (previous.max_sales === null || current.min_sales <= previous.max_sales) {
        return { error: "Les paliers de rémunération se chevauchent." };
      }
    }
    remunerationConfig = { tiers };
  }

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
      days_per_month: parsed.data.daysPerMonth,
      start_month: monthToDate(parsed.data.startMonth),
      end_month: endMonth ? monthToDate(endMonth) : null,
      priority: parsed.data.priority,
      provider_cost_ht: providerCostHt,
      travel_cost_ht: parsed.data.travelCostHt,
      remuneration_model: parsed.data.remunerationModel,
      remuneration_config: remunerationConfig,
      execution_requirements: executionRequirements,
    },
    product_payload: productPayload,
  });

  if (error) return { error: error.message };
  redirect(`/dashboard/missions/${data}?brand=${brand.id}`);
}

export async function scheduleOwnAnimationAction(
  _state: AnimationScheduleActionState,
  formData: FormData,
): Promise<AnimationScheduleActionState> {
  const parsed = z.object({
    missionId: uuid,
    scheduledStartAt: z.string().min(16),
    scheduledEndAt: z.string().min(16),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: "Le créneau choisi est invalide." };

  let startAt: string;
  let endAt: string;
  try {
    startAt = parisLocalToIso(parsed.data.scheduledStartAt);
    endAt = parisLocalToIso(parsed.data.scheduledEndAt);
  } catch {
    return { error: "Le créneau choisi est invalide." };
  }

  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return { error: "La fin doit être postérieure au début." };
  }

  const { supabase } = await requireActiveBrand();
  const { error } = await (supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => RpcResult<null>)("schedule_my_animation", {
    target_mission_id: parsed.data.missionId,
    target_scheduled_start_at: startAt,
    target_scheduled_end_at: endAt,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/missions/${parsed.data.missionId}`);
  revalidatePath("/dashboard/field");
  revalidatePath("/dashboard/agenda");
  redirect(`/dashboard/missions/${parsed.data.missionId}`);
}

export async function scheduleAnimationRequestDayAction(
  _state: AnimationScheduleActionState,
  formData: FormData,
): Promise<AnimationScheduleActionState> {
  const parsed = z.object({
    missionId: uuid,
    scheduledStartAt: z.string().min(16),
    scheduledEndAt: z.string().min(16),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Le créneau choisi est invalide." };

  let startAt: string;
  let endAt: string;
  try {
    startAt = parisLocalToIso(parsed.data.scheduledStartAt);
    endAt = parisLocalToIso(parsed.data.scheduledEndAt);
  } catch {
    return { error: "Le créneau choisi est invalide." };
  }
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return { error: "La fin doit être postérieure au début." };
  }

  const { supabase } = await requireActiveBrand();
  const { data, error } = await (supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => RpcResult<string>)("schedule_animation_request_day", {
    target_request_mission_id: parsed.data.missionId,
    target_scheduled_start_at: startAt,
    target_scheduled_end_at: endAt,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/missions/${parsed.data.missionId}`);
  revalidatePath(`/dashboard/missions/${parsed.data.missionId}/schedule-animation`);
  revalidatePath("/dashboard/field");
  revalidatePath("/dashboard/missions");
  revalidatePath("/dashboard/agenda");
  redirect(`/dashboard/missions/${data}`);
}
