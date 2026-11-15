"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  catalogueAccessRequestSchema,
  formatCatalogueAccessRequest,
  normalizeCatalogueAccessRequest,
} from "@/lib/marketing/catalogue-access";
import { leadDeduplicationScope } from "@/lib/marketing/leads";
import { readRuntimeEnvironment } from "@/lib/runtime-environment";
import { createAdminClient } from "@/lib/supabase/admin";

type AccessField =
  | "fullName"
  | "role"
  | "professionalEmail"
  | "phone"
  | "pharmacyName"
  | "addressLine"
  | "postalCode"
  | "city"
  | "siret"
  | "finess"
  | "pharmacyConfirmation"
  | "privacyAcknowledged";

export type CatalogueAccessRequestState = {
  error?: string;
  fields?: Partial<Record<AccessField, string>>;
  fieldErrors?: Partial<Record<AccessField, string>>;
};

export async function requestCatalogueAccessAction(
  _state: CatalogueAccessRequestState,
  formData: FormData,
): Promise<CatalogueAccessRequestState> {
  const correlationId = randomUUID();
  const website = String(formData.get("website") ?? "");
  if (website) redirect("/catalogue/demander-acces?confirmation=1");

  const fields = {
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? ""),
    professionalEmail: String(formData.get("professionalEmail") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    pharmacyName: String(formData.get("pharmacyName") ?? ""),
    addressLine: String(formData.get("addressLine") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    city: String(formData.get("city") ?? ""),
    siret: String(formData.get("siret") ?? ""),
    finess: String(formData.get("finess") ?? ""),
    pharmacyConfirmation: String(formData.get("pharmacyConfirmation") ?? ""),
    privacyAcknowledged: String(formData.get("privacyAcknowledged") ?? ""),
    website,
  };

  const validation = catalogueAccessRequestSchema.safeParse(fields);
  if (!validation.success) {
    const errors = validation.error.flatten().fieldErrors;
    return {
      error: "Vérifiez les informations de votre officine avant de transmettre la demande.",
      fields,
      fieldErrors: {
        fullName: errors.fullName?.[0],
        role: errors.role?.[0],
        professionalEmail: errors.professionalEmail?.[0],
        phone: errors.phone?.[0],
        pharmacyName: errors.pharmacyName?.[0],
        addressLine: errors.addressLine?.[0],
        postalCode: errors.postalCode?.[0],
        city: errors.city?.[0],
        siret: errors.siret?.[0],
        finess: errors.finess?.[0],
        pharmacyConfirmation: errors.pharmacyConfirmation?.[0],
        privacyAcknowledged: errors.privacyAcknowledged?.[0],
      },
    };
  }

  const normalized = normalizeCatalogueAccessRequest(validation.data);

  let runtime;
  try {
    runtime = readRuntimeEnvironment();
  } catch {
    console.error(JSON.stringify({ event: "catalogue_access_configuration_error", correlationId }));
    return {
      error: "Le formulaire est momentanément indisponible. Référence : " + correlationId,
      fields,
    };
  }

  if (!runtime.leadCaptureEnabled) {
    return { error: "La réception des demandes est momentanément désactivée.", fields };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const submittedOn = new Date().toISOString().slice(0, 10);
  const digest = (value: string) =>
    createHash("sha256").update(runtime.LEAD_CAPTURE_SALT + ":" + value).digest("hex");
  const deduplicationKey = digest(
    "catalogue_access:" + leadDeduplicationScope(
      normalized.professionalEmail,
      normalized.pharmacyName,
      submittedOn,
    ),
  );
  const rateLimitKey = digest(forwardedFor);

  try {
    const admin = createAdminClient();
    const { data: leadId, error } = await admin.rpc("capture_commercial_lead", {
      lead_full_name: normalized.fullName,
      lead_email: normalized.professionalEmail,
      lead_company_name: normalized.pharmacyName,
      lead_source: "website_catalogue_access",
      lead_deduplication_key: deduplicationKey,
      lead_rate_limit_key: rateLimitKey,
    });

    if (error || !leadId) {
      console.error(JSON.stringify({ event: "catalogue_access_capture_failed", correlationId, code: error?.code }));
      return {
        error: "Votre demande n’a pas pu être enregistrée. Vous pouvez réessayer. Référence : " + correlationId,
        fields,
      };
    }

    const requestDetails = formatCatalogueAccessRequest(normalized, submittedOn);
    const { data: lead, error: readError } = await admin
      .from("commercial_leads")
      .select("internal_notes")
      .eq("id", leadId)
      .single();

    if (readError || !lead) throw new Error("catalogue_access_lead_read_failed");

    const currentNotes = lead.internal_notes as string | null;
    if (!currentNotes?.includes(requestDetails)) {
      const notes = [currentNotes, requestDetails].filter(Boolean).join("\n\n");
      if (notes.length > 4000) throw new Error("catalogue_access_lead_notes_full");

      const update = admin
        .from("commercial_leads")
        .update({ internal_notes: notes })
        .eq("id", leadId);
      const guarded = currentNotes === null
        ? update.is("internal_notes", null)
        : update.eq("internal_notes", currentNotes);
      const { data: updated, error: updateError } = await guarded.select("id");
      if (updateError || !updated?.length) throw new Error("catalogue_access_lead_update_failed");
    }
  } catch {
    console.error(JSON.stringify({ event: "catalogue_access_request_failed", correlationId }));
    return {
      error: "L’envoi n’a pas pu être finalisé. Vos informations sont conservées ci-dessous ; vous pouvez réessayer. Référence : " + correlationId,
      fields,
    };
  }

  redirect("/catalogue/demander-acces?confirmation=1");
}
