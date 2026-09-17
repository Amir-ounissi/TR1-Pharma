"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";

export type PersonalMonthlyTargetActionState = {
  error?: string;
  success?: string;
};

const formSchema = z.object({
  brandId: z.string().uuid(),
  monthStart: z.string().regex(/^\d{4}-\d{2}-01$/, "Mois invalide."),
  targetValue: z.coerce
    .number()
    .positive("L’objectif doit être supérieur à 0 €.")
    .max(100_000_000, "L’objectif saisi est trop élevé."),
});

export async function savePersonalMonthlyTargetAction(
  _state: PersonalMonthlyTargetActionState,
  formData: FormData,
): Promise<PersonalMonthlyTargetActionState> {
  try {
    const parsed = formSchema.parse(Object.fromEntries(formData));
    const [session, contexts] = await Promise.all([
      requireActiveBrand(),
      getBrandContexts(),
    ]);
    const { supabase, brand, userId } = session;

    if (brand.id !== parsed.brandId) {
      throw new Error("La marque active a changé. Rechargez la page puis réessayez.");
    }

    const canSetPersonalTarget = contexts.some(
      (context) => context.id === parsed.brandId && context.role === "agent",
    );
    if (!canSetPersonalTarget) {
      throw new Error("Cet objectif personnel est réservé à votre espace commercial.");
    }

    const { error } = await supabase
      .from("agent_personal_monthly_targets")
      .upsert(
        {
          brand_id: parsed.brandId,
          user_id: userId,
          month_start: parsed.monthStart,
          revenue_target_ht: parsed.targetValue,
        },
        { onConflict: "brand_id,user_id,month_start" },
      );

    if (error) throw error;

    revalidatePath("/dashboard/agent");
    revalidatePath("/dashboard/agent/performance");
    revalidatePath("/dashboard/agent/settings");

    return { success: "Objectif personnel enregistré." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Objectif invalide." };
    }
    return {
      error: error instanceof Error ? error.message : "Impossible d’enregistrer l’objectif.",
    };
  }
}
