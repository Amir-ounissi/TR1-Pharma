"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { assertActiveBrandCapability } from "@/lib/saas/server";

const uuid = z.string().uuid();
const campaignType = z.enum(["activation", "launch", "animation", "training", "merchandising", "visibility", "sell_out", "sampling", "promotion", "other"]);
const campaignStatus = z.enum(["draft", "planned", "active", "completed", "cancelled"]);

const campaignSchema = z.object({
  campaignId: z.union([uuid, z.literal("")]).optional(),
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(64).optional(),
  campaignType,
  status: campaignStatus,
  objective: z.string().trim().max(2000).optional(),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  budgetPlannedHt: z.coerce.number().min(0),
  notes: z.string().trim().max(5000).optional(),
});

async function requireTradeBrand() {
  const [{ supabase, brand }] = await Promise.all([
    requireActiveBrand(),
    assertActiveBrandCapability("trade_marketing"),
  ]);
  return { supabase, brand };
}

export async function saveTradeCampaignFormAction(formData: FormData): Promise<void> {
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Campagne Trade Marketing invalide.");
  if (parsed.data.endsOn < parsed.data.startsOn) throw new Error("La date de fin doit suivre la date de début.");
  const { supabase, brand } = await requireTradeBrand();
  const { error } = await supabase.rpc("save_trade_campaign", {
    target_campaign_id: parsed.data.campaignId || null,
    target_brand_id: brand.id,
    target_name: parsed.data.name,
    target_code: parsed.data.code || null,
    target_campaign_type: parsed.data.campaignType,
    target_status: parsed.data.status,
    target_objective: parsed.data.objective || null,
    target_starts_on: parsed.data.startsOn,
    target_ends_on: parsed.data.endsOn,
    target_budget_planned_ht: parsed.data.budgetPlannedHt,
    target_notes: parsed.data.notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/trade");
}

export async function archiveTradeCampaignFormAction(formData: FormData): Promise<void> {
  const campaignId = uuid.parse(formData.get("campaignId"));
  const { supabase } = await requireTradeBrand();
  const { error } = await supabase.rpc("archive_trade_campaign", { target_campaign_id: campaignId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/trade");
}

export async function setTradeCampaignTargetFormAction(formData: FormData): Promise<void> {
  const campaignId = uuid.parse(formData.get("campaignId"));
  const brandPharmacyId = uuid.parse(formData.get("brandPharmacyId"));
  const included = String(formData.get("included") ?? "true") !== "false";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  const { supabase } = await requireTradeBrand();
  const { error } = await supabase.rpc("set_trade_campaign_target", {
    target_campaign_id: campaignId,
    target_brand_pharmacy_id: brandPharmacyId,
    target_included: included,
    target_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/trade/${campaignId}`);
  revalidatePath("/dashboard/trade");
}

export async function setTradeCampaignProductFormAction(formData: FormData): Promise<void> {
  const campaignId = uuid.parse(formData.get("campaignId"));
  const productId = uuid.parse(formData.get("productId"));
  const included = String(formData.get("included") ?? "true") !== "false";
  const targetUnitsValue = String(formData.get("targetUnits") ?? "").trim();
  const targetDistributionValue = String(formData.get("targetDistributionRate") ?? "").trim();
  const targetUnits = targetUnitsValue ? z.coerce.number().int().min(0).parse(targetUnitsValue) : null;
  const targetDistributionRate = targetDistributionValue ? z.coerce.number().min(0).max(100).parse(targetDistributionValue) : null;
  const { supabase } = await requireTradeBrand();
  const { error } = await supabase.rpc("set_trade_campaign_product", {
    target_campaign_id: campaignId,
    target_product_id: productId,
    target_included: included,
    target_units: targetUnits,
    target_distribution_rate: targetDistributionRate,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/trade/${campaignId}`);
}

export async function setTradeCampaignMissionFormAction(formData: FormData): Promise<void> {
  const campaignId = uuid.parse(formData.get("campaignId"));
  const missionId = uuid.parse(formData.get("missionId"));
  const linked = String(formData.get("linked") ?? "true") !== "false";
  const { supabase } = await requireTradeBrand();
  const { error } = await supabase.rpc("set_trade_campaign_mission", {
    target_campaign_id: campaignId,
    target_mission_id: missionId,
    target_linked: linked,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/trade/${campaignId}`);
  revalidatePath("/dashboard/trade");
}
