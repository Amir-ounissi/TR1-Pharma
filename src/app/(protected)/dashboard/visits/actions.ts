"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompletedOnboarding } from "@/lib/auth";
import { parisLocalToIso } from "@/lib/agenda";

export type VisitCloseoutActionState = {
  error?: string;
  success?: string;
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

    revalidatePath(`/dashboard/visits/${parsed.visitId}`);
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/agent");
    revalidatePath("/dashboard/pharmacies");
    return {
      success: nextVisitAt
        ? "Visite clôturée et prochaine visite ajoutée à l’Agenda."
        : "Visite clôturée.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de clôturer la visite.",
    };
  }
}
