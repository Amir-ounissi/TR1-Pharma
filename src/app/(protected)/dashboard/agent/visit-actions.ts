"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

export type VisitActionState = {
  error?: string;
  success?: string;
};

const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

function safeFileName(name: string) {
  const clean = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-120);
  return clean || "preuve.jpg";
}

export async function startFieldVisitAction(
  _state: VisitActionState,
  formData: FormData,
): Promise<VisitActionState> {
  const parsed = z
    .object({ visitId: uuid, brandId: uuid })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Visite invalide." };

  const { supabase, brand } = await requireActiveBrand();
  if (brand.id !== parsed.data.brandId) {
    return { error: "Cette visite n’appartient pas à la marque active." };
  }

  const { error } = await supabase.rpc("start_field_visit", {
    target_visit_id: parsed.data.visitId,
    target_brand_id: brand.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/agenda");
  return { success: "Visite démarrée." };
}

export async function completeFieldVisitAction(
  _state: VisitActionState,
  formData: FormData,
): Promise<VisitActionState> {
  const parsed = z
    .object({
      visitId: uuid,
      brandId: uuid,
      orderResult: z.enum(["order_taken", "no_order"]),
      photoResult: z.enum(["photo_added", "not_required"]),
      note: z.string().trim().min(2).max(2000),
      nextVisitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error:
        "Pour clôturer : commande, photo, note et date de prochaine visite doivent être renseignées.",
    };
  }

  const { supabase, brand, userId } = await requireActiveBrand();
  if (brand.id !== parsed.data.brandId) {
    return { error: "Cette visite n’appartient pas à la marque active." };
  }

  const file = formData.get("photo");
  let uploadedPath: string | null = null;
  let photoPayload: Record<string, string | number> | null = null;

  if (parsed.data.photoResult === "photo_added") {
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 10_485_760 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      return { error: "Ajoutez une photo JPG, PNG ou WebP de 10 Mo maximum." };
    }

    uploadedPath = `${brand.id}/${parsed.data.visitId}/${userId}/${randomUUID()}-${safeFileName(file.name)}`;
    const { error: storageError } = await supabase.storage
      .from("field-visit-evidence")
      .upload(uploadedPath, file, { contentType: file.type, upsert: false });
    if (storageError) return { error: storageError.message };

    photoPayload = {
      bucket_id: "field-visit-evidence",
      object_path: uploadedPath,
      original_name: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
    };
  }

  const { error } = await supabase.rpc("complete_field_visit", {
    target_visit_id: parsed.data.visitId,
    target_brand_id: brand.id,
    completion_payload: {
      order_result: parsed.data.orderResult,
      photo_result: parsed.data.photoResult,
      note: parsed.data.note,
      next_visit_date: parsed.data.nextVisitDate,
      photo: photoPayload,
    },
  });

  if (error) {
    if (uploadedPath) {
      await supabase.storage.from("field-visit-evidence").remove([uploadedPath]);
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/pharmacies");

  return {
    success:
      "Visite clôturée. Elle compte maintenant dans votre progression et la prochaine visite est planifiée.",
  };
}
