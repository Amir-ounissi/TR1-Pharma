"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompletedOnboarding } from "@/lib/auth";
import { parisLocalToIso } from "@/lib/agenda";

const uuid = z.string().uuid();
const dateTime = z.string().min(16).transform(parisLocalToIso);

export async function createFieldVisitAction(_: unknown, formData: FormData) {
  try {
    const parsed = z.object({ pharmacyId: uuid, brandPharmacyId: z.array(uuid).min(1), visitKind: z.enum(["client_visit","prospecting","relationship","training","other"]), title: z.string().trim().min(1), objective: z.string().optional(), notes: z.string().optional(), startAt: dateTime, endAt: dateTime }).parse({ ...Object.fromEntries(formData), brandPharmacyId: formData.getAll("brandPharmacyId") });
    const { supabase } = await requireCompletedOnboarding();
    const { error } = await supabase.rpc("create_field_visit", { target_pharmacy_id: parsed.pharmacyId, target_brand_pharmacy_ids: parsed.brandPharmacyId, visit_payload: { visit_kind: parsed.visitKind, title: parsed.title, objective: parsed.objective, notes: parsed.notes, scheduled_start_at: parsed.startAt, scheduled_end_at: parsed.endAt } });
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

export async function rescheduleFieldVisitAction(visitId: string, newStartLocal: string) {
  const parsed = z.object({ visitId: uuid, newStartLocal: dateTime }).parse({ visitId, newStartLocal });
  const { supabase } = await requireCompletedOnboarding();
  const { error } = await supabase.rpc("reschedule_field_visit", { target_visit_id: parsed.visitId, target_start_at: parsed.newStartLocal });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/agenda");
}
