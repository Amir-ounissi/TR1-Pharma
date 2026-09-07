"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

const uuid = z.string().uuid();

export type VisitContextResult = {
  mode: "plan" | "started" | "finish" | "error";
  visitId?: string;
  scheduledAt?: string;
  message?: string;
};

export async function resolveVisitAction(brandPharmacyId: string): Promise<VisitContextResult> {
  try {
    uuid.parse(brandPharmacyId);
    const { supabase, brand, userId } = await requireActiveBrand();
    const { data: relation } = await supabase
      .from("brand_pharmacies")
      .select("id,pharmacy_id")
      .eq("id", brandPharmacyId)
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .maybeSingle();
    if (!relation) return { mode: "error", message: "Pharmacie indisponible." };

    const { data: visitLinks, error } = await supabase
      .from("field_visit_brands")
      .select("visit_id,field_visits!inner(id,status,scheduled_start_at,owner_user_id,pharmacy_id,archived_at)")
      .eq("brand_pharmacy_id", brandPharmacyId)
      .eq("field_visits.owner_user_id", userId)
      .eq("field_visits.pharmacy_id", relation.pharmacy_id)
      .is("field_visits.archived_at", null);
    if (error) throw error;

    const visits = (visitLinks ?? [])
      .map((link) => Array.isArray(link.field_visits) ? link.field_visits[0] : link.field_visits)
      .filter(Boolean)
      .filter((visit) => ["planned", "confirmed", "in_progress"].includes(visit.status))
      .sort((left, right) => {
        if (left.status === "in_progress" && right.status !== "in_progress") return -1;
        if (right.status === "in_progress" && left.status !== "in_progress") return 1;
        return Date.parse(left.scheduled_start_at) - Date.parse(right.scheduled_start_at);
      });

    const visit = visits[0];
    if (!visit) return { mode: "plan" };
    if (visit.status === "in_progress") {
      return { mode: "finish", visitId: visit.id, scheduledAt: visit.scheduled_start_at };
    }

    const { error: startError } = await supabase.rpc("start_field_visit", { target_visit_id: visit.id });
    if (startError) throw startError;
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/field");
    revalidatePath(`/dashboard/pharmacies/${brandPharmacyId}`);
    return {
      mode: "started",
      visitId: visit.id,
      scheduledAt: visit.scheduled_start_at,
      message: "Visite démarrée.",
    };
  } catch (error) {
    return {
      mode: "error",
      message: error instanceof Error ? error.message : "Impossible de charger la visite.",
    };
  }
}
