"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { safeObjectName } from "@/lib/missions";

export type AnimationInvoiceActionState = {
  error?: string;
  success?: string;
};

const uuid = z.string().uuid();

export async function submitAnimationInvoiceAction(
  _state: AnimationInvoiceActionState,
  formData: FormData,
): Promise<AnimationInvoiceActionState> {
  const parsed = z.object({
    missionId: uuid,
    invoiceNumber: z.string().trim().min(1).max(100),
    amountHt: z.coerce.number().min(0).max(1_000_000),
    vatAmount: z.coerce.number().min(0).max(1_000_000),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Vérifiez le numéro et les montants de la facture." };
  }

  const file = formData.get("invoiceFile");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10_485_760 ||
    file.type !== "application/pdf"
  ) {
    return { error: "Ajoutez la facture au format PDF, 10 Mo maximum." };
  }

  const { supabase, brand, userId } = await requireActiveBrand();
  const objectPath = safeObjectName(
    brand.id,
    parsed.data.missionId,
    `facture-${parsed.data.invoiceNumber}-${file.name}`,
  );

  const { error: storageError } = await supabase.storage
    .from("mission-evidence")
    .upload(objectPath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (storageError) return { error: storageError.message };

  const { data: attachment, error: attachmentError } = await supabase
    .from("mission_attachments")
    .insert({
      mission_id: parsed.data.missionId,
      brand_id: brand.id,
      object_path: objectPath,
      original_name: file.name.slice(0, 255),
      mime_type: "application/pdf",
      size_bytes: file.size,
      uploaded_by: userId,
      visibility: "shared",
      evidence_kind: "invoice",
    })
    .select("id")
    .single();

  if (attachmentError || !attachment) {
    await supabase.storage.from("mission-evidence").remove([objectPath]);
    return { error: attachmentError?.message ?? "Impossible d’enregistrer la facture." };
  }

  const { error } = await supabase.rpc("submit_animation_invoice", {
    target_mission_id: parsed.data.missionId,
    target_attachment_id: attachment.id,
    target_invoice_number: parsed.data.invoiceNumber,
    target_amount_ht: parsed.data.amountHt,
    target_vat_amount: parsed.data.vatAmount,
  });

  if (error) {
    await supabase.from("mission_attachments").delete().eq("id", attachment.id);
    await supabase.storage.from("mission-evidence").remove([objectPath]);
    return { error: error.message };
  }

  revalidatePath(`/dashboard/missions/${parsed.data.missionId}`);
  revalidatePath("/dashboard/missions");
  revalidatePath("/dashboard/field");

  return { success: "Facture transmise pour validation." };
}

export async function reviewAnimationInvoiceAction(
  _state: AnimationInvoiceActionState,
  formData: FormData,
): Promise<AnimationInvoiceActionState> {
  const parsed = z.object({
    missionId: uuid,
    invoiceId: uuid,
    decision: z.enum(["approved", "rejected"]),
    reviewNote: z.string().trim().max(2000).optional(),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: "Décision de facture invalide." };
  if (parsed.data.decision === "rejected" && !parsed.data.reviewNote) {
    return { error: "Précisez la raison du refus." };
  }

  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("review_animation_invoice", {
    target_invoice_id: parsed.data.invoiceId,
    target_decision: parsed.data.decision,
    target_review_note: parsed.data.reviewNote || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/missions/${parsed.data.missionId}`);
  revalidatePath("/dashboard/missions");
  revalidatePath("/dashboard/field");

  return {
    success:
      parsed.data.decision === "approved"
        ? "Facture validée."
        : "Facture refusée et renvoyée à l’animateur.",
  };
}

export async function markAnimationInvoicePaidAction(
  _state: AnimationInvoiceActionState,
  formData: FormData,
): Promise<AnimationInvoiceActionState> {
  const parsed = z.object({
    missionId: uuid,
    invoiceId: uuid,
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: "Facture invalide." };

  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("mark_animation_invoice_paid", {
    target_invoice_id: parsed.data.invoiceId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/missions/${parsed.data.missionId}`);
  revalidatePath("/dashboard/missions");
  revalidatePath("/dashboard/field");

  return { success: "Paiement enregistré." };
}
