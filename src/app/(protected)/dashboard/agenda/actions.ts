"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBrandContexts, requireCompletedOnboarding } from "@/lib/auth";
import { addCalendarDays, mondayOfWeek, parseCalendarDate, parisLocalToIso, todayInParis } from "@/lib/agenda";

const uuid = z.string().uuid();
const dateTime = z.string().min(16).transform(parisLocalToIso);

export async function createFieldVisitAction(_: unknown, formData: FormData) {
  try {
    const parsed = z.object({
      pharmacyId: uuid,
      brandPharmacyId: z.array(uuid).min(1),
      visitKind: z.enum(["client_visit","prospecting","relationship","training","other"]),
      title: z.string().trim().min(1),
      objective: z.string().optional(),
      notes: z.string().optional(),
      startAt: dateTime,
      endAt: dateTime.optional(),
      duration: z.coerce.number().int().min(15).max(480).default(60),
    }).parse({ ...Object.fromEntries(formData), brandPharmacyId: formData.getAll("brandPharmacyId") });
    const scheduledEndAt = parsed.endAt ?? new Date(Date.parse(parsed.startAt) + parsed.duration * 60_000).toISOString();
    const { supabase } = await requireCompletedOnboarding();
    const { data: visitId, error } = await supabase.rpc("create_field_visit", {
      target_pharmacy_id: parsed.pharmacyId,
      target_brand_pharmacy_ids: parsed.brandPharmacyId,
      visit_payload: {
        visit_kind: parsed.visitKind,
        title: parsed.title,
        objective: parsed.objective,
        notes: parsed.notes,
        scheduled_start_at: parsed.startAt,
        scheduled_end_at: scheduledEndAt,
      },
    });
    if (error) throw error;
    return { success: "Visite ajoutée à votre Agenda.", visitId: String(visitId) };
  } catch (error) { return { error: error instanceof Error ? error.message : "Visite invalide." }; }
}

export async function loadAgendaPharmaciesAction() {
  const [{ supabase }, contexts] = await Promise.all([
    requireCompletedOnboarding(),
    getBrandContexts(),
  ]);
  const brandIds = contexts
    .filter((context) => context.role === "agent")
    .map((context) => context.id);

  if (!brandIds.length) return [];

  const { data: relations, error } = await supabase
    .from("brand_pharmacies")
    .select("id,brand_id,pharmacy_id,brands(name),pharmacies(trade_name,legal_name,city)")
    .in("brand_id", brandIds)
    .is("archived_at", null);

  if (error) throw new Error(error.message);

  const grouped = new Map<
    string,
    {
      id: string;
      label: string;
      city?: string;
      brands: Array<{ relationId: string; brandId: string; brandName: string }>;
    }
  >();

  for (const relation of relations ?? []) {
    const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
    const brand = Array.isArray(relation.brands) ? relation.brands[0] : relation.brands;
    if (!grouped.has(relation.pharmacy_id)) {
      grouped.set(relation.pharmacy_id, {
        id: relation.pharmacy_id,
        label: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
        city: pharmacy?.city ?? undefined,
        brands: [],
      });
    }
    grouped.get(relation.pharmacy_id)?.brands.push({
      relationId: relation.id,
      brandId: relation.brand_id,
      brandName: brand?.name || "Marque",
    });
  }

  return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
}



type AgendaWindowEvent = {
  source_kind: string;
  source_id: string;
  pharmacy_id: string | null;
  brand_ids: string[];
  detail_url: string;
  [key: string]: unknown;
};

export async function loadAgendaWindowAction(rawDate: string, rawView: "day" | "week") {
  const parsed = z.object({
    date: z.string().min(10),
    view: z.enum(["day", "week"]),
  }).parse({ date: rawDate, view: rawView });

  const [{ supabase }, contexts] = await Promise.all([
    requireCompletedOnboarding(),
    getBrandContexts(),
  ]);

  const today = todayInParis();
  const safeDate = parseCalendarDate(parsed.date) ? parsed.date : today;
  const date = parsed.view === "week" ? mondayOfWeek(safeDate) : safeDate;
  const end = parsed.view === "week" ? addCalendarDays(date, 6) : date;
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");

  const { data, error } = await supabase.rpc("get_my_field_agenda", {
    start_date: date,
    end_date: end,
    brand_filter: null,
  });
  if (error) throw new Error(error.message);

  const events = ((data ?? []) as AgendaWindowEvent[]).map((event) => {
    if (event.source_kind === "field_visit") {
      return { ...event, detail_url: `/dashboard/visits/${event.source_id}` };
    }
    if (facilitatorOnly && event.source_kind === "mission") {
      return { ...event, detail_url: `/dashboard/field/missions/${event.source_id}` };
    }
    if (event.pharmacy_id) {
      const brand = event.brand_ids[0];
      const query = brand ? `?brand=${encodeURIComponent(brand)}` : "";
      return {
        ...event,
        detail_url: `/dashboard/pharmacies/open-pharmacy/${event.pharmacy_id}${query}`,
      };
    }
    return event;
  });

  return { date, view: parsed.view, events };
}

export async function createAgendaBlockAction(_: unknown, formData: FormData) {
  try {
    const parsed = z.object({ blockType: z.enum(["unavailable","travel","meeting","break","personal","other"]), title: z.string().trim().min(1), startAt: dateTime, endAt: dateTime }).parse(Object.fromEntries(formData));
    const { supabase } = await requireCompletedOnboarding();
    const { error } = await supabase.rpc("create_agenda_block", { block_payload: { block_type: parsed.blockType, title: parsed.title, start_at: parsed.startAt, end_at: parsed.endAt, is_busy: true } });
    if (error) throw error;
    revalidatePath("/dashboard/agenda");
    return { success: "Créneau bloqué." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Créneau invalide." }; }
}

export async function rescheduleFieldVisitAction(visitId: string, newStartLocal: string) {
  const parsed = z.object({ visitId: uuid, newStartLocal: dateTime }).parse({ visitId, newStartLocal });
  const { supabase } = await requireCompletedOnboarding();
  const { error } = await supabase.rpc("reschedule_field_visit", { target_visit_id: parsed.visitId, target_start_at: parsed.newStartLocal });
  if (error) throw new Error(error.message);
}
