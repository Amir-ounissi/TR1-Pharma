"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { leadDeduplicationScope, normalizeLeadInput } from "@/lib/marketing/leads";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeadCaptureState = { error?: string; fields?: { fullName?: string; professionalEmail?: string; companyName?: string } };

export async function captureLeadAction(_state: LeadCaptureState, formData: FormData): Promise<LeadCaptureState> {
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

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const salt = process.env.LEAD_CAPTURE_SALT ?? (process.env.NODE_ENV === "production" ? "" : "tr1-local-leads");
  if (!salt) return { error: "Le formulaire est momentanément indisponible.", fields };
  const day = new Date().toISOString().slice(0, 10);
  const digest = (value: string) => createHash("sha256").update(`${salt}:${value}`).digest("hex");
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
  if (error) return { error: "Votre demande n’a pas pu être enregistrée. Réessayez dans quelques minutes.", fields };
  redirect("/merci");
}
