"use server";

import { z } from "zod";
import {
  completeVisitAction,
  createQuickNoteAction,
} from "@/app/(protected)/dashboard/pharmacies/quick-actions";
import { analyzeVisitCloseNote, type VisitCloseDraft } from "@/lib/assistant/visit-close-ai";
import { requireActiveBrand } from "@/lib/auth";

const uuid = z.string().uuid();
const finishOutcome = z.enum(["very_good", "good", "follow_up", "problem"]);
const nextPreset = z.enum(["none", "week1", "weeks2", "month1", "custom"]);
const noteTag = z.enum(["order", "merchandising", "stockout", "competitor", "callback", "problem"]);

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
    .eq("field_visits.status", "in_progress")
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

    // Authorization and visit state are checked before spending any AI tokens.
    await requireOwnedVisit(parsed.brandPharmacyId, parsed.visitId);
    const draft = await analyzeVisitCloseNote(parsed.note);
    return { draft };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "TR1 n’a pas pu préparer la clôture.",
    };
  }
}

export async function completeVisitWithAssistantAction(input: {
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
      note: z.string().trim().max(4_000).optional(),
      tags: z.array(noteTag).max(6).optional(),
    }).parse(input);

    const completion = await completeVisitAction(
      parsed.brandPharmacyId,
      parsed.visitId,
      parsed.outcome,
      parsed.next,
      parsed.next === "custom" ? parsed.customNext : undefined,
    );
    if (completion.error) return completion;

    if (parsed.note) {
      const formData = new FormData();
      formData.set("brandPharmacyId", parsed.brandPharmacyId);
      formData.set("fieldVisitId", parsed.visitId);
      formData.set("notes", parsed.note);
      for (const tag of parsed.tags ?? []) formData.append("tags", tag);
      const noteResult = await createQuickNoteAction(formData);
      if (noteResult.error) {
        return {
          ...completion,
          warning: "Visite clôturée, mais le compte rendu n’a pas pu être enregistré.",
        };
      }
    }

    return completion;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de terminer la visite.",
    };
  }
}
