"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { safeObjectName } from "@/lib/missions";

const uuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);

const evidenceKinds = [
  "general",
  "merch_plan",
  "merch_before",
  "merch_after",
  "merch_detail",
  "merch_plv",
  "cash_register",
] as const;

const imageEvidenceKinds = new Set([
  "merch_plan",
  "merch_before",
  "merch_after",
  "merch_detail",
  "merch_plv",
]);

export async function uploadQualifiedMissionAttachmentAction(formData: FormData) {
  const parsed = z
    .object({
      missionId: uuid,
      visibility: z.enum(["shared", "tr1_internal", "provider_private"]),
      evidenceKind: z.enum(evidenceKinds),
    })
    .parse(Object.fromEntries(formData));

  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10_485_760 ||
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)
  ) {
    throw new Error("Fichier refusé : JPG, PNG, WebP ou PDF, 10 Mo maximum.");
  }

  if (imageEvidenceKinds.has(parsed.data.evidenceKind) && file.type === "application/pdf") {
    throw new Error("Une preuve merchandising doit être une photo JPG, PNG ou WebP.");
  }

  const { supabase, userId, brand } = await requireActiveBrand();
  const objectPath = safeObjectName(brand.id, parsed.data.missionId, file.name);

  const { error: storageError } = await supabase.storage
    .from("mission-evidence")
    .upload(objectPath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase.from("mission_attachments").insert({
    mission_id: parsed.data.missionId,
    brand_id: brand.id,
    object_path: objectPath,
    original_name: file.name.slice(0, 255),
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: userId,
    visibility: parsed.data.visibility,
    evidence_kind:
      parsed.data.evidenceKind === "general" ? null : parsed.data.evidenceKind,
  });

  if (error) {
    await supabase.storage.from("mission-evidence").remove([objectPath]);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/missions/${parsed.data.missionId}`);
}
