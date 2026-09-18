"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompletedOnboarding } from "@/lib/auth";
import { parisLocalToIso } from "@/lib/agenda";
import { syncNaaliHubSpotVisitAfterPersistence } from "@/lib/integrations/hubspot/naali-visit-runtime";

export type VisitCloseoutActionState = {
  error?: string;
  success?: string;
  warning?: string;
};

type CloseoutInteractionRef = {
  interactionId: string;
  brandId: string;
  brandPharmacyId: string | null;
};

type CloseoutRpcResult = {
  alreadyClosed: boolean;
  interactions: CloseoutInteractionRef[];
};

type SupabaseSessionClient = Awaited<ReturnType<typeof requireCompletedOnboarding>>["supabase"];

const uuid = z.string().uuid();
const postVisitDelay = z.enum(["3", "7", "14"]);
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function parseCloseoutResult(value: unknown): CloseoutRpcResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { alreadyClosed: false, interactions: [] };
  }

  const payload = value as Record<string, unknown>;
  const rawInteractions = Array.isArray(payload.interactions) ? payload.interactions : [];
  const interactions = rawInteractions.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.interaction_id !== "string" || typeof row.brand_id !== "string") return [];
    return [{
      interactionId: row.interaction_id,
      brandId: row.brand_id,
      brandPharmacyId: typeof row.brand_pharmacy_id === "string" ? row.brand_pharmacy_id : null,
    }];
  });

  return {
    alreadyClosed: payload.already_closed === true,
    interactions,
  };
}

function photoExtension(photo: File) {
  if (photo.type === "image/png") return "png";
  if (photo.type === "image/webp") return "webp";
  return "jpg";
}

async function persistCloseoutEvidence(
  supabase: SupabaseSessionClient,
  userId: string,
  interactions: CloseoutInteractionRef[],
  photos: File[],
) {
  let failed = 0;

  for (const interaction of interactions) {
    for (const [index, photo] of photos.entries()) {
      const objectPath = `${interaction.brandId}/${interaction.interactionId}/closeout-${index + 1}.${photoExtension(photo)}`;
      const { data: existing, error: existingError } = await supabase
        .from("interaction_attachments")
        .select("id")
        .eq("interaction_id", interaction.interactionId)
        .eq("object_path", objectPath)
        .is("archived_at", null)
        .maybeSingle();

      if (existingError) {
        failed += 1;
        continue;
      }
      if (existing) continue;

      // A previous attempt may have uploaded the object before the metadata write
      // failed. Deterministic paths let us clean that orphan and retry safely.
      await supabase.storage.from("interaction-evidence").remove([objectPath]);

      const { error: uploadError } = await supabase.storage
        .from("interaction-evidence")
        .upload(objectPath, await photo.arrayBuffer(), {
          contentType: photo.type,
          upsert: false,
        });
      if (uploadError) {
        failed += 1;
        continue;
      }

      const { error: attachmentError } = await supabase
        .from("interaction_attachments")
        .insert({
          interaction_id: interaction.interactionId,
          brand_id: interaction.brandId,
          bucket_id: "interaction-evidence",
          object_path: objectPath,
          original_name: photo.name || `photo-${index + 1}.${photoExtension(photo)}`,
          mime_type: photo.type,
          size_bytes: photo.size,
          uploaded_by: userId,
        });

      if (attachmentError) {
        failed += 1;
        await supabase.storage.from("interaction-evidence").remove([objectPath]);
      }
    }
  }

  return { failed };
}

async function syncNaaliVisitIfLinked(
  supabase: SupabaseSessionClient,
  visitId: string,
  interactions: CloseoutInteractionRef[],
) {
  const brandIds = [...new Set(interactions.map((interaction) => interaction.brandId))];
  if (!brandIds.length) return;

  const { data: brands } = await supabase
    .from("brands")
    .select("id,slug")
    .in("id", brandIds);

  for (const brand of brands ?? []) {
    if (String(brand.slug).trim().toLowerCase() === "naali") {
      await syncNaaliHubSpotVisitAfterPersistence(String(brand.id), visitId);
    }
  }
}

export async function startFieldVisitAction(
  _state: VisitCloseoutActionState,
  formData: FormData,
): Promise<VisitCloseoutActionState> {
  try {
    const parsed = z.object({ visitId: uuid }).parse(Object.fromEntries(formData));
    const { supabase } = await requireCompletedOnboarding();
    const { error } = await supabase.rpc("start_field_visit", {
      target_visit_id: parsed.visitId,
    });
    if (error) throw error;

    revalidatePath(`/dashboard/visits/${parsed.visitId}`);
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/agent");
    return { success: "Visite démarrée." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de démarrer la visite.",
    };
  }
}

