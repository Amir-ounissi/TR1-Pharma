"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBrandContexts, requireCompletedOnboarding } from "@/lib/auth";
import { addCalendarDays, mondayOfWeek, parisLocalToIso, parseCalendarDate } from "@/lib/agenda";
import { syncNaaliHubSpotVisitByVisitId } from "@/lib/integrations/hubspot/naali-visit-runtime";

const uuid = z.string().uuid();
const dateTime = z.string().min(16).transform(parisLocalToIso);

const agendaView = z.enum(["day", "week"]);

type AgendaEventRow = {
  event_key: string;
  source_kind: string;
  source_id: string;
  event_type: string;
  title: string;
  start_at: string;
  end_at: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  city: string | null;
  brand_ids: string[];
  brand_names: string[];
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  ownership: "mine" | "pharmacy_activity";
  status: string;
  draggable: boolean;
  detail_url: string;
  priority: string;
  metadata: Record<string, unknown>;
};

function parseAgendaDate(value: string) {
  if (!parseCalendarDate(value)) throw new Error("Date invalide.");
  return value;
}

export async function loadAgendaRangeAction(requestedDate: string, requestedView: "day" | "week") {
  const safeDate = parseAgendaDate(requestedDate);
  const view = agendaView.parse(requestedView);
  const date = view === "week" ? mondayOfWeek(safeDate) : safeDate;
  const end = view === "week" ? addCalendarDays(date, 6) : date;
  const [{ supabase }, contexts] = await Promise.all([
    requireCompletedOnboarding(),
    getBrandContexts(),
  ]);
  const { data, error } = await supabase.rpc("get_my_field_agenda", {
    start_date: date,
    end_date: end,
    brand_filter: null,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AgendaEventRow[];
  const brandIds = contexts.map((context) => context.id);
  const pharmacyIds = [...new Set(rows.map((row) => row.pharmacy_id).filter((id): id is string => Boolean(id)))];
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");

  const relations = pharmacyIds.length && brandIds.length
    ? await supabase
        .from("brand_pharmacies")
        .select("id,brand_id,pharmacy_id")
        .in("brand_id", brandIds)
        .in("pharmacy_id", pharmacyIds)
        .is("archived_at", null)
    : { data: [], error: null };

  if (relations.error) throw new Error(relations.error.message);
  const relationRows = relations.data ?? [];

  const events = rows.map((event) => {
    if (event.source_kind === "field_visit") {
      return { ...event, detail_url: `/dashboard/visits/${event.source_id}` };
    }
    if (facilitatorOnly && event.source_kind === "mission") {
      return { ...event, detail_url: `/dashboard/field/missions/${event.source_id}` };
    }
    if (!event.pharmacy_id) return event;
    const relation = relationRows.find(
      (item) =>
        item.pharmacy_id === event.pharmacy_id &&
        (event.brand_ids.length === 0 || event.brand_ids.includes(item.brand_id)),
    ) ?? relationRows.find((item) => item.pharmacy_id === event.pharmacy_id);
    return relation ? { ...event, detail_url: `/dashboard/pharmacies/${relation.id}` } : event;
  });

  return { date, view, events };
}

export async function searchAgendaPharmaciesAction(rawQuery: string) {
  const query = z.string().trim().min(2).max(80).parse(rawQuery);
  const [{ supabase }, contexts] = await Promise.all([
    requireCompletedOnboarding(),
    getBrandContexts(),
  ]);
  const agentContexts = contexts.filter((context) => context.role === "agent");
  if (!agentContexts.length) return [];

  const { data, error } = await supabase
    .from("brand_pharmacy_directory")
    .select("id,brand_id,pharmacy_id,trade_name,legal_name,city")
    .in("brand_id", agentContexts.map((context) => context.id))
    .is("archived_at", null)
    .ilike("search_text", `%${query}%`)
    .order("trade_name", { ascending: true })
    .limit(30);
  if (error) throw new Error(error.message);

  const brandNames = new Map(agentContexts.map((context) => [context.id, context.name]));
  const grouped = new Map<string, {
    id: string;
    label: string;
    city?: string;
    brands: Array<{ relationId: string; brandId: string; brandName: string }>;
  }>();

  for (const row of data ?? []) {
    if (!grouped.has(row.pharmacy_id)) {
      grouped.set(row.pharmacy_id, {
        id: row.pharmacy_id,
        label: row.trade_name || row.legal_name || "Pharmacie",
        city: row.city ?? undefined,
        brands: [],
      });
    }
    grouped.get(row.pharmacy_id)?.brands.push({
      relationId: row.id,
      brandId: row.brand_id,
      brandName: brandNames.get(row.brand_id) || "Marque",
    });
  }

  return [...grouped.values()];
}

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
    revalidatePath("/dashboard/agenda");
    return { success: "Visite ajoutée à votre Agenda." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Visite invalide." }; }
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

export async function retryFieldVisitHubSpotSyncAction(visitId: string) {
  const parsed = uuid.parse(visitId);
  await requireCompletedOnboarding();
  await syncNaaliHubSpotVisitByVisitId(parsed);
  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/visits/${parsed}`);
}

export async function rescheduleFieldVisitAction(visitId: string, newStartLocal: string) {
  const parsed = z.object({ visitId: uuid, newStartLocal: dateTime }).parse({ visitId, newStartLocal });
  const { supabase } = await requireCompletedOnboarding();
  const { error } = await supabase.rpc("reschedule_field_visit", { target_visit_id: parsed.visitId, target_start_at: parsed.newStartLocal });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/agenda");
}
