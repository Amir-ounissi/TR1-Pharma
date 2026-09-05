"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parisLocalToIso } from "@/lib/agenda";
import { requireCompletedOnboarding } from "@/lib/auth";

export type FacilitatorAnimationState = {
  error?: string;
  success?: string;
  created?: number;
};

const uuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);

const animationRowSchema = z.object({
  brandPharmacyId: uuid,
  scheduledStartAt: z.string().min(16),
  scheduledEndAt: z.string().min(16),
});

const animationBatchSchema = z.array(animationRowSchema).min(1).max(30);

export async function proposeAnimationBatchAction(
  _state: FacilitatorAnimationState,
  formData: FormData,
): Promise<FacilitatorAnimationState> {
  const raw = formData.get("animationsJson");
  if (typeof raw !== "string") {
    return { error: "Ajoutez au moins une animation." };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { error: "Le planning d’animations est invalide." };
  }

  const parsed = animationBatchSchema.safeParse(decoded);
  if (!parsed.success) {
    return { error: "Vérifiez la pharmacie, la date et les horaires de chaque animation." };
  }

  const payload: Array<{
    brand_pharmacy_id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
  }> = [];

  try {
    for (const row of parsed.data) {
      const start = parisLocalToIso(row.scheduledStartAt);
      const end = parisLocalToIso(row.scheduledEndAt);
      if (new Date(end).getTime() <= new Date(start).getTime()) {
        return { error: "L’heure de fin doit être après l’heure de début." };
      }
      payload.push({
        brand_pharmacy_id: row.brandPharmacyId,
        scheduled_start_at: start,
        scheduled_end_at: end,
      });
    }
  } catch {
    return { error: "Une date ou un horaire est invalide." };
  }

  const { supabase } = await requireCompletedOnboarding();
  const { data, error } = await supabase.rpc("propose_animation_batch", {
    animation_payload: payload,
  });

  if (error) {
    if (error.code === "42501") {
      return { error: "Une pharmacie ou une marque n’est plus disponible pour votre compte." };
    }
    return { error: error.message };
  }

  const created = Array.isArray(data) ? data.length : payload.length;
  revalidatePath("/dashboard/field");
  revalidatePath("/dashboard/missions");
  revalidatePath("/dashboard/agenda");

  return {
    success:
      created > 1
        ? `${created} animations envoyées aux marques pour validation.`
        : "Animation envoyée à la marque pour validation.",
    created,
  };
}
