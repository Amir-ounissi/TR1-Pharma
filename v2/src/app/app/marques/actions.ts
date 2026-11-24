"use server";
import {requireOwner} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";

export async function saveBrandPresentationAction(form:FormData) {
  const data=z.object({
    brand_id:z.uuid(),
    short_description:z.string().trim().max(500),
    catalogue_note:z.string().trim().max(1200),
  }).parse({
    brand_id:form.get("brand_id"),
    short_description:form.get("short_description")??"",
    catalogue_note:form.get("catalogue_note")??"",
  });
  const {db}=await requireOwner();
  const {data:brand,error:brandError}=await db.from("brands").select("id")
    .eq("id",data.brand_id).single();
  if(brandError||!brand)throw new Error("Marque introuvable.");
  const {error}=await db.from("brand_discovery_directory").upsert({
    brand_id:data.brand_id,
    short_description:data.short_description||null,
    catalogue_note:data.catalogue_note||null,
    discoverable:form.get("discoverable")==="yes",
    updated_at:new Date().toISOString(),
  },{onConflict:"brand_id"});
  if(error)throw new Error("Présentation de la marque non enregistrée : "+error.message);
  revalidatePath("/app/marques");
  revalidatePath("/app/marques/"+data.brand_id);
  revalidatePath("/catalogue/decouvrir");
  redirect("/app/marques/"+data.brand_id+"?onglet=visibilite&enregistre=1");
}
