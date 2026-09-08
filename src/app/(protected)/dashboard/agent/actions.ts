"use server";

import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { hasValidNoNextActionReason } from "@/lib/agent-experience";

export type QuickInteractionState = { error?: string; success?: string };

const databaseUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const interactionTypes = ["call", "email", "visit", "video_call", "message", "other"] as const;
const interactionOutcomes = ["no_answer", "callback_requested", "information_sent", "appointment_booked", "offer_requested", "offer_sent", "interested", "not_interested", "decision_pending", "order_expected", "completed", "other"] as const;
const taskTypes = ["call", "email", "visit", "appointment", "send_offer", "follow_up", "qualify", "update_contact", "check_stock", "request_order", "other"] as const;
const events = [
  "agent_dashboard_viewed", "pharmacy_opened", "navigation_waze_clicked",
  "navigation_maps_clicked", "interaction_started", "interaction_submitted",
  "next_action_created", "task_completed", "mission_opened", "report_started",
  "report_submitted",
] as const;

const quickInteractionSchema = z.object({
  brandPharmacyId: databaseUuid,
  pharmacyId: databaseUuid,
  interactionType: z.enum(interactionTypes),
  outcome: z.enum(interactionOutcomes),
  note: z.string().trim().min(2).max(1000),
  nextTaskType: z.enum(taskTypes).optional(),
  nextTaskAt: z.string().optional(),
  noNextAction: z.string().optional(),
  noNextReason: z.string().trim().max(500).optional(),
  visitStartedAt: z.string().datetime().optional(),
  occurredAt: z.string().datetime().optional(),
  durationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
});

export async function trackProductEventAction(eventName: string, pharmacyId?: string) {
  const parsed = z.object({
    eventName: z.enum(events),
    pharmacyId: databaseUuid.optional(),
  }).safeParse({ eventName, pharmacyId });
  if (!parsed.success) return;
  const { supabase, brand } = await requireActiveBrand();
  await supabase.rpc("track_product_event", {
    target_event: parsed.data.eventName,
    target_brand_id: brand.id,
    target_pharmacy_id: parsed.data.pharmacyId ?? null,
    target_source: "agent_day",
    target_metadata: {},
  });
}

export async function quickInteractionAction(
  _state: QuickInteractionState,
  formData: FormData,
): Promise<QuickInteractionState> {
  const parsed = quickInteractionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez les champs de l’interaction." };

  const noNextAction = parsed.data.noNextAction === "on";
  if (!hasValidNoNextActionReason(noNextAction, parsed.data.noNextReason ?? "")) {
    return { error: "Justifiez l’absence de prochaine action (10 caractères minimum)." };
  }
  if (!noNextAction && (!parsed.data.nextTaskType || !parsed.data.nextTaskAt)) {
    return { error: "Choisissez une prochaine action et sa date." };
  }

  const { supabase, brand, userId } = await requireActiveBrand();
  const occurredAt = parsed.data.occurredAt
    ? new Date(parsed.data.occurredAt)
    : parsed.data.visitStartedAt
      ? new Date(parsed.data.visitStartedAt)
      : new Date();
  const durationMinutes = parsed.data.durationMinutes ?? (parsed.data.visitStartedAt
    ? Math.max(1, Math.min(1440, Math.round((Date.now() - new Date(parsed.data.visitStartedAt).getTime()) / 60_000)))
    : null);
  const note = noNextAction
    ? `${parsed.data.note}\n\nAucune prochaine action : ${parsed.data.noNextReason}`
    : parsed.data.note;
  const { error } = await supabase.rpc("create_commercial_interaction", {
    target_brand_pharmacy_id: parsed.data.brandPharmacyId,
    target_interaction_type: parsed.data.interactionType,
    target_outcome: parsed.data.outcome,
    target_subject: `Compte rendu ${parsed.data.interactionType}`,
    target_notes: note,
    target_visibility: "shared",
    target_contact_id: null,
    target_occurred_at: occurredAt.toISOString(),
    target_duration_minutes: durationMinutes,
    next_task_type: noNextAction ? null : parsed.data.nextTaskType,
    next_task_at: noNextAction ? null : new Date(parsed.data.nextTaskAt!).toISOString(),
    next_task_owner: noNextAction ? null : userId,
  });
  if (error) return { error: error.message };

  await supabase.rpc("track_product_event", {
    target_event: "interaction_submitted",
    target_brand_id: brand.id,
    target_pharmacy_id: parsed.data.pharmacyId,
    target_source: "agent_day",
    target_metadata: { interaction_type: parsed.data.interactionType, outcome: parsed.data.outcome },
  });
  if (!noNextAction) {
    await supabase.rpc("track_product_event", {
      target_event: "next_action_created",
      target_brand_id: brand.id,
      target_pharmacy_id: parsed.data.pharmacyId,
      target_source: "agent_day",
      target_metadata: { task_type: parsed.data.nextTaskType },
    });
  }
  return {
    success: noNextAction
      ? "Interaction enregistrée. Aucune prochaine action planifiée."
      : "Interaction et prochaine action enregistrées.",
  };
}

export async function syncOfflineInteractionAction(
  payload: Record<string, string | number | boolean | null>,
): Promise<QuickInteractionState> {
  const identity = z.object({
    brandPharmacyId: databaseUuid,
    interactionType: z.enum(interactionTypes),
    occurredAt: z.string().datetime(),
  }).safeParse(payload);
  if (!identity.success) return { error: "Compte rendu hors ligne invalide." };

  const { supabase, brand, userId } = await requireActiveBrand();
  const { data: existing, error: lookupError } = await supabase
    .from("interactions")
    .select("id")
    .eq("brand_id", brand.id)
    .eq("brand_pharmacy_id", identity.data.brandPharmacyId)
    .eq("created_by", userId)
    .eq("interaction_type", identity.data.interactionType)
    .eq("occurred_at", identity.data.occurredAt)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (existing) return { success: "Compte rendu déjà synchronisé." };

  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined && key !== "noNextAction") {
      formData.set(key, String(value));
    }
  }
  if (payload.noNextAction === true) formData.set("noNextAction", "on");
  return quickInteractionAction({}, formData);
}
