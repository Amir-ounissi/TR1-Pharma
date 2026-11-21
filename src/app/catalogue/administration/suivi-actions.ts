"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";

const actionSchema = z.object({
  pharmacy_id: z.uuid(),
  brand_id: z.union([z.uuid(), z.literal("")]),
  action_kind: z.enum(["visit","call","email","reorder","animation"]),
  next_action_date: z.iso.date(),
  note: z.string().trim().max(500),
});

export async function planSoloAgentFollowup(formData: FormData) {
  const input = actionSchema.parse({
    pharmacy_id: formData.get("pharmacy_id"),
    brand_id: formData.get("brand_id") ?? "",
    action_kind: formData.get("action_kind"),
    next_action_date: formData.get("next_action_date"),
    note: formData.get("note") ?? "",
  });
  const { supabase, userId } = await requirePlatformAdmin();

  // The chosen pharmacy and brand must exist; no phantom work items.
  const { data: pharmacy, error: pharmacyError } = await supabase
    .from("private_catalog_pharmacies").select("id").eq("id",input.pharmacy_id).maybeSingle();
  if (pharmacyError || !pharmacy) throw new Error("Pharmacie inconnue.");
  if (input.brand_id) {
    const { data: brand, error: brandError } = await supabase
      .from("private_catalog_brands").select("id").eq("id",input.brand_id).maybeSingle();
    if (brandError || !brand) throw new Error("Marque inconnue.");
  }

  const { error } = await supabase.from("private_catalog_agent_followups").insert({
    pharmacy_id: input.pharmacy_id,
    brand_id: input.brand_id || null,
    action_kind: input.action_kind,
    next_action_date: input.next_action_date,
    note: input.note,
    created_by: userId,
    status: "todo",
  });
  if (error) throw new Error("Impossible de planifier cette action : " + error.message);
  revalidatePath("/catalogue/administration");
  redirect("/catalogue/administration?succes=action#actions");
}

export async function completeSoloAgentFollowup(formData: FormData) {
  const id = z.uuid().parse(formData.get("followup_id"));
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.from("private_catalog_agent_followups")
    .update({ status: "done", completed_at: new Date().toISOString(),updated_at:new Date().toISOString() })
    .eq("id", id).eq("status", "todo").select("id").maybeSingle();
  if (error || !data) throw new Error("Cette action est introuvable ou déjà terminée.");
  revalidatePath("/catalogue/administration");
  redirect("/catalogue/administration?succes=terminee#actions");
}
