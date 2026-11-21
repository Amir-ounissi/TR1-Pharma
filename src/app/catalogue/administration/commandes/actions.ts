"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";

const uuid = z.uuid();
const reference = z.string().trim().max(500);

function finish(message: string): never {
  revalidatePath("/catalogue/administration/commandes");
  revalidatePath("/catalogue/administration");
  revalidatePath("/catalogue/mes-demandes");
  redirect("/catalogue/administration/commandes?succes=" + encodeURIComponent(message));
}

export async function saveAgentMandate(formData: FormData) {
  const input = z.object({
    brand_id: uuid,
    commission_rate: z.coerce.number().min(0).max(100),
    contract_reference: z.string().trim().max(500),
  }).parse({
    brand_id: formData.get("brand_id"),
    commission_rate: formData.get("commission_rate"),
    contract_reference: formData.get("contract_reference") ?? "",
  });
  const verified = formData.get("verified") === "true";
  if (verified && input.contract_reference.length < 8) {
    throw new Error("Un mandat vérifié nécessite une référence contractuelle documentée.");
  }
  const { supabase, userId } = await requirePlatformAdmin();
  const { error } = await supabase.from("private_catalog_agent_mandates").upsert({
    ...input,
    first_order: formData.get("first_order") === "true",
    repeat_order: formData.get("repeat_order") === "true",
    direct_repeat: formData.get("direct_repeat") === "true",
    verified,
    verified_at: verified ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }, { onConflict: "brand_id" });
  if (error) throw new Error("Mandat non enregistré : " + error.message);
  finish("mandat");
}

/** L'attribution client conditionne les commissions sur les réassorts directs. */
export async function saveAgentClientAttribution(formData: FormData) {
  const input = z.object({
    brand_id: uuid,
    pharmacy_id: uuid,
    attribution_reference: z.string().trim().max(500),
  }).parse({
    brand_id: formData.get("brand_id"),
    pharmacy_id: formData.get("pharmacy_id"),
    attribution_reference: formData.get("attribution_reference") ?? "",
  });
  const verified = formData.get("verified") === "true";
  if (verified && input.attribution_reference.length < 8) {
    throw new Error("La pharmacie ne peut être attribuée sans justificatif écrit.");
  }
  const { supabase, userId } = await requirePlatformAdmin();
  const { error } = await supabase.from("private_catalog_agent_accounts").upsert({
    ...input,
    verified,
    verified_at: verified ? new Date().toISOString() : null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "brand_id,pharmacy_id" });
  if (error) throw new Error("Attribution non enregistrée : " + error.message);
  finish("attribution");
}

/** A laboratory contact is deliberately not used for auto-send.
 * Only a manually verified email can appear in an agent-created mail draft.
 */
export async function saveSupplierDispatchContact(formData: FormData) {
  const input=z.object({
    supplier_id:uuid,
    contact_name:z.string().trim().max(160),
    contact_email:z.email().max(254),
    verification_source:z.string().trim().max(500),
  }).parse({
    supplier_id:formData.get("supplier_id"),
    contact_name:formData.get("contact_name")??"",
    contact_email:formData.get("contact_email"),
    verification_source:formData.get("verification_source")??"",
  });
  const verified=formData.get("verified")==="true";
  if(verified && input.verification_source.length<8) {
    throw new Error("Une preuve du contact laboratoire est requise (8 caractères minimum).");
  }
  const { supabase,userId }=await requirePlatformAdmin();
  const {error}=await supabase.from("private_catalog_supplier_contacts").upsert({
    ...input,verified,
    verified_at:verified?new Date().toISOString():null,
    updated_at:new Date().toISOString(),updated_by:userId,
  },{onConflict:"supplier_id"});
  if(error)throw new Error("Contact laboratoire non enregistré : "+error.message);
  finish("contact");
}

