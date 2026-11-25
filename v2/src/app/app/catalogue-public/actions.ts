"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";

const transitions: Record<string, string[]> = {
  received: ["verifying", "declined"],
  verifying: ["forwarded", "declined"],
  forwarded: ["confirmed", "declined"],
  confirmed: ["closed"],
  closed: [],
  declined: [],
};

export async function updatePublicCatalogueRequestAction(form: FormData) {
  const parsed = z.object({
    request_id: z.uuid(),
    status: z.enum(["received","verifying","forwarded","confirmed","closed","declined"]),
    admin_note: z.string().trim().max(2000).optional(),
  }).safeParse({
    request_id: form.get("request_id"),
    status: form.get("status"),
    admin_note: form.get("admin_note") ?? "",
  });
  if (!parsed.success) throw new Error("Mise à jour de la demande invalide.");

  const { db } = await requireOwner();
  const { data: current, error: readError } = await db.from("public_catalogue_requests")
    .select("status").eq("id", parsed.data.request_id).single();
  if (readError || !current) throw new Error("Demande publique introuvable.");
  if (parsed.data.status !== current.status && !(transitions[current.status] ?? []).includes(parsed.data.status)) {
    throw new Error("Cette transition de statut n'est pas autorisée.");
  }
  if (parsed.data.status === "forwarded" && form.get("transmission_confirmed") !== "yes") {
    throw new Error("Confirme la transmission réelle à la marque avant de passer ce statut.");
  }

  const update: Record<string, unknown> = {
    status: parsed.data.status, admin_note: parsed.data.admin_note || null,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.status === "forwarded" && current.status !== "forwarded") update.forwarded_at = new Date().toISOString();
  const { error } = await db.from("public_catalogue_requests").update(update).eq("id", parsed.data.request_id);
  if (error) throw new Error("Impossible d'enregistrer le suivi de la demande.");
  revalidatePath("/app/catalogue-public");
  revalidatePath("/app");
}

export async function updateBrandInterestAction(form:FormData){const {db}=await requireOwner();const p=z.object({id:z.uuid(),status:z.enum(["new","contacted","closed"])}).parse({id:form.get("id"),status:form.get("status")});const {data,error}=await db.from("public_catalogue_leads").update({interest_status:p.status}).eq("id",p.id).not("interest_brand_id","is",null).select("id").maybeSingle();if(error||!data)throw new Error("Impossible de mettre à jour la demande.");revalidatePath("/app/catalogue-public");}
