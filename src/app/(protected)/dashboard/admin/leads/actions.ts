"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { canTransitionLead, leadStatuses, pilotPreparationSchema, type LeadStatus } from "@/lib/marketing/leads";

const databaseUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export async function updateLeadAction(formData: FormData) {
  const parsed = z.object({
    leadId: z.uuid(),
    status: z.enum(leadStatuses),
    assignedTo: z.union([databaseUuid, z.literal("")]),
    nextActionAt: z.string().optional(),
    internalNotes: z.string().trim().max(4000).optional(),
  }).parse(Object.fromEntries(formData));
  const { supabase } = await requirePlatformAdmin();
  const { data: lead } = await supabase.from("commercial_leads").select("status").eq("id", parsed.leadId).single();
  if (!lead || !canTransitionLead(lead.status as LeadStatus, parsed.status)) throw new Error("Transition de lead non autorisée.");
  const { error } = await supabase.from("commercial_leads").update({
    status: parsed.status,
    assigned_to: parsed.assignedTo || null,
    next_action_at: parsed.nextActionAt || null,
    internal_notes: parsed.internalNotes || null,
    archived_at: parsed.status === "archived" ? new Date().toISOString() : null,
  }).eq("id", parsed.leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/leads");
  revalidatePath(`/dashboard/admin/leads/${parsed.leadId}`);
}

export async function preparePilotAction(formData: FormData) {
  const parsed = pilotPreparationSchema.parse(Object.fromEntries(formData));
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("prepare_pilot_project", {
    target_lead_id: parsed.leadId,
    proposed_organization_name: parsed.proposedOrganizationName,
    proposed_brand_name: parsed.proposedBrandName,
    country_or_scope: parsed.countryOrScope || "FR",
    estimated_users: parsed.estimatedUsers === "" ? null : parsed.estimatedUsers,
    proposed_start_date: parsed.proposedStartDate || null,
    confirmation: true,
  });
  if (error) throw new Error(error.message);
  redirect(`/dashboard/admin/leads/${parsed.leadId}?pilot=${data}`);
}

export async function approvePilotAction(formData: FormData) {
  const parsed = z.object({ pilotId: z.uuid(), leadId: z.uuid(), confirmation: z.literal("true") }).parse(Object.fromEntries(formData));
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("approve_pilot_project", { target_pilot_id: parsed.pilotId, confirmation: true });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/leads");
  redirect(`/dashboard/admin/leads/${parsed.leadId}?onboarding=created`);
}
