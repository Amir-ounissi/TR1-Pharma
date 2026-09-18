"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

export type PriceObservationActionState = {
  error?: string;
  success?: string;
};

const databaseUuid = z.string().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
const priceType = z.enum(["regular", "promotion", "bundle", "other"]);
const captureMethod = z.enum(["photo", "manual", "import"]);
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 5 * 1024 * 1024;

function safeFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^[-.]+|[-.]+$/g, "").slice(0, 180) || "prix";
}

export async function savePriceObservationAction(
  _state: PriceObservationActionState,
  formData: FormData,
): Promise<PriceObservationActionState> {
  try {
    const parsed = z.object({
      brandPharmacyId: databaseUuid,
      visitId: z.union([databaseUuid, z.literal("")]).optional(),
      productId: databaseUuid,
      observedEan: z.string().trim().max(32).optional(),
      priceTtc: z.coerce.number().positive().max(10000),
      priceType,
      bundleQuantity: z.string().trim().optional(),
      captureMethod,
      confidence: z.string().trim().optional(),
      notes: z.string().trim().max(2000).optional(),
      analysisPayload: z.string().trim().max(32768).optional(),
    }).parse({
      brandPharmacyId: String(formData.get("brandPharmacyId") ?? ""),
      visitId: String(formData.get("visitId") ?? ""),
      productId: String(formData.get("productId") ?? ""),
      observedEan: String(formData.get("observedEan") ?? ""),
      priceTtc: String(formData.get("priceTtc") ?? ""),
      priceType: String(formData.get("priceType") ?? "regular"),
      bundleQuantity: String(formData.get("bundleQuantity") ?? ""),
      captureMethod: String(formData.get("captureMethod") ?? "photo"),
      confidence: String(formData.get("confidence") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      analysisPayload: String(formData.get("analysisPayload") ?? ""),
    });

    let rawExtraction: Record<string, unknown> | null = null;
    if (parsed.analysisPayload) {
      try {
        const candidate = JSON.parse(parsed.analysisPayload);
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
          throw new Error("invalid_analysis_payload");
        }
        rawExtraction = candidate as Record<string, unknown>;
      } catch {
        throw new Error("La prévisualisation automatique est invalide. Relancez l’analyse ou saisissez le prix manuellement.");
      }
    }

    const bundleQuantity = parsed.priceType === "bundle"
      ? z.coerce.number().int().min(2).max(100).parse(parsed.bundleQuantity)
      : null;
    const confidence = parsed.confidence
      ? z.coerce.number().min(0).max(1).parse(parsed.confidence)
      : null;

    const photoEntry = formData.get("photo");
    const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;
    if (parsed.captureMethod === "photo" && !photo) {
      throw new Error("Ajoutez la photo du produit et de son prix.");
    }
    if (photo) {
      if (!allowedPhotoTypes.has(photo.type)) {
        throw new Error("Format photo non pris en charge. Utilisez JPEG, PNG ou WebP.");
      }
      if (photo.size > maxPhotoBytes) throw new Error("La photo ne doit pas dépasser 5 Mo.");
    }

    const { supabase, brand, userId } = await requireActiveBrand();
    const { data: relation, error: relationError } = await supabase
      .from("brand_pharmacies")
      .select("id,brand_id")
      .eq("id", parsed.brandPharmacyId)
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .maybeSingle();
    if (relationError) throw relationError;
    if (!relation) throw new Error("Pharmacie indisponible pour cette marque.");

    const { data, error } = await supabase.rpc("save_pharmacy_price_observation", {
      target_observation_id: null,
      target_brand_pharmacy_id: parsed.brandPharmacyId,
      target_field_visit_id: parsed.visitId || null,
      target_product_id: parsed.productId,
      target_observed_ean: parsed.observedEan || null,
      target_price_ttc: parsed.priceTtc,
      target_price_type: parsed.priceType,
      target_bundle_quantity: bundleQuantity,
      target_capture_method: parsed.captureMethod,
      target_confidence: confidence,
      target_raw_extraction: rawExtraction,
      target_notes: parsed.notes || null,
    });
    if (error) throw error;
    const observationId = databaseUuid.parse(data);

    if (photo) {
      const fileName = safeFileName(photo.name);
      const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const objectPath = `${brand.id}/${observationId}/${randomUUID()}-${fileName || `price.${extension}`}`;
      const { error: uploadError } = await supabase.storage
        .from("price-evidence")
        .upload(objectPath, await photo.arrayBuffer(), {
          contentType: photo.type,
          upsert: false,
        });
      if (uploadError) {
        return {
          success: "Prix observé enregistré.",
          error: "La photo n’a pas pu être synchronisée. Le relevé reste enregistré.",
        };
      }

      const { error: evidenceError } = await supabase
        .from("pharmacy_price_observation_attachments")
        .insert({
          observation_id: observationId,
          brand_id: brand.id,
          bucket_id: "price-evidence",
          object_path: objectPath,
          original_name: fileName,
          mime_type: photo.type,
          size_bytes: photo.size,
          uploaded_by: userId,
        });
      if (evidenceError) {
        await supabase.storage.from("price-evidence").remove([objectPath]);
        return {
          success: "Prix observé enregistré.",
          error: "La photo n’a pas pu être reliée au relevé.",
        };
      }
    }

    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}/prices`);
    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}`);
    if (parsed.visitId) revalidatePath(`/dashboard/visits/${parsed.visitId}`);
    return { success: "Prix observé et preuve terrain enregistrés." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible d’enregistrer ce prix.",
    };
  }
}
