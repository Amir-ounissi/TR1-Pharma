"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

export type CommercialActionState = { error?: string; success?: string };

const uuid = z.string().uuid();
const taskTypes = ["call", "email", "visit", "appointment", "send_offer", "follow_up", "qualify", "update_contact", "check_stock", "request_order", "internal_review", "other"] as const;
const statuses = ["targeted", "qualified", "contacted", "appointment_scheduled", "offer_sent", "pending_order", "implanted", "active", "to_develop", "dormant", "lost"] as const;

export async function createTaskAction(_state: CommercialActionState, formData: FormData): Promise<CommercialActionState> {
  const parsed = z.object({
    brandPharmacyId: uuid, taskType: z.enum(taskTypes), title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(2000).optional(), priority: z.enum(["low", "normal", "high", "urgent"]),
    dueAt: z.string().optional(), assignedTo: uuid,
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "La tâche est invalide." };
  const { supabase, brand, userId } = await requireActiveBrand();
  const { error } = await supabase.from("tasks").insert({
    brand_id: brand.id, brand_pharmacy_id: parsed.data.brandPharmacyId, task_type: parsed.data.taskType,
    title: parsed.data.title, description: parsed.data.description || null, priority: parsed.data.priority,
    due_at: parsed.data.dueAt || null, assigned_to: parsed.data.assignedTo, created_by: userId, source: "manual",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/pharmacies/${parsed.data.brandPharmacyId}`);
  return { success: "Tâche créée et prochaine action recalculée." };
}

export async function createInteractionAction(_state: CommercialActionState, formData: FormData): Promise<CommercialActionState> {
  const parsed = z.object({
    brandPharmacyId: uuid, interactionType: z.enum(["call", "email", "visit", "video_call", "message", "linkedin", "event", "internal_note", "other"]),
    outcome: z.enum(["no_answer", "callback_requested", "information_sent", "appointment_booked", "offer_requested", "offer_sent", "interested", "not_interested", "decision_pending", "order_expected", "completed", "other"]),
    subject: z.string().trim().min(2).max(180), notes: z.string().trim().max(4000).optional(),
    visibility: z.enum(["shared", "tr1_internal", "brand_internal"]), contactId: z.union([uuid, z.literal("")]).optional(),
    occurredAt: z.string().min(1), nextTaskType: z.union([z.enum(taskTypes), z.literal("")]).optional(),
    nextTaskAt: z.string().optional(), nextTaskOwner: z.union([uuid, z.literal("")]).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "L’interaction est invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("create_commercial_interaction", {
    target_brand_pharmacy_id: parsed.data.brandPharmacyId, target_interaction_type: parsed.data.interactionType,
    target_outcome: parsed.data.outcome, target_subject: parsed.data.subject, target_notes: parsed.data.notes || null,
    target_visibility: parsed.data.visibility, target_contact_id: parsed.data.contactId || null,
    target_occurred_at: new Date(parsed.data.occurredAt).toISOString(), target_duration_minutes: null,
    next_task_type: parsed.data.nextTaskType || null, next_task_at: parsed.data.nextTaskAt ? new Date(parsed.data.nextTaskAt).toISOString() : null,
    next_task_owner: parsed.data.nextTaskOwner || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/pharmacies/${parsed.data.brandPharmacyId}`);
  return { success: "Interaction enregistrée." };
}

export async function changeStatusAction(_state: CommercialActionState, formData: FormData): Promise<CommercialActionState> {
  const parsed = z.object({ brandPharmacyId: uuid, status: z.enum(statuses), reason: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Transition invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("change_brand_pharmacy_status", { target_brand_pharmacy_id: parsed.data.brandPharmacyId, target_status: parsed.data.status, reason: parsed.data.reason || null });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/pharmacies/${parsed.data.brandPharmacyId}`);
  return { success: "Statut modifié et historique créé." };
}

export async function assignAccountAction(_state: CommercialActionState, formData: FormData): Promise<CommercialActionState> {
  const parsed = z.object({ brandPharmacyId: uuid, userId: uuid, assignmentType: z.enum(["commercial_agent", "tr1_manager", "brand_manager", "temporary_backup"]), reason: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Affectation invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("assign_brand_pharmacy", { target_brand_pharmacy_id: parsed.data.brandPharmacyId, target_user_id: parsed.data.userId, target_assignment_type: parsed.data.assignmentType, target_is_primary: true, reason: parsed.data.reason || null });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/pipeline");
  revalidatePath(`/dashboard/pharmacies/${parsed.data.brandPharmacyId}`);
  return { success: "Compte réattribué, ancien responsable clôturé." };
}

export async function updateTaskAction(formData: FormData) {
  const parsed = z.object({ id: uuid, status: z.enum(["open", "in_progress", "completed", "cancelled"]), cancellationReason: z.string().trim().max(500).optional() }).parse(Object.fromEntries(formData));
  const { supabase, brand } = await requireActiveBrand();
  const { data: task } = await supabase.from("tasks").select("brand_pharmacy_id").eq("id", parsed.id).eq("brand_id", brand.id).maybeSingle();
  const { error } = await supabase.from("tasks").update({ status: parsed.status, cancellation_reason: parsed.cancellationReason || null }).eq("id", parsed.id).eq("brand_id", brand.id);
  if (error) throw new Error(error.message);
  if (parsed.status === "completed" && task?.brand_pharmacy_id) {
    const { data: relation } = await supabase.from("brand_pharmacies").select("pharmacy_id").eq("id", task.brand_pharmacy_id).maybeSingle();
    await supabase.rpc("track_product_event", {
      target_event: "task_completed",
      target_brand_id: brand.id,
      target_pharmacy_id: relation?.pharmacy_id ?? null,
      target_source: "tasks",
      target_metadata: { task_id: parsed.id },
    });
  }
  revalidatePath("/dashboard/tasks");
}

export async function updateBrandSettingsAction(_state: CommercialActionState, formData: FormData): Promise<CommercialActionState> {
  const parsed = z.object({ defaultDelay: z.coerce.number().int().min(1).max(365), offerDelay: z.coerce.number().int().min(1).max(365), pendingDelay: z.coerce.number().int().min(1).max(365), appointmentHours: z.coerce.number().int().min(1).max(720), activeMaxDays: z.coerce.number().int().min(0), watchStartDays: z.coerce.number().int().min(1), atRiskStartDays: z.coerce.number().int().min(1), dormantStartDays: z.coerce.number().int().min(1), postImplantationDays: z.coerce.number().int().min(1).max(365), expectedReorderDays: z.coerce.number().int().min(1).max(365), dormantFollowUpDays: z.coerce.number().int().min(1).max(365), requireNextAction: z.boolean(), agentsChangeStatus: z.boolean(), agentsCreateContacts: z.boolean(), agentsEditPotential: z.boolean(), automaticActivity: z.boolean() }).safeParse({
    defaultDelay: formData.get("defaultDelay"), offerDelay: formData.get("offerDelay"), pendingDelay: formData.get("pendingDelay"), appointmentHours: formData.get("appointmentHours"),
    activeMaxDays: formData.get("activeMaxDays"), watchStartDays: formData.get("watchStartDays"), atRiskStartDays: formData.get("atRiskStartDays"), dormantStartDays: formData.get("dormantStartDays"), postImplantationDays: formData.get("postImplantationDays"), expectedReorderDays: formData.get("expectedReorderDays"), dormantFollowUpDays: formData.get("dormantFollowUpDays"),
    requireNextAction: formData.get("requireNextAction") === "on", agentsChangeStatus: formData.get("agentsChangeStatus") === "on", agentsCreateContacts: formData.get("agentsCreateContacts") === "on", agentsEditPotential: formData.get("agentsEditPotential") === "on", automaticActivity: formData.get("automaticActivity") === "on",
  });
  if (!parsed.success) return { error: "Paramètres invalides." };
  if (!(parsed.data.activeMaxDays < parsed.data.watchStartDays && parsed.data.watchStartDays < parsed.data.atRiskStartDays && parsed.data.atRiskStartDays < parsed.data.dormantStartDays)) return { error: "Les seuils d’activité doivent être strictement croissants." };
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.from("brand_settings").update({ default_follow_up_delay_days: parsed.data.defaultDelay, offer_follow_up_delay_days: parsed.data.offerDelay, pending_order_follow_up_delay_days: parsed.data.pendingDelay, appointment_reminder_delay_hours: parsed.data.appointmentHours, active_max_days: parsed.data.activeMaxDays, watch_start_days: parsed.data.watchStartDays, at_risk_start_days: parsed.data.atRiskStartDays, dormant_start_days: parsed.data.dormantStartDays, post_implantation_follow_up_days: parsed.data.postImplantationDays, expected_first_reorder_days: parsed.data.expectedReorderDays, dormant_reactivation_follow_up_days: parsed.data.dormantFollowUpDays, automatic_activity_status_enabled: parsed.data.automaticActivity, require_next_action: parsed.data.requireNextAction, allow_agents_to_change_status: parsed.data.agentsChangeStatus, allow_agents_to_create_contacts: parsed.data.agentsCreateContacts, allow_agents_to_edit_potential: parsed.data.agentsEditPotential }).eq("brand_id", brand.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/pipeline");
  return { success: "Paramètres commerciaux enregistrés." };
}