/** Tracks real supplier proofs; no synthetic delivery or automatic dispatch. */
export async function recordSupplierShipment(formData: FormData) {
  const input=z.object({
    request_id:uuid,
    event:z.enum(["shipped","delivered"]),
    reference:z.string().trim().min(6).max(500),
    carrier:z.string().trim().max(120),
    expected_delivery_date:z.union([z.iso.date(),z.literal("")]),
  }).parse({
    request_id:formData.get("request_id"),
    event:formData.get("event"),
    reference:formData.get("reference"),
    carrier:formData.get("carrier")??"",
    expected_delivery_date:formData.get("expected_delivery_date")??"",
  });
  if(input.event==="shipped" && input.expected_delivery_date &&
    input.expected_delivery_date<new Date().toISOString().slice(0,10)) {
    throw new Error("La date de livraison prévue ne peut pas être passée.");
  }
  const {supabase}=await requirePlatformAdmin();
  const {error}=await supabase.rpc("catalogue_admin_record_supplier_delivery",{
    p_request_id:input.request_id,
    p_event:input.event,
    p_reference:input.reference,
    p_carrier:input.event==="shipped"?(input.carrier||null):null,
    p_expected_delivery_date:input.event==="shipped"?(input.expected_delivery_date||null):null,
  });
  if(error)throw new Error("Livraison non enregistrée : "+error.message);
  finish(input.event==="shipped"?"expedition":"livraison");
}

export async function advanceSupplierRequest(formData: FormData) {
  const input = z.object({
    request_id: uuid,
    next_status: z.enum(["verifying","forwarded","confirmed","closed","declined"]),
    reference: reference,
  }).parse({
    request_id: formData.get("request_id"),
    next_status: formData.get("next_status"),
    reference: formData.get("reference") ?? "",
  });
  if (["forwarded","confirmed"].includes(input.next_status) && input.reference.length < 6) {
    throw new Error("Renseignez une preuve ou référence fournisseur de 6 caractères minimum.");
  }
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("catalogue_admin_transition_supplier_request", {
    p_request_id: input.request_id,
    p_next_status: input.next_status,
    p_reference: input.reference || null,
  });
  if (error) throw new Error("Le suivi fournisseur n'a pas été actualisé : " + error.message);
  finish("suivi");
}

export async function recordSupplierInvoice(formData: FormData) {
  const input = z.object({
    brand_id: uuid,
    pharmacy_id: uuid,
    origin: z.enum(["catalogue","direct"]),
    sale_kind: z.enum(["initial","reorder"]),
    invoice_ref: z.string().trim().min(4).max(120),
    invoice_date: z.iso.date(),
    amount_ht: z.coerce.number().positive().max(100000000),
    evidence: z.string().trim().min(8).max(500),
  }).parse({
    brand_id: formData.get("brand_id"),
    pharmacy_id: formData.get("pharmacy_id"),
    origin: formData.get("origin"),
    sale_kind: formData.get("sale_kind"),
    invoice_ref: formData.get("invoice_ref"),
    invoice_date: formData.get("invoice_date"),
    amount_ht: formData.get("amount_ht"),
    evidence: formData.get("evidence"),
  });
  const request = String(formData.get("request_id") ?? "");
  const requestId = request ? uuid.parse(request) : null;
  if ((input.origin === "catalogue") !== Boolean(requestId)) {
    throw new Error("Sélectionnez une commande catalogue confirmée, ou un réassort direct.");
  }
  if (input.origin === "direct" && input.sale_kind !== "reorder") {
    throw new Error("Les ventes directes sans commande catalogue sont enregistrées en réassort.");
  }
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("catalogue_admin_record_supplier_invoice", {
    p_brand_id: input.brand_id,
    p_pharmacy_id: input.pharmacy_id,
    p_request_id: requestId,
    p_origin: input.origin,
    p_sale_kind: input.sale_kind,
    p_invoice_ref: input.invoice_ref,
    p_invoice_date: input.invoice_date,
    p_amount_ht: input.amount_ht,
    p_evidence: input.evidence,
  });
  if (error) throw new Error("Commission non enregistrée : " + error.message);
  finish("commission");
}

export async function advanceCommissionSettlement(formData: FormData) {
  const input = z.object({
    commission_id: uuid,
    next_status: z.enum(["billed","paid"]),
    reference: z.string().trim().min(4).max(120),
  }).parse({
    commission_id: formData.get("commission_id"),
    next_status: formData.get("next_status"),
    reference: formData.get("reference"),
  });
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("catalogue_admin_set_commission_status", {
    p_commission_id: input.commission_id,
    p_next_status: input.next_status,
    p_reference: input.reference,
  });
  if (error) throw new Error("Règlement non enregistré : " + error.message);
  finish("reglement");
}
