"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBrandContexts, requireCompletedOnboarding } from "@/lib/auth";
import { parisLocalToIso } from "@/lib/agenda";
import { syncNaaliHubSpotVisitByVisitId } from "@/lib/integrations/hubspot/naali-visit-runtime";

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
}
