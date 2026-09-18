"use server";

import { z } from "zod";
import { closeFieldVisitAction } from "@/app/(protected)/dashboard/visits/actions";
import { addCalendarDays, isoToParisLocal } from "@/lib/agenda";
import { analyzeVisitCloseNote, type VisitCloseDraft } from "@/lib/assistant/visit-close-ai";
import { requireActiveBrand } from "@/lib/auth";

const uuid = z.string().uuid();
const finishOutcome = z.enum(["very_good", "good", "follow_up", "problem"]);
const nextPreset = z.enum(["none", "week1", "weeks2", "month1", "custom"]);
const noteTag = z.enum(["order", "merchandising", "stockout", "competitor", "callback", "problem"]);
const TAG_OBJECTIVES: Record<string, string> = {
  order: "Suivre la commande",
  merchandising: "Revoir le merchandising",
  stockout: "Contrôler le réassort / la rupture",
  competitor: "Revoir la présence concurrente",
  callback: "Relancer la pharmacie",
  problem: "Résoudre le point signalé",
};


export type VisitCloseAvailability = {
  active: boolean;
  visitId?: string;
  scheduledAt?: string;
  error?: string;
};

export type VisitCloseAnalysisResult = {
  draft?: VisitCloseDraft;
  error?: string;
};

export type VisitCloseCompletionResult = {
  success?: string;
  error?: string;
  warning?: string;
  visitId?: string;
  scheduledAt?: string;
};

async function requireOwnedVisit(brandPharmacyId: string, visitId?: string) {
  const { supabase, brand, userId } = await requireActiveBrand();
  const { data: relation, error: relationError } = await supabase
    .from("brand_pharmacies")
    .select("id,pharmacy_id")
    .eq("id", brandPharmacyId)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (relationError) throw relationError;
  if (!relation) throw new Error("Pharmacie indisponible.");

  let query = supabase
    .from("field_visit_brands")
    .select("visit_id,field_visits!inner(id,status,scheduled_start_at,owner_user_id,pharmacy_id,archived_at)")
    .eq("brand_pharmacy_id", brandPharmacyId)
    .eq("field_visits.owner_user_id", userId)
    .eq("field_visits.pharmacy_id", relation.pharmacy_id)
    .in("field_visits.status", ["planned", "confirmed", "in_progress"])
    .is("field_visits.archived_at", null);
  if (visitId) query = query.eq("visit_id", visitId);

  const { data: links, error } = await query;
  if (error) throw error;
  const visits = (links ?? [])
    .map((link) => Array.isArray(link.field_visits) ? link.field_visits[0] : link.field_visits)
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.scheduled_start_at) - Date.parse(right.scheduled_start_at));
  const visit = visits[0];
  if (!visit) throw new Error("Aucune visite en cours pour cette pharmacie.");
  return visit;
}

export async function getVisitCloseAvailabilityAction(brandPharmacyId: string): Promise<VisitCloseAvailability> {
  try {
    uuid.parse(brandPharmacyId);
    const visit = await requireOwnedVisit(brandPharmacyId);
    return { active: true, visitId: visit.id, scheduledAt: visit.scheduled_start_at };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de charger la visite.";
    if (message === "Aucune visite en cours pour cette pharmacie.") return { active: false };
    return { active: false, error: message };
  }
}

export async function analyzeVisitCloseAction(
  brandPharmacyId: string,
  visitId: string,
  note: string,
): Promise<VisitCloseAnalysisResult> {
  try {
    const parsed = z.object({
      brandPharmacyId: uuid,
      visitId: uuid,
      note: z.string().trim().min(1).max(2_000),
    }).parse({ brandPharmacyId, visitId, note });

    // Authorization and visit state are checked before spending anyexport async function completeVisitWithAssistantAction(input: {
  brandPharmacyId: string;
  visitId: string;
  outcome: "very_good" | "good" | "follow_up" | "problem";
  next: "none" | "week1" | "weeks2" | "month1" | "custom";
  customNext?: string;
  note?: string;
  tags?: string[];
}): Promise<VisitCloseCompletionResult> {
  try {
    const parsed = z.object({
      brandPharmacyId: uuid,
      visitId: uuid,
      outcome: finishOutcome,
      next: nextPreset,
      customNext: z.string().optional(),
      note: z.string().trim().min(2, "Ajoutez un compte rendu court.").max(4_000),
      tags: z.array(noteTag).max(6).optional(),
    }).parse(input);

    await requireOwnedVisit(parsed.brandPharmacyId, parsed.visitId);

    const outcome = parsed.outcome === "follow_up" || parsed.outcome === "problem"
      ? "follow_up"
      : "other";
    let nextVisitAt = "";
    if (parsed.next === "custom") {
      if (!parsed.customNext) throw new Error("Choisissez la prochaine date.");
      nextVisitAt = parsed.customNext;
    } else if (parsed.next !== "none") {
      const days = parsed.next === "week1" ? 7 : parsed.next === "weeks2" ? 14 : 30;
      const local = isoToParisLocal(new Date().toISOString());
      nextVisitAt = `${addCalendarDays(local.slice(0, 10), days)}T09:00`;
    }

    const formData = new FormData();
    formData.set("visitId", parsed.visitId);
    formData.set("outcome", outcome);
    formData.set("summary", parsed.note);
    formData.set("inputMode", "assistant");
    if (nextVisitAt) formData.set("nextVisitAt", nextVisitAt);
    if (parsed.tags?.length) {
      formData.set("nextObjective", parsed.tags.map((tag) => TAG_OBJECTIVES[tag] ?? tag).join(" · "));
    }

    const completion = await closeFieldVisitAction({}, formData);
    if (completion.error) return { error: completion.error };
    return {
      success: completion.success,
      warning: completion.warning,
      visitId: parsed.visitId,
      scheduledAt: nextVisitAt || undefined,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de terminer la visite.",
    };
  }
}
