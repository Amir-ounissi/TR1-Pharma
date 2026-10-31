"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatLeadRequest, leadCaptureSchema, leadDeduplicationScope, normalizeLeadInput } from "@/lib/marketing/leads";
import { readRuntimeEnvironment } from "@/lib/runtime-environment";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadField = "fullName" | "professionalEmail" | "companyName" | "websiteUrl" | "location" | "need";

export type LeadCaptureState = {
  error?: string;
  fields?: Partial<Record<LeadField, string>>;
  fieldErrors?: Partial<Record<LeadField, string>>;
};

export async function captureLeadAction(_state: LeadCaptureState, formData: FormData): Promise<LeadCaptureState> {
  const correlationId = randomUUID();
  const website = String(formData.get("website") ?? "");
  const leadAudience = String(formData.get("leadAudience") ?? "brand") === "pharmacy" ? "pharmacy" : "brand";
  if (website) redirect("/merci");
  const fields = {
    leadAudience,
    fullName: String(formData.get("fullName") ?? ""),
    professionalEmail: String(formData.get("professionalEmail") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    website,
    websiteUrl: String(formData.get("websiteUrl") ?? "").trim(),
    location: String(formData.get("location") ?? ""),
    need: String(formData.get("need") ?? ""),
  };

  const validation = leadCaptureSchema.safeParse(fields);
  if (!validation.success) {
    const flattened = validation.error.flatten().fieldErrors;
    return {
      error: "Vérifiez les champs indiqués avant de continuer.",
      fields,
      fieldErrors: {
        fullName: flattened.fullName?.[0],
        professionalEmail: flattened.professionalEmail?.[0],
        companyName: flattened.companyName ? leadAudience === "pharmacy" ? "Indiquez le nom de votre pharmacie." : flattened.companyName[0] : undefined,
        websiteUrl: flattened.websiteUrl?.[0],
        location: flattened.location?.[0],
        need: flattened.need?.[0],
      },
    };
  }

  const normalized = normalizeLeadInput(validation.data);

  let runtime;
  try {
    runtime = readRuntimeEnvironment();
  } catch {
    console.error(JSON.stringify({ event: "lead_capture_configuration_error", correlationId }));
    return { error: `Le formulaire est momentanément indisponible. Référence : ${correlationId}`, fields };
  }
  if (!runtime.leadCaptureEnabled) return { error: "Le formulaire est momentanément désactivé.", fields };

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const digest = (value: string) => createHash("sha256").update(`${runtime.LEAD_CAPTURE_SALT}:${value}`).digest("hex");
  const deduplicationKey = digest(leadDeduplicationScope(normalized.professionalEmail, normalized.companyName, day));
  const rateLimitKey = digest(forwardedFor);
  try {
    const admin = createAdminClient();
    const { data: leadId, error } = await admin.rpc("capture_commercial_lead", {
      lead_full_name: normalized.fullName,
      lead_email: normalized.professionalEmail,
      lead_company_name: normalized.companyName,
      lead_source: leadAudience === "pharmacy" ? "website_pharmacy" : "website_brand",
      lead_deduplication_key: deduplicationKey,
      lead_rate_limit_key: rateLimitKey,
    });
    if (error || !leadId) {
      console.error(JSON.stringify({ event: "lead_capture_failed", correlationId, code: error?.code }));
      return { error: `Votre demande n’a pas pu être enregistrée. Vos informations sont conservées ci-dessous. Référence : ${correlationId}`, fields };
    }

    // Keep the existing RPC, destination and anti-abuse controls. The existing
    // notes field holds request details; compare-and-set preserves staff edits.
    const requestDetails = formatLeadRequest(validation.data);
    if (requestDetails) {
      const { data: lead, error: readError } = await admin.from("commercial_leads").select("internal_notes").eq("id", leadId).single();
      if (readError || !lead) throw new Error("lead_request_read_failed");
      const currentNotes = lead.internal_notes as string | null;
      if (!currentNotes?.includes(requestDetails)) {
        const notes = [currentNotes, `Demande via le site\n${requestDetails}`].filter(Boolean).join("\n\n");
        if (notes.length > 4000) throw new Error("lead_request_notes_full");
        const update = admin.from("commercial_leads").update({ internal_notes: notes }).eq("id", leadId);
        const guarded = currentNotes === null ? update.is("internal_notes", null) : update.eq("internal_notes", currentNotes);
        const { data: updated, error: updateError } = await guarded.select("id");
        if (updateError || !updated?.length) throw new Error("lead_request_update_failed");
      }
    }
  } catch {
    console.error(JSON.stringify({ event: "lead_capture_request_failed", correlationId }));
    return { error: `L’envoi n’a pas pu être finalisé. Vos informations sont conservées ci-dessous ; vous pouvez réessayer. Référence : ${correlationId}`, fields };
  }
  redirect("/merci");
}
