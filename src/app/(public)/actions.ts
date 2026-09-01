"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { leadDeduplicationScope, normalizeLeadInput } from "@/lib/marketing/leads";
import { readRuntimeEnvironment } from "@/lib/runtime-environment";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeadCaptureState = { error?: string; fields?: { fullName?: string; professionalEmail?: string; companyName?: string } };

export async function captureLeadAction(_state: LeadCaptureState, formData: FormData): Promise<LeadCaptureState> {
  const correlationId = randomUUID();
  const website = String(formData.get("website") ?? "");
  if (website) redirect("/merci");
  const fields = {
    fullName: String(formData.get("fullName") ?? ""),
    professionalEmail: String(formData.get("professionalEmail") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    website,
  };
  let normalized;
  try {
    normalized = normalizeLeadInput(fields);
  } catch {
    return { error: "Vérifiez les trois champs avant de continuer.", fields };
  }

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
  const { error } = await createAdminClient().rpc("capture_commercial_lead", {
    lead_full_name: normalized.fullName,
    lead_email: normalized.professionalEmail,
    lead_company_name: normalized.companyName,
    lead_source: "website",
    lead_deduplication_key: deduplicationKey,
    lead_rate_limit_key: rateLimitKey,
  });
  if (error) {
    console.error(JSON.stringify({ event: "lead_capture_failed", correlationId, code: error.code }));
    return { error: `Votre demande n’a pas pu être enregistrée. Référence : ${correlationId}`, fields };
  }
  redirect("/merci");
}
