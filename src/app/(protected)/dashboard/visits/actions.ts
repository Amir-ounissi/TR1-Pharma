"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createQuickNoteAction } from "@/app/(protected)/dashboard/pharmacies/quick-actions";
import { requireCompletedOnboarding } from "@/lib/auth";
import { parisLocalToIso } from "@/lib/agenda";

export type VisitCloseoutActionState = {
  error?: string;
  success?: string;
  warning?: string;
};

const uuid = z.string().uuid();

export async function startFieldVisitAction(
  _state: VisitCloseoutActionState,
  formData: FormData,
): Promise<VisitCloseoutActionState> {
  try {
    const parsed = z.object({ visitId: uuid }).parse(Object.fromEntries(formData));
    const { supabase } = await requireCompletedOnboarding();
    const { error } = await supabase.rpc("start_field_visit", {
      target_visit_id: parsed.visitId,
    });
    if (error) throw error;

    revalidatePath(`/dashboard/visits/${parsed.visitId}`);
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/agent");
    return { success: "Visite démarrée." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de démarrer la visite.",
    };
  }
}

export async function closeFieldVisitAction(
  _state: VisitCloseoutActionState,
  formData: FormData,
): Promise<VisitCloseoutActionState> {
  try {
    const parsed = z.object({
      visitId: uuid,
      outcome: z.enum(["order_taken", "no_order", "follow_up", "information", "other"]),
      summary: z.string().trim().min(2, "Ajoutez un compte rendu court.").max(4000),
      nextVisitAt: z.string().optional(),
      nextObjective: z.string().trim().max(1000).optional(),
      inputMode: z.enum(["manual", "dictation", "assistant"]).default("manual"),
    }).parse(Object.fromEntries(formData));

    const photos = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .slice(0, 3);

    const nextVisitAt = parsed.nextVisitAt?.trim()
      ? parisLocalToIso(parsed.nextVisitAt)
      : null;

    const { supabase } = await requireCompletedOnboarding();
    const { error } = await supabase.rpc("close_field_visit", {
      target_visit_id: parsed.visitId,
      closeout_payload: {
        outcome: parsed.outcome,
        summary: parsed.summary,
        input_mode: parsed.inputMode,
        structured_payload: {},
        next_visit_at: nextVisitAt,
        next_objective: parsed.nextObjective || null,
      },
    });
    if (error) throw error;

    let photoResult: Awaited<ReturnType<typeof createQuickNoteAction>> | null = null;
    let brandPharmacyId: string | null = null;

    if (photos.length > 0) {
      const { data: visitBrand, error: visitBrandError } = await supabase
        .from("field_visit_brands")
        .select("brand_pharmacy_id,is_primary")
        .eq("visit_id", parsed.visitId)
        .not("brand_pharmacy_id", "is", null)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!visitBrandError && visitBrand?.brand_pharmacy_id) {
        brandPharmacyId = visitBrand.brand_pharmacy_id;
        const noteData = new FormData();
        noteData.set("brandPharmacyId", brandPharmacyId);
        noteData.set("fieldVisitId", parsed.visitId);
        noteData.set("notes", parsed.summary);
        photos.forEach((photo) => noteData.append("photos", photo, photo.name));
        photoResult = await createQuickNoteAction(noteData);
      } else {
        photoResult = { error: "Impossible de rattacher les photos à la pharmacie." };
      }
    }

    revalidatePath(`/dashboard/visits/${parsed.visitId}`);
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/agent");
    revalidatePath("/dashboard/agent/closeouts");
    revalidatePath("/dashboard/pharmacies");
    if (brandPharmacyId) {
      revalidatePath(`/dashboard/pharmacies/${brandPharmacyId}`);
      revalidatePath(`/dashboard/pharmacies/${brandPharmacyId}/notes`);
    }

    const success = nextVisitAt
      ? "Visite clôturée et prochaine visite ajoutée à l’Agenda."
      : "Visite clôturée.";

    if (photoResult?.error) {
      return {
        success,
        warning: `La visite est bien clôturée, mais les photos n’ont pas pu être enregistrées : ${photoResult.error}`,
      };
    }

    return {
      success: photoResult?.success ? `${success} ${photoResult.success}` : success,
      warning: photoResult?.warning,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de clôturer la visite.",
    };
  }
}
