"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import {
  addCalendarDays,
  isoToParisLocal,
  parisLocalToIso,
  todayInParis,
} from "@/lib/agenda";

const uuid = z.string().uuid();
const planPreset = z.enum(["today", "tomorrow", "week", "custom"]);
const finishOutcome = z.enum(["very_good", "good", "follow_up", "problem"]);
const nextPreset = z.enum(["none", "week1", "weeks2", "month1", "custom"]);
const noteTags = [
  "order",
  "merchandising",
  "stockout",
  "competitor",
  "callback",
  "problem",
] as const;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const QUICK_VISIT_DURATION_MINUTES = 45;

type QuickActionResult = {
  success?: string;
  error?: string;
  warning?: string;
  visitId?: string;
  scheduledAt?: string;
};

function nextWeekday(date: string, minimumOffset = 1) {
  let candidate = addCalendarDays(date, minimumOffset);
  for (let index = 0; index < 8; index += 1) {
    const day = new Date(`${candidate}T12:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) return candidate;
    candidate = addCalendarDays(candidate, 1);
  }
  return candidate;
}

function addMinutes(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function addMonthsCalendar(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + months, day));
  return result.toISOString().slice(0, 10);
}

async function getRelation(brandPharmacyId: string) {
  const { supabase, brand, userId } = await requireActiveBrand();
  const { data: relation, error } = await supabase
    .from("brand_pharmacies")
    .select("id,brand_id,pharmacy_id,pharmacies(trade_name,legal_name)")
    .eq("id", brandPharmacyId)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !relation) throw new Error("Pharmacie indisponible.");
  const pharmacy = Array.isArray(relation.pharmacies)
    ? relation.pharmacies[0]
    : relation.pharmacies;
  return {
    supabase,
    brand,
    userId,
    relation,
    pharmacyName: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
  };
}

async function findFreeSlot(
  supabase: Awaited<ReturnType<typeof requireActiveBrand>>["supabase"],
  userId: string,
  requestedDate: string,
  earliestLocal?: string,
) {
  let date = requestedDate;
  for (let dayAttempt = 0; dayAttempt < 8; dayAttempt += 1) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) {
      date = addCalendarDays(date, 1);
      continue;
    }
    const from = parisLocalToIso(`${date}T08:00`);
    const to = parisLocalToIso(`${date}T19:00`);
    const [{ data: visits }, { data: blocks }] = await Promise.all([
      supabase
        .from("field_visits")
        .select("scheduled_start_at,scheduled_end_at")
        .eq("owner_user_id", userId)
        .is("archived_at", null)
        .lt("scheduled_start_at", to)
        .gt("scheduled_end_at", from),
      supabase
        .from("agenda_blocks")
        .select("start_at,end_at")
        .eq("owner_user_id", userId)
        .is("archived_at", null)
        .eq("is_busy", true)
        .lt("start_at", to)
        .gt("end_at", from),
    ]);
    const occupied = [
      ...(visits ?? []).map((item) => [item.scheduled_start_at, item.scheduled_end_at] as const),
      ...(blocks ?? []).map((item) => [item.start_at, item.end_at] as const),
    ];
    const dayEarliest = earliestLocal?.startsWith(`${date}T`) ? earliestLocal : `${date}T09:00`;
    let cursor = parisLocalToIso(dayEarliest);
    const closing = parisLocalToIso(`${date}T17:30`);
    while (Date.parse(addMinutes(cursor, QUICK_VISIT_DURATION_MINUTES)) <= Date.parse(closing)) {
      const end = addMinutes(cursor, QUICK_VISIT_DURATION_MINUTES);
      const overlaps = occupied.some(
        ([busyStart, busyEnd]) => Date.parse(cursor) < Date.parse(busyEnd) && Date.parse(end) > Date.parse(busyStart),
      );
      if (!overlaps && Date.parse(cursor) > Date.now() + 5 * 60_000) return cursor;
      cursor = addMinutes(cursor, 30);
    }
    date = nextWeekday(date, 1);
    earliestLocal = undefined;
  }
  throw new Error("Aucun créneau terrain disponible dans les prochains jours.");
}

export async function quickPlanVisitAction(
  brandPharmacyId: string,
  preset: "today" | "tomorrow" | "week" | "custom",
  customStart?: string,
): Promise<QuickActionResult> {
  try {
    const parsed = z.object({
      brandPharmacyId: uuid,
      preset: planPreset,
      customStart: z.string().optional(),
    }).parse({ brandPharmacyId, preset, customStart });
    const { supabase, userId, relation, pharmacyName } = await getRelation(parsed.brandPharmacyId);
    const today = todayInParis();
    let startAt: string;
    if (parsed.preset === "custom") {
      if (!parsed.customStart) throw new Error("Choisissez une date et une heure.");
      startAt = parisLocalToIso(parsed.customStart);
      if (Date.parse(startAt) <= Date.now()) throw new Error("La visite doit être planifiée dans le futur.");
    } else {
      const localNow = isoToParisLocal(new Date().toISOString());
      const requestedDate =
        parsed.preset === "today"
          ? today
          : parsed.preset === "tomorrow"
            ? nextWeekday(today, 1)
            : nextWeekday(today, 2);
      let earliest: string | undefined;
      if (parsed.preset === "today") {
        const [, time] = localNow.split("T");
        const [hour, minute] = time.split(":").map(Number);
        const roundedMinutes = minute < 30 ? 30 : 0;
        const roundedHour = minute < 30 ? hour : hour + 1;
        earliest = `${today}T${String(Math.max(9, roundedHour)).padStart(2, "0")}:${String(roundedMinutes).padStart(2, "0")}`;
      }
      startAt = await findFreeSlot(supabase, userId, requestedDate, earliest);
    }
    const endAt = addMinutes(startAt, QUICK_VISIT_DURATION_MINUTES);
    const { data: visitId, error } = await supabase.rpc("create_field_visit", {
      target_pharmacy_id: relation.pharmacy_id,
      target_brand_pharmacy_ids: [relation.id],
      visit_payload: {
        visit_kind: "client_visit",
        title: `Visite · ${pharmacyName}`,
        scheduled_start_at: startAt,
        scheduled_end_at: endAt,
      },
    });
    if (error) throw error;
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/field");
    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}`);
    return {
      success: `Visite ajoutée · ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(startAt))}`,
      visitId: String(visitId),
      scheduledAt: startAt,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de planifier la visite." };
  }
}

export async function startVisitAction(
  brandPharmacyId: string,
  visitId: string,
): Promise<QuickActionResult> {
  try {
    uuid.parse(brandPharmacyId);
    uuid.parse(visitId);
    const { supabase } = await getRelation(brandPharmacyId);
    const { error } = await supabase.rpc("start_field_visit", { target_visit_id: visitId });
    if (error) throw error;
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/field");
    revalidatePath(`/dashboard/pharmacies/${brandPharmacyId}`);
    return { success: "Visite démarrée." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de démarrer la visite." };
  }
}

export async function completeVisitAction(
  brandPharmacyId: string,
  visitId: string,
  outcome: "very_good" | "good" | "follow_up" | "problem",
  next: "none" | "week1" | "weeks2" | "month1" | "custom",
  customNext?: string,
): Promise<QuickActionResult> {
  try {
    const parsed = z.object({
      brandPharmacyId: uuid,
      visitId: uuid,
      outcome: finishOutcome,
      next: nextPreset,
      customNext: z.string().optional(),
    }).parse({ brandPharmacyId, visitId, outcome, next, customNext });
    const { supabase, userId } = await getRelation(parsed.brandPharmacyId);
    let nextStart: string | null = null;
    if (parsed.next !== "none") {
      if (parsed.next === "custom") {
        if (!parsed.customNext) throw new Error("Choisissez la prochaine date.");
        nextStart = parisLocalToIso(parsed.customNext);
      } else {
        const today = todayInParis();
        const date =
          parsed.next === "week1"
            ? addCalendarDays(today, 7)
            : parsed.next === "weeks2"
              ? addCalendarDays(today, 14)
              : addMonthsCalendar(today, 1);
        nextStart = await findFreeSlot(supabase, userId, date);
      }
    }
    const { data: nextVisitId, error } = await supabase.rpc("complete_field_visit", {
      target_visit_id: parsed.visitId,
      target_outcome: parsed.outcome,
      target_next_start_at: nextStart,
    });
    if (error) throw error;
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/field");
    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}`);
    return {
      success: nextStart
        ? `Visite terminée · prochain passage ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(nextStart))}`
        : "Visite terminée.",
      visitId: nextVisitId ? String(nextVisitId) : undefined,
      scheduledAt: nextStart ?? undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de terminer la visite." };
  }
}

export async function createQuickNoteAction(formData: FormData): Promise<QuickActionResult> {
  try {
    const parsed = z.object({
      brandPharmacyId: uuid,
      fieldVisitId: z.union([uuid, z.literal("")]).optional(),
      notes: z.string().trim().max(4000).optional(),
    }).parse({
      brandPharmacyId: formData.get("brandPharmacyId"),
      fieldVisitId: formData.get("fieldVisitId") || "",
      notes: formData.get("notes") || "",
    });
    const tags = formData
      .getAll("tags")
      .map(String)
      .filter((tag): tag is (typeof noteTags)[number] => noteTags.includes(tag as (typeof noteTags)[number]));
    const photos = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .slice(0, 3);
    if (!parsed.notes && photos.length === 0) throw new Error("Ajoutez une note ou une photo.");
    for (const photo of photos) {
      if (!allowedPhotoTypes.has(photo.type)) throw new Error("Format photo non pris en charge.");
      if (photo.size > MAX_PHOTO_BYTES) throw new Error("Une photo dépasse 3 Mo.");
    }

    const { supabase, brand, userId, relation } = await getRelation(parsed.brandPharmacyId);
    if (parsed.fieldVisitId) {
      const { data: visit } = await supabase
        .from("field_visits")
        .select("id,pharmacy_id,owner_user_id")
        .eq("id", parsed.fieldVisitId)
        .eq("owner_user_id", userId)
        .eq("pharmacy_id", relation.pharmacy_id)
        .maybeSingle();
      if (!visit) throw new Error("La visite associée n’est plus disponible.");
    }

    const subject = tags.length ? `Note terrain · ${tags.join(" · ")}` : "Note terrain";
    const { data: interactionId, error: interactionError } = await supabase.rpc(
      "create_commercial_interaction",
      {
        target_brand_pharmacy_id: parsed.brandPharmacyId,
        target_interaction_type: "internal_note",
        target_outcome: "completed",
        target_subject: subject,
        target_notes: parsed.notes || null,
        target_visibility: "shared",
        target_contact_id: null,
        target_occurred_at: new Date().toISOString(),
        target_duration_minutes: null,
        next_task_type: null,
        next_task_at: null,
        next_task_owner: null,
      },
    );
    if (interactionError || !interactionId) throw interactionError ?? new Error("Note non créée.");

    const { error: enrichError } = await supabase
      .from("interactions")
      .update({ field_visit_id: parsed.fieldVisitId || null, tags })
      .eq("id", String(interactionId))
      .eq("created_by", userId);
    if (enrichError) throw enrichError;

    let uploaded = 0;
    const failed: string[] = [];
    for (const [index, photo] of photos.entries()) {
      const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const path = `${brand.id}/${interactionId}/${crypto.randomUUID()}-${index}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("interaction-evidence")
        .upload(path, await photo.arrayBuffer(), { contentType: photo.type, upsert: false });
      if (uploadError) {
        failed.push(photo.name);
        continue;
      }
      const { error: metadataError } = await supabase.from("interaction_attachments").insert({
        interaction_id: String(interactionId),
        brand_id: brand.id,
        object_path: path,
        original_name: photo.name || `photo-${index + 1}.${extension}`,
        mime_type: photo.type,
        size_bytes: photo.size,
        uploaded_by: userId,
      });
      if (metadataError) {
        await supabase.storage.from("interaction-evidence").remove([path]);
        failed.push(photo.name);
        continue;
      }
      uploaded += 1;
    }

    revalidatePath(`/dashboard/pharmacies/${parsed.brandPharmacyId}`);
    return {
      success: uploaded ? `Note enregistrée · ${uploaded} photo${uploaded > 1 ? "s" : ""}.` : "Note enregistrée.",
      warning: failed.length ? `${failed.length} photo${failed.length > 1 ? "s n’ont" : " n’a"} pas pu être ajoutée${failed.length > 1 ? "s" : ""}.` : undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d’enregistrer la note." };
  }
}