export async function closeFieldVisitAction(
  _state: VisitCloseoutActionState,
  formData: FormData,
): Promise<VisitCloseoutActionState> {
  try {
    const parsed = z.object({
      visitId: uuid,
      outcome: z.enum(["order_taken", "no_order", "follow_up", "information", "other"]),
      summary: z.string().trim().min(2, "Ajoutez un compte rendu court.").max(4000),
      nextVisitAt: z.string().optional(),
      nextObjective: z.string().trim().max(1000).optional(),
      inputMode: z.enum(["manual", "dictation", "assistant"]).default("manual"),
    }).parse(Object.fromEntries(formData));

    const photos = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .slice(0, 3);

    for (const photo of photos) {
      if (!allowedPhotoTypes.has(photo.type)) {
        throw new Error("Format photo non pris en charge. Utilisez JPEG, PNG ou WebP.");
      }
      if (photo.size > MAX_PHOTO_BYTES) {
        throw new Error("Une photo dépasse 3 Mo. Réduisez-la avant de clôturer la visite.");
      }
    }

    const nextVisitAt = parsed.nextVisitAt?.trim()
      ? parisLocalToIso(parsed.nextVisitAt)
      : null;

    const { supabase, userId } = await requireCompletedOnboarding();
    const { data, error } = await supabase.rpc("close_field_visit", {
      target_visit_id: parsed.visitId,
      closeout_payload: {
        outcome: parsed.outcome,
        summary: parsed.summary,
        input_mode: parsed.inputMode,
        structured_payload: {},
        next_visit_at: nextVisitAt,
        next_objective: parsed.nextObjective || null,
      },
    });
    if (error) throw error;

    const closeout = parseCloseoutResult(data);
    let evidenceFailed = 0;

    if (photos.length > 0) {
      if (!closeout.interactions.length) {
        evidenceFailed = photos.length;
      } else {
        const evidence = await persistCloseoutEvidence(
          supabase,
          userId,
          closeout.interactions,
          photos,
        );
        evidenceFailed = evidence.failed;
      }
    }

    await syncNaaliVisitIfLinked(supabase, parsed.visitId, closeout.interactions);

    revalidatePath(`/dashboard/visits/${parsed.visitId}`);
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/agent");
    revalidatePath("/dashboard/agent/closeouts");
    revalidatePath("/dashboard/pharmacies");
    for (const brandPharmacyId of new Set(
      closeout.interactions
        .map((interaction) => interaction.brandPharmacyId)
        .filter((value): value is string => Boolean(value)),
    )) {
      revalidatePath(`/dashboard/pharmacies/${brandPharmacyId}`);
      revalidatePath(`/dashboard/pharmacies/${brandPharmacyId}/notes`);
    }

    const success = nextVisitAt
      ? "Visite clôturée et prochaine visite ajoutée à l’Agenda."
      : closeout.alreadyClosed
        ? "Visite déjà clôturée. Les preuves ont été revérifiées."
        : "Visite clôturée.";

    if (evidenceFailed > 0) {
      return {
        success,
        warning: `${evidenceFailed} preuve(s) photo restent à synchroniser. Relancez « Clôturer la visite » pour réessayer : aucune visite ni prochaine action ne sera créée en double.`,
      };
    }

    return { success };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de clôturer la visite.",
    };
  }
}


export async function createPostVisitFollowUpAction(
  _state: VisitCloseoutActionState,
  formData: FormData,
): Promise<VisitCloseoutActionState> {
  try {
    const parsed = z.object({
      visitId: uuid,
      brandPharmacyId: uuid,
      delayDays: postVisitDelay,
    }).parse(Object.fromEntries(formData));

    const { supabase, userId } = await requireCompletedOnboarding();
    const { data: link, error: linkError } = await supabase
      .from("field_visit_brands")
      .select("brand_id,brand_pharmacy_id,field_visits!inner(id,status,owner_user_id,archived_at)")
      .eq("visit_id", parsed.visitId)
      .eq("brand_pharmacy_id", parsed.brandPharmacyId)
      .eq("field_visits.owner_user_id", userId)
      .eq("field_visits.status", "completed")
      .is("field_visits.archived_at", null)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) throw new Error("Cette visite clôturée n’est plus disponible.");

    const dedupeKey = `post_visit_follow_up:${parsed.visitId}:${parsed.brandPharmacyId}`;
    const { data: existing, error: existingError } = await supabase
      .from("tasks")
      .select("id,due_at")
      .eq("dedupe_key", dedupeKey)
      .in("status", ["open", "in_progress"])
      .is("archived_at", null)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return { success: "La relance après visite est déjà planifiée." };
    }

    const dueAt = new Date(Date.now() + Number(parsed.delayDays) * 86_400_000).toISOString();
    const { error } = await supabase.from("tasks").insert({
      brand_id: link.brand_id,
      brand_pharmacy_id: parsed.brandPharmacyId,
      task_type: "follow_up",
      title: "Relance après visite",
      description: "Suite créée directement depuis la clôture de visite.",
      priority: "normal",
      due_at: dueAt,
      assigned_to: userId,
      created_by: userId,
      source: "interaction",
      action_code: "post_visit_follow_up",
      trigger_type: "field_visit",
      trigger_id: parsed.visitId,
      dedupe_key: dedupeKey,
      rule_code: "user_action_v1",
    });
    if (error) throw error;

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}`);
    revalidatePath(`/dashboard/visits/${parsed.visitId}`);

    return { success: `Relance planifiée dans ${parsed.delayDays} jours.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible de planifier la relance.",
    };
  }
}
