"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {requireOwner} from "@/lib/auth";

export async function saveBrandImplantationAction(form:FormData){
  const data=z.object({
    pharmacy_id:z.uuid(),
    brand_id:z.uuid(),
    status:z.enum(["implanted","not_implanted","unconfirmed"]),
    source_reference:z.string().trim().max(400),
    owner_notes:z.string().trim().max(1500),
  }).parse({
    pharmacy_id:form.get("pharmacy_id"),
    brand_id:form.get("brand_id"),
    status:form.get("status"),
    source_reference:form.get("source_reference")??"",
    owner_notes:form.get("owner_notes")??"",
  });
  if(data.status==="implanted"&&data.source_reference.length<5)
    throw new Error("L'implantation doit être justifiée par un document, une commande ou une confirmation terrain.");
  const {db}=await requireOwner();
  const {error}=await db.from("pharmacy_brand_relationships").upsert({
    pharmacy_id:data.pharmacy_id,brand_id:data.brand_id,status:data.status,
    source_reference:data.source_reference||null,
    owner_notes:data.owner_notes||null,
    implanted_at:data.status==="implanted"?new Date().toISOString().slice(0,10):null,
    updated_at:new Date().toISOString(),
  },{onConflict:"pharmacy_id,brand_id"});
  if(error)throw new Error("Statut d'implantation non sauvegardé : "+error.message);
  revalidatePath("/app/implantations");
  revalidatePath("/catalogue");
  revalidatePath("/catalogue/mes-marques");
  revalidatePath("/catalogue/decouvrir");
  redirect("/app/implantations?pharmacie="+data.pharmacy_id+"&enregistre=1");
}
export async function updateDirectoryVisibilityAction(form:FormData){
  const data=z.object({brand_id:z.uuid(),discoverable:z.enum(["true","false"])}).parse({
    brand_id:form.get("brand_id"),discoverable:form.get("discoverable"),
  });
  const {db}=await requireOwner();
  const {error}=await db.from("brand_discovery_directory")
    .update({discoverable:data.discoverable==="true",updated_at:new Date().toISOString()})
    .eq("brand_id",data.brand_id);
  if(error)throw new Error("Modification de visibilité refusée : "+error.message);
  revalidatePath("/app/implantations");
  revalidatePath("/catalogue/decouvrir");
  redirect("/app/implantations?visibilite=1");
}
export async function updateInterestStatusAction(form:FormData){
  const data=z.object({
    interest_id:z.uuid(),
    status:z.enum(["received","under_review","closed"]),
  }).parse({interest_id:form.get("interest_id"),status:form.get("status")});
  const {db}=await requireOwner();
  const {error}=await db.from("brand_referencing_interests").update({
    status:data.status,updated_at:new Date().toISOString(),
  }).eq("id",data.interest_id);
  if(error)throw new Error("Suivi de la demande non enregistré : "+error.message);
  revalidatePath("/app/implantations");
  redirect("/app/implantations?demande=1");
}
