"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";

export type AccessRequestActionState = { error?: string; success?: string };

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  targetBrandId: z.string().uuid(),
  reviewerNote: z.string().trim().max(500).optional(),
  pharmacyIds: z.array(z.string().uuid()).max(50),
});

const rejectionSchema = z.object({
  requestId: z.string().uuid(),
  reviewerNote: z.string().trim().min(3, "Indiquez un motif de refus.").max(500),
});

export async function approveAccessRequestAction(
  _state: AccessRequestActionState,
  formData: FormData,
): Promise<AccessRequestActionState> {
  const parsed = reviewSchema.safeParse({
    requestId: formData.get("requestId"),
    targetBrandId: formData.get("targetBrandId"),
    reviewerNote: formData.get("reviewerNote") || undefined,
    pharmacyIds: formData.getAll("pharmacyIds"),
  });
  if (!parsed.success) return { error: "Les paramètres d’activation sont invalides." };

  try {
    const { supabase } = await requirePlatformAdmin();
    const { error } = await supabase.rpc("approve_access_request", {
      target_request_id: parsed.data.requestId,
      target_brand_id: parsed.data.targetBrandId,
      selected_brand_pharmacy_ids: parsed.data.pharmacyIds,
      review_note: parsed.data.reviewerNote ?? null,
    });
    if (error) return { error: error.message };

    revalidateAccessRequestPaths();
    return { success: "Accès activé. L’utilisateur peut maintenant se connecter à son espace." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "L’accès n’a pas pu être activé." };
  }
}

export async function rejectAccessRequestAction(
  _state: AccessRequestActionState,
  formData: FormData,
): Promise<AccessRequestActionState> {
  const parsed = rejectionSchema.safeParse({
    requestId: formData.get("requestId"),
    reviewerNote: formData.get("reviewerNote"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Le refus est invalide." };

  try {
    const { supabase, userId } = await requirePlatformAdmin();
    const { data, error } = await supabase.from("access_requests").update({
      status: "rejected",
      reviewer_note: parsed.data.reviewerNote,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", parsed.data.requestId).eq("status", "pending").select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Cette demande a déjà été traitée ou n’existe plus." };

    revalidateAccessRequestPaths();
    return { success: "Demande refusée et historisée." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "La demande n’a pas pu être refusée." };
  }
}

function revalidateAccessRequestPaths() {
  revalidatePath("/dashboard/admin/access-requests");
  revalidatePath("/dashboard/admin/users");
  revalidatePath("/dashboard");
}
