"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompletedOnboarding } from "@/lib/auth";

export type VisitAuditActionState = {
  error?: string;
  success?: string;
  warning?: string;
};

const databaseUuid = z.string().regex(
  /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
  "Identifiant invalide.",
);
const booleanChoice = z.enum(["true", "false", "unknown"]);
const recommendationCode = z.enum([
  "reorder",
  "price",
  "plv",
  "training",
  "merchandising",
  "animation",
  "follow_up",
]);
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function nullableBoolean(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function photoExtension(photo: File) {
  if (photo.type === "image/png") return "png";
  if (photo.type === "image/webp") return "webp";
  return "jpg";
}

function parseAuditResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Le résultat de l’audit est invalide.");
  }
  const payload = value as Record<string, unknown>;
  if (typeof payload.audit_id !== "string") {
    throw new Error("L’audit n’a pas pu être identifié.");
  }
  return {
    auditId: payload.audit_id,
    recommendations: Array.isArray(payload.recommendations)
      ? payload.recommendations.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function saveVisitAuditAction(
  _state: VisitAuditActionState,
  formData: FormData,
): Promise<VisitAuditActionState> {
  try {
    const parsed = z.object({
      visitId: databaseUuid,
      brandPharmacyId: databaseUuid,
      priceDisplayed: booleanChoice,
      displayedPriceTtc: z.string().trim().optional(),
      availabilityStatus: z.enum(["available", "low_stock", "stockout", "unknown"]),
      stockQuantity: z.string().trim().optional(),
      stockCountMode: z.enum(["counted", "estimated", "unknown"]),
      facings: z.string().trim().optional(),
      shelfVisibility: z.enum(["high", "medium", "low", "not_visible", "unknown"]),
      plvPresent: booleanChoice,
      teamTrainingStatus: z.enum(["trained", "reinforce", "not_trained", "unknown"]),
      testerSamplesStatus: z.enum(["present", "missing", "not_applicable", "unknown"]),
      competitionVisible: booleanChoice,
      competitionNote: z.string().trim().max(1000).optional(),
      notes: z.string().trim().max(2000).optional(),
    }).parse({
      visitId: formData.get("visitId"),
      brandPharmacyId: formData.get("brandPharmacyId"),
      priceDisplayed: formData.get("priceDisplayed"),
      displayedPriceTtc: formData.get("displayedPriceTtc"),
      availabilityStatus: formData.get("availabilityStatus"),
      stockQuantity: formData.get("stockQuantity"),
      stockCountMode: formData.get("stockCountMode"),
      facings: formData.get("facings"),
      shelfVisibility: formData.get("shelfVisibility"),
      plvPresent: formData.get("plvPresent"),
      teamTrainingStatus: formData.get("teamTrainingStatus"),
      testerSamplesStatus: formData.get("testerSamplesStatus"),
      competitionVisible: formData.get("competitionVisible"),
      competitionNote: formData.get("competitionNote"),
      notes: formData.get("notes"),
    });

    const photo = formData.get("auditPhoto");
    const auditPhoto = photo instanceof File && photo.size > 0 ? photo : null;
    if (auditPhoto) {
      if (!allowedPhotoTypes.has(auditPhoto.type)) {
        throw new Error("Format photo non pris en charge. Utilisez JPEG, PNG ou WebP.");
      }
      if (auditPhoto.size > MAX_PHOTO_BYTES) {
        throw new Error("La photo dépasse 3 Mo.");
      }
    }

    const { supabase, userId } = await requireCompletedOnboarding();
    const payload = {
      price_displayed: nullableBoolean(parsed.priceDisplayed),
      displayed_price_ttc: parsed.displayedPriceTtc || null,
      availability_status: parsed.availabilityStatus,
      stock_quantity: parsed.stockQuantity || null,
      stock_count_mode: parsed.stockCountMode,
      facings: parsed.facings || null,
      shelf_visibility: parsed.shelfVisibility,
      plv_present: nullableBoolean(parsed.plvPresent),
      team_training_status: parsed.teamTrainingStatus,
      tester_samples_status: parsed.testerSamplesStatus,
      competition_visible: nullableBoolean(parsed.competitionVisible),
      competition_note: parsed.competitionNote || null,
      notes: parsed.notes || null,
    };

    const { data, error } = await supabase.rpc("save_field_visit_audit", {
      target_visit_id: parsed.visitId,
      target_brand_pharmacy_id: parsed.brandPharmacyId,
      audit_payload: payload,
    });
    if (error) throw error;

    const audit = parseAuditResult(data);
    let photoWarning: string | undefined;

    if (auditPhoto) {
      const { data: auditRow, error: auditRowError } = await supabase
        .from("field_visit_audits")
        .select("brand_id")
        .eq("id", audit.auditId)
        .eq("created_by", userId)
        .single();
      if (auditRowError) throw auditRowError;

      const objectPath = `${auditRow.brand_id}/${audit.auditId}/audit-${Date.now()}.${photoExtension(auditPhoto)}`;
      const { data: existing } = await supabase
        .from("field_visit_audit_attachments")
        .select("id,object_path")
        .eq("audit_id", audit.auditId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error: uploadError } = await supabase.storage
        .from("audit-evidence")
        .upload(objectPath, await auditPhoto.arrayBuffer(), {
          contentType: auditPhoto.type,
          upsert: false,
        });
      if (uploadError) {
        photoWarning = "L’audit est enregistré, mais la photo n’a pas été synchronisée.";
      } else {
        const { error: attachmentError } = await supabase
          .from("field_visit_audit_attachments")
          .insert({
            audit_id: audit.auditId,
            brand_id: auditRow.brand_id,
            bucket_id: "audit-evidence",
            object_path: objectPath,
            original_name: auditPhoto.name || `audit.${photoExtension(auditPhoto)}`,
            mime_type: auditPhoto.type,
            size_bytes: auditPhoto.size,
            uploaded_by: userId,
          });
        if (attachmentError) {
          photoWarning = "L’audit est enregistré, mais la photo n’a pas été reliée.";
          await supabase.storage.from("audit-evidence").remove([objectPath]);
        } else if (existing?.object_path) {
          await supabase
            .from("field_visit_audit_attachments")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", existing.id);
          await supabase.storage.from("audit-evidence").remove([existing.object_path]);
        }
      }
    }

    revalidatePath(`/dashboard/visits/${parsed.visitId}`);
    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}`);

    const recommendationCount = audit.recommendations.length;
    return {
      success: recommendationCount
        ? `Audit enregistré · ${recommendationCount} action(s) à envisager.`
        : "Audit enregistré · aucun écart majeur détecté.",
      warning: photoWarning,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible d’enregistrer l’audit.",
    };
  }
}

const recommendationTaskConfig = {
  reorder: { taskType: "request_order", title: "Réassort à vérifier" },
  price: { taskType: "follow_up", title: "Contrôler le prix affiché" },
  plv: { taskType: "other", title: "Remettre la PLV en place" },
  training: { taskType: "other", title: "Renforcer la formation de l’équipe" },
  merchandising: { taskType: "other", title: "Corriger le merchandising" },
  animation: { taskType: "other", title: "Étudier une animation" },
  follow_up: { taskType: "follow_up", title: "Revenir sur la concurrence observée" },
} as const;

export async function createAuditRecommendationTaskAction(
  _state: VisitAuditActionState,
  formData: FormData,
): Promise<VisitAuditActionState> {
  try {
    const parsed = z.object({
      auditId: databaseUuid,
      code: recommendationCode,
    }).parse(Object.fromEntries(formData));

    const { supabase, userId } = await requireCompletedOnboarding();
    const { data: audit, error: auditError } = await supabase
      .from("field_visit_audits")
      .select("id,visit_id,brand_id,brand_pharmacy_id,recommendations")
      .eq("id", parsed.auditId)
      .contains("recommendations", [parsed.code])
      .maybeSingle();

    if (auditError) throw auditError;
    if (!audit) throw new Error("Cette recommandation n’est plus disponible.");

    const dedupeKey = `audit_recommendation:${audit.id}:${parsed.code}`;
    const { data: existing, error: existingError } = await supabase
      .from("tasks")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .in("status", ["open", "in_progress"])
      .is("archived_at", null)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { success: "Cette action est déjà planifiée." };

    const config = recommendationTaskConfig[parsed.code];
    const { error } = await supabase.from("tasks").insert({
      brand_id: audit.brand_id,
      brand_pharmacy_id: audit.brand_pharmacy_id,
      task_type: config.taskType,
      title: config.title,
      description: "Action proposée à partir d’un audit terrain 4P+.",
      priority: parsed.code === "reorder" ? "high" : "normal",
      due_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      assigned_to: userId,
      created_by: userId,
      source: "interaction",
      action_code: `audit_${parsed.code}`,
      trigger_type: "field_visit_audit",
      trigger_id: audit.id,
      dedupe_key: dedupeKey,
      rule_code: "audit_4p_v1",
    });
    if (error) throw error;

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/visits/${audit.visit_id}`);
    revalidatePath(`/dashboard/pharmacies/${audit.brand_pharmacy_id}`);
    return { success: "Action ajoutée à vos tâches." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de créer cette action.",
    };
  }
}
