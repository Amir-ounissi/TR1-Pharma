"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { MAX_STOCK_PHOTO_BYTES, stockPhotoSchema } from "@/lib/stock-observations/extraction";

export type StockObservationActionState = { success?: string; error?: string; warning?: string };
const uuid = z.string().uuid();
const qty = z.string().trim().refine((value) => !value || /^\d{1,6}$/.test(value), "Quantité invalide.");

function nullableQuantity(raw: string, maximum: number): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error("Quantité hors limites.");
  return value;
}

export async function saveStockObservationAction(
  _previous: StockObservationActionState,
  form: FormData,
): Promise<StockObservationActionState> {
  try {
    const input = z.object({
      brandPharmacyId: uuid,
      productId: uuid,
      visitId: z.union([uuid, z.literal("")]),
      stockShelf: qty,
      stockBackroom: qty,
      facings: qty,
      notes: z.string().trim().max(2000),
      analysisPayload: z.string().max(32768),
    }).parse({
      brandPharmacyId: form.get("brandPharmacyId"),
      productId: form.get("productId"),
      visitId: form.get("visitId") ?? "",
      stockShelf: form.get("stockShelf") ?? "",
      stockBackroom: form.get("stockBackroom") ?? "",
      facings: form.get("facings") ?? "",
      notes: form.get("notes") ?? "",
      analysisPayload: form.get("analysisPayload") ?? "",
    });
    const shelf = nullableQuantity(input.stockShelf, 100000);
    const backroom = nullableQuantity(input.stockBackroom, 100000);
    const facings = nullableQuantity(input.facings, 1000);
    if (shelf === null && backroom === null && facings === null) {
      throw new Error("Renseignez au moins un stock ou le nombre de facings.");
    }

    const uploaded = form.get("photo");
    const photo = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
    if (photo && (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) ||
        photo.size > MAX_STOCK_PHOTO_BYTES)) {
      throw new Error("Photo invalide : JPG, PNG ou WebP, 5 Mo maximum.");
    }

    const proposed = input.analysisPayload
      ? stockPhotoSchema.parse(JSON.parse(input.analysisPayload))
      : null;
    if (proposed?.personalDataDetected) throw new Error("Recadrez la photo pour supprimer les données personnelles.");
    // All extracted text stored as evidence is schema-limited and PII-checked by SQL.
    const rawExtraction = proposed ? {
      extracted: proposed,
      validated: { stockShelf: shelf, stockBackroom: backroom, facings },
      corrected: proposed.stockShelf !== shelf || proposed.stockBackroom !== backroom || proposed.facings !== facings,
    } : null;

    const { supabase, userId, brand } = await requireActiveBrand();
    const [{ data: relation, error: relationError }, { data: organization, error: organizationError }] = await Promise.all([
      supabase.from("brand_pharmacies").select("id,brand_id,pharmacy_id")
        .eq("id", input.brandPharmacyId).eq("brand_id", brand.id)
        .is("archived_at", null).maybeSingle(),
      supabase.from("brands").select("organization_id").eq("id", brand.id).single(),
    ]);
    if (relationError || !relation || organizationError || !organization) {
      throw new Error("Pharmacie ou marque non autorisée.");
    }

    const { data: recorded, error } = await supabase
      .from("pharmacy_stock_observations")
      .insert({
        organization_id: organization.organization_id,
        brand_id: brand.id,
        brand_pharmacy_id: input.brandPharmacyId,
        pharmacy_id: relation.pharmacy_id,
        field_visit_id: input.visitId || null,
        product_id: input.productId,
        observed_ean: proposed?.ean ?? null,
        stock_shelf: shelf,
        stock_backroom: backroom,
        facings,
        capture_method: photo ? "photo" : "manual",
        label_layout: proposed?.labelLayout ?? "unknown",
        confidence: proposed?.confidence ?? null,
        raw_extraction: rawExtraction,
        notes: input.notes || null,
        created_by: userId,
      })
      .select("id").single();
    if (error || !recorded) throw new Error(error?.message || "Enregistrement impossible.");

    let warning: string | undefined;
    if (photo) {
      const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const path = brand.id + "/" + recorded.id + "/" + randomUUID() + "." + ext;
      const { error: uploadError } = await supabase.storage.from("stock-evidence")
        .upload(path, await photo.arrayBuffer(), { contentType: photo.type, upsert: false });
      if (uploadError) {
        warning = "Le relevé est enregistré, mais la photo n'a pas été synchronisée.";
      } else {
        const { error: linkError } = await supabase.from("pharmacy_stock_observation_attachments")
          .insert({
            observation_id: recorded.id,
            brand_id: brand.id,
            bucket_id: "stock-evidence",
            object_path: path,
            original_name: photo.name.slice(0, 180) || "etiquette." + ext,
            mime_type: photo.type,
            size_bytes: photo.size,
            uploaded_by: userId,
          });
        if (linkError) {
          await supabase.storage.from("stock-evidence").remove([path]);
          warning = "Le relevé est enregistré, mais la photo n'a pas pu être reliée.";
        }
      }
    }

    revalidatePath("/dashboard/pharmacies/" + input.brandPharmacyId + "/stocks");
    revalidatePath("/dashboard/pharmacies/" + input.brandPharmacyId);
    if (input.visitId) revalidatePath("/dashboard/visits/" + input.visitId);
    return { success: "Relevé produit enregistré dans l'historique.", warning };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Relevé non enregistré." };
  }
}
