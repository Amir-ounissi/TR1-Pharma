"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { missionStatuses, missionTypes, safeObjectName } from "@/lib/missions";

export type MissionActionState = { error?: string; success?: string };
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const emptyToNull = (value: FormDataEntryValue | null) => value ? String(value) : null;

export async function createMissionAction(_state: MissionActionState, formData: FormData): Promise<MissionActionState> {
  const parsed = z.object({ brandPharmacyId: uuid, missionType: z.enum(missionTypes), title: z.string().trim().min(3).max(180), objective: z.string().trim().min(3).max(2000), briefing: z.string().trim().max(10000).optional(), assignedUserId: z.union([uuid,z.literal("")]).optional(), scheduledStartAt: z.string().optional(), scheduledEndAt: z.string().optional(), priority: z.enum(["low","normal","high","urgent"]), locationMode: z.enum(["in_pharmacy","remote","hybrid","external_event"]), costEstimatedHt: z.coerce.number().min(0), providerCostHt: z.coerce.number().min(0) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Les informations de mission sont invalides." };
  const { supabase, brand } = await requireActiveBrand();
  const productIds = formData.getAll("productId").map(String).filter(Boolean);
  const { data, error } = await supabase.rpc("create_mission", { target_brand_pharmacy_id: parsed.data.brandPharmacyId, mission_payload: { mission_type: parsed.data.missionType, status: parsed.data.assignedUserId ? "assigned" : "draft", title: parsed.data.title, objective: parsed.data.objective, briefing: parsed.data.briefing || null, assigned_user_id: parsed.data.assignedUserId || null, scheduled_start_at: parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt).toISOString() : null, scheduled_end_at: parsed.data.scheduledEndAt ? new Date(parsed.data.scheduledEndAt).toISOString() : null, priority: parsed.data.priority, location_mode: parsed.data.locationMode, cost_estimated_ht: parsed.data.costEstimatedHt, provider_cost_ht: parsed.data.providerCostHt }, product_payload: productIds.map((product_id) => ({ product_id, objective_type: "other" })) });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/missions");
  redirect(`/dashboard/missions/${data}?brand=${brand.id}`);
}

export async function changeMissionStatusAction(_state: MissionActionState, formData: FormData): Promise<MissionActionState> {
  const parsed = z.object({ missionId: uuid, status: z.enum(missionStatuses), reason: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Transition invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("change_mission_status", { target_mission_id: parsed.data.missionId, target_status: parsed.data.status, reason: parsed.data.reason || null });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/missions/${parsed.data.missionId}`); revalidatePath("/dashboard/field");
  return { success: "Statut mis à jour." };
}

export async function saveReportAction(_state: MissionActionState, formData: FormData): Promise<MissionActionState> {
  const parsed = z.object({ missionId: uuid, reportStatus: z.enum(["draft","submitted"]), summary: z.string().trim().max(10000).optional(), missionType: z.enum(missionTypes) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Compte rendu invalide." };
  const number = (name: string) => formData.get(name) === "" || formData.get(name) === null ? null : Number(formData.get(name));
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.rpc("save_mission_report", { target_mission_id: parsed.data.missionId, report_payload: { report_status: parsed.data.reportStatus, summary: parsed.data.summary || null, pharmacy_feedback: emptyToNull(formData.get("pharmacyFeedback")), opportunities: emptyToNull(formData.get("opportunities")), recommended_next_action: emptyToNull(formData.get("recommendedNextAction")), units_sold: number("unitsSold"), duration_minutes: number("durationMinutes"), customer_contacts: number("customerContacts"), net_sales_ttc: number("netSalesTtc"), participant_count: number("participantCount"), knowledge_before: number("knowledgeBefore"), knowledge_after: number("knowledgeAfter"), satisfaction_score: number("satisfactionScore"), contact_met: emptyToNull(formData.get("contactMet")), meeting_outcome: emptyToNull(formData.get("meetingOutcome")), order_expected: formData.get("orderExpected") === "on", estimated_order_amount_ht: number("estimatedOrderAmountHt") } });
  if (error) return { error: error.message };
  if (parsed.data.reportStatus === "submitted") {
    const { data: mission } = await supabase.from("missions").select("pharmacy_id").eq("id", parsed.data.missionId).maybeSingle();
    await supabase.rpc("track_product_event", {
      target_event: "report_submitted",
      target_brand_id: brand.id,
      target_pharmacy_id: mission?.pharmacy_id ?? null,
      target_source: "mission_report",
      target_metadata: { mission_id: parsed.data.missionId },
    });
  }
  revalidatePath(`/dashboard/missions/${parsed.data.missionId}`); revalidatePath("/dashboard/reports");
  return { success: parsed.data.reportStatus === "submitted" ? "Rapport soumis pour validation." : "Brouillon enregistré." };
}

export async function reviewReportAction(formData: FormData) {
  const parsed = z.object({ reportId: uuid, missionId: uuid, status: z.enum(["validated","needs_correction","rejected"]), reason: z.string().trim().max(1000).optional() }).parse(Object.fromEntries(formData));
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("review_mission_report", { target_report_id: parsed.reportId, target_status: parsed.status, reason: parsed.reason || null });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/reports"); revalidatePath(`/dashboard/missions/${parsed.missionId}`);
}

export async function uploadMissionAttachmentAction(formData: FormData) {
  const missionId = uuid.parse(formData.get("missionId"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10_485_760 || !["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)) throw new Error("Fichier refusé : JPG, PNG, WebP ou PDF, 10 Mo maximum.");
  const { supabase, userId, brand } = await requireActiveBrand();
  const objectPath = safeObjectName(brand.id, missionId, file.name);
  const { error: storageError } = await supabase.storage.from("mission-evidence").upload(objectPath, file, { contentType: file.type, upsert: false });
  if (storageError) throw new Error(storageError.message);
  const { error } = await supabase.from("mission_attachments").insert({ mission_id: missionId, brand_id: brand.id, object_path: objectPath, original_name: file.name.slice(0,255), mime_type: file.type, size_bytes: file.size, uploaded_by: userId, visibility: formData.get("visibility") || "shared" });
  if (error) { await supabase.storage.from("mission-evidence").remove([objectPath]); throw new Error(error.message); }
  revalidatePath(`/dashboard/missions/${missionId}`);
}
