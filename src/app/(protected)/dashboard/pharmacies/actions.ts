"use server";

import { requireActiveBrand } from "@/lib/auth";
import { loadPharmacySummary } from "@/lib/pharmacy-summary";

export async function loadPharmacySummaryAction(brandPharmacyId: string) {
  try {
    const { supabase } = await requireActiveBrand();
    const summary = await loadPharmacySummary(supabase as never, brandPharmacyId);

    return {
      summary,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Une erreur inconnue est survenue.";

    if (message === "forbidden") {
      return {
        summary: null,
        error: "Cette pharmacie n’est pas accessible dans votre périmètre actuel.",
      };
    }

    return {
      summary: null,
      error: "Le résumé pharmacie est indisponible pour le moment.",
    };
  }
}
