"use server";

import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireOwner} from "@/lib/auth";

const idSchema=z.uuid();
function invalidate(productId:string) {
  revalidatePath("/app/medias");
  revalidatePath("/app/marques");
  revalidatePath("/app/althesia");
  revalidatePath("/app/produits/"+productId);
}
export async function approveProductImageAction(form:FormData) {
  const productId=idSchema.parse(form.get("product_id"));
  const evidence=z.string().trim().min(5).max(500).parse(form.get("evidence"));
  const {db}=await requireOwner();
  const [audited,product]=await Promise.all([
    db.from("product_media_audit")
      .select("candidate_image_url,image_review_status")
      .eq("product_id",productId).maybeSingle(),
    db.from("products").select("id,image_url,published").eq("id",productId).maybeSingle(),
  ]);
  if(audited.error || product.error || !audited.data || !product.data)
    throw new Error("Photo ou fiche produit introuvable.");
  if(audited.data.image_review_status!=="pending")
    throw new Error("Cette photo ne peut plus être confirmée : son état a changé.");
  if(product.data.image_url!==audited.data.candidate_image_url)
    throw new Error("La photo actuelle ne correspond plus au visuel proposé.");
  if(product.data.published)
    throw new Error("Une fiche publiée doit être dépubliée avant modification de la validation.");
  const {data,error}=await db.from("product_media_audit").update({
    image_review_status:"verified",image_confirmed_reference:evidence,
    reviewed_at:new Date().toISOString(),applied_to_draft:true,
  }).eq("product_id",productId).eq("image_review_status","pending")
    .select("product_id").maybeSingle();
  if(error||!data)throw new Error("Validation du visuel impossible.");
  invalidate(productId);
  redirect("/app/medias?statut=attente&confirmation=1");
}
export async function rejectProductImageAction(form:FormData) {
  const productId=idSchema.parse(form.get("product_id"));
  const {db}=await requireOwner();
  const [audited,product]=await Promise.all([
    db.from("product_media_audit").select("candidate_image_url,image_review_status")
      .eq("product_id",productId).maybeSingle(),
    db.from("products").select("id,image_url,published").eq("id",productId).maybeSingle(),
  ]);
  if(audited.error||product.error||!audited.data||!product.data)
    throw new Error("Photo ou fiche produit introuvable.");
  if(audited.data.image_review_status!=="pending")
    throw new Error("Le visuel a déjà été traité.");
  if(product.data.published)throw new Error("La fiche doit être dépubliée.");
  // Do not clear a newer picture that an owner may have uploaded since sourcing.
  if(product.data.image_url===audited.data.candidate_image_url){
    const {error:e}=await db.from("products").update({
      image_url:null,requires_review:true,
    }).eq("id",productId).eq("image_url",audited.data.candidate_image_url);
    if(e)throw new Error("Impossible de retirer le visuel incorrect.");
  }
  const {data,error}=await db.from("product_media_audit").update({
    image_review_status:"rejected",applied_to_draft:false,
    reviewed_at:new Date().toISOString(),
  }).eq("product_id",productId).eq("image_review_status","pending")
    .select("product_id").maybeSingle();
  if(error||!data)throw new Error("Rejet du visuel impossible.");
  invalidate(productId);
  redirect("/app/medias?statut=attente&refus=1");
}
