"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { syncHubSpotNoteAfterPersistence } from "@/lib/integrations/hubspot/runtime";
import { buildVisitNoteSubject, canEditVisitNote } from "@/lib/visit-note-editing";

const uuid = z.string().uuid();
const allowedTags = [
  "order",
  "merchandising",
  "stockout",
  "competitor",
  "callback",
  "problem",
] as const;

export type UpdateVisitNoteResult = {
  success?: string;
  error?: string;
};

export async function updateOpenVisitNoteAction(
  formData: FormData,
): Promise<UpdateVisitNoteResult> {
  try {
    const parsed = z.object({
      brandPharmacyId: uuid,
      interactionId: uuid,
      notes: z.string().trim().max(4000),
    }).parse({
      brandPharmacyId: formData.get("brandPharmacyId"),
      interactionId: formData.get("interactionId"),
      notes: formData.get("notes") || "",
    });
    const tags = formData
      .getAll("tags")
      .map(String)
      .filter((tag): tag is (typeof allowedTags)[number] =>
        allowedTags.includes(tag as (typeof allowedTags)[number]),
      );

    const { supabase, brand, userId } = await requireActiveBrand();
    const { data: relation, error: relationError } = await supabase
      .from("brand_pharmacies")
      .select("id,pharmacy_id")
      .eq("id", parsed.brandPharmacyId)
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .maybeSingle();
    if (relationError) throw relationError;
    if (!relation) throw new Error("Pharmacie indisponible.");

    const { data: interaction, error: interactionError } = await supabase
      .from("interactions")
      .select("id,field_visit_id,created_by,interaction_type,subject,notes,tags")
      .eq("id", parsed.interactionId)
      .eq("brand_id", brand.id)
      .eq("brand_pharmacy_id", parsed.brandPharmacyId)
      .is("archived_at", null)
      .maybeSingle();
    if (interactionError) throw interactionError;
    if (!interaction || interaction.interaction_type !== "internal_note" || !interaction.field_visit_id) {
      throw new Error("Cette note n’est pas modifiable.");
    }

    const { data: visit, error: visitError } = await supabase
      .from("field_visits")
      .select("id,status,owner_user_id,pharmacy_id")
      .eq("id", interaction.field_visit_id)
      .eq("pharmacy_id", relation.pharmacy_id)
      .is("archived_at", null)
      .maybeSingle();
    if (visitError) throw visitError;
    if (!visit || !canEditVisitNote({
      visitStatus: visit.status,
      visitOwnerUserId: visit.owner_user_id,
      noteCreatedBy: interaction.created_by,
      userId,
    })) {
      throw new Error("La visite est clôturée : cette note ne peut plus être modifiée.");
    }

    const original = {
      subject: interaction.subject,
      notes: interaction.notes,
      tags: interaction.tags,
    };
    const { error: updateError } = await supabase
      .from("interactions")
      .update({
        subject: buildVisitNoteSubject(tags),
        notes: parsed.notes || null,
        tags,
      })
      .eq("id", parsed.interactionId)
      .eq("created_by", userId);
    if (updateError) throw updateError;

    const { data: verifiedVisit, error: verifyError } = await supabase
      .from("field_visits")
      .select("status,owner_user_id")
      .eq("id", interaction.field_visit_id)
      .maybeSingle();
    if (verifyError) throw verifyError;
    if (!verifiedVisit || verifiedVisit.status !== "in_progress" || verifiedVisit.owner_user_id !== userId) {
      await supabase
        .from("interactions")
        .update(original)
        .eq("id", parsed.interactionId)
        .eq("created_by", userId);
      throw new Error("La visite vient d’être clôturée : la modification n’a pas été conservée.");
    }

    await syncHubSpotNoteAfterPersistence(brand.id, parsed.interactionId);
    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}/notes`);
    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}`);
    return { success: "Note mise à jour." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de modifier la note.",
    };
  }
}
