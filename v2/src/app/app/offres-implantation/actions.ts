"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {requireOwner} from "@/lib/auth";

const optNumber=(max:number,integer=false)=>z.preprocess(
  x=>x===""||x==null?null:x,
  integer?z.coerce.number().int().min(1).max(max).nullable():z.coerce.number().min(0).max(max).nullable()
);
function parseOffer(form:FormData){
 const data=z.object({
   brand_id:z.uuid(),title:z.string().trim().min(4).max(150),
   offer_kind:z.enum(["flexible","quantity_tier","fixed_pack"]),
   summary:z.string().trim().max(1400),
   min_distinct_references:optNumber(300,true),
   min_units_per_reference:optNumber(10000,true),
   free_units_per_reference:z.coerce.number().int().min(0).max(5000),
   min_total_paid_units:optNumber(200000,true),
   min_order_ht:optNumber(99999999),fixed_pack_ht:optNumber(99999999),
   discount_pct:optNumber(100),
   offer_conditions:z.string().trim().max(2400),
   plv_commitment:z.string().trim().max(1400),
   training_commitment:z.string().trim().max(1400),
   shipping_terms:z.string().trim().max(1400),
   source_reference:z.string().trim().max(600),
   confirmation_reference:z.string().trim().max(600),
   valid_from:z.union([z.iso.date(),z.literal("")]),
   valid_until:z.union([z.iso.date(),z.literal("")]),
 }).parse(Object.fromEntries([
   "brand_id","title","offer_kind","summary","min_distinct_references","min_units_per_reference",
   "free_units_per_reference","min_total_paid_units","min_order_ht","fixed_pack_ht",
   "discount_pct","offer_conditions","plv_commitment","training_commitment",
   "shipping_terms","source_reference","confirmation_reference","valid_from","valid_until",
 ].map(key=>[key,form.get(key)??""])));
 if(data.offer_kind!=="fixed_pack"&&data.fixed_pack_ht!==null)
   throw new Error("Le prix fixe ne concerne que les packs prédéfinis.");
 if(data.valid_from&&data.valid_until&&data.valid_from>data.valid_until)
   throw new Error("Dates de validité incohérentes.");
 return {
   ...data,summary:data.summary||null,offer_conditions:data.offer_conditions||null,
   plv_commitment:data.plv_commitment||null,training_commitment:data.training_commitment||null,
   shipping_terms:data.shipping_terms||null,source_reference:data.source_reference||null,
   confirmation_reference:data.confirmation_reference||null,
   valid_from:data.valid_from||null,valid_until:data.valid_until||null,
   pilot_visible:form.get("pilot_visible")==="yes",
   verification_status:"draft",published:false,updated_at:new Date().toISOString(),
 };
}
export async function saveImplantationOfferAction(form:FormData){
 const {db}=await requireOwner();
 const data=parseOffer(form);
 const offerId=form.get("offer_id");
 if(offerId){
   const id=z.uuid().parse(offerId);
   const {data:existing,error:lookupError}=await db.from("brand_implantation_offers")
     .select("brand_id").eq("id",id).single();
   if(lookupError||!existing||existing.brand_id!==data.brand_id)
     throw new Error("Une offre existante ne peut pas changer de marque. Crée une nouvelle offre.");
 }
 const result=offerId
   ? await db.from("brand_implantation_offers").update(data).eq("id",z.uuid().parse(offerId))
   : await db.from("brand_implantation_offers").insert(data);
 if(result.error)throw new Error("Enregistrement impossible : "+result.error.message);
 revalidatePath("/app/offres-implantation");
 revalidatePath("/catalogue/decouvrir");
 redirect("/app/offres-implantation?sauvegarde=1");
}
export async function confirmImplantationOfferAction(form:FormData){
 const {db}=await requireOwner();
 const id=z.uuid().parse(form.get("offer_id"));
 const reference=z.string().trim().min(6).max(600).parse(form.get("confirmation_reference"));
 const publish=form.get("publish")==="yes";
 const {data:offer,error}=await db.from("brand_implantation_offers")
   .select("brand_id,source_reference,offer_kind,fixed_pack_ht,valid_until").eq("id",id).single();
 if(error||!offer||!offer.source_reference||offer.source_reference.trim().length<5)
   throw new Error("Document source obligatoire avant validation.");
 if(offer.valid_until&&offer.valid_until<new Date().toISOString().slice(0,10))
   throw new Error("Offre périmée : validation refusée.");
 const {data:lines,error:lineError}=await db.from("brand_implantation_offer_lines")
   .select("product_id").eq("offer_id",id);
 if(lineError)throw new Error("Composition du pack indisponible.");
 if(publish){
   if(offer.offer_kind==="fixed_pack"&&(offer.fixed_pack_ht===null||!lines?.length))
     throw new Error("Renseigne le montant HT et les références d'un pack fixe avant sa publication.");
   const {data:b}=await db.from("brands").select("slug").eq("id",offer.brand_id).single();
   if(b?.slug==="noto")throw new Error("Publication Nōto suspendue dans l'attente de la validation réglementaire.");
   if(lines?.length){
     const {data:risk,error:riskError}=await db.from("althesia_product_specs")
       .select("product_id").in("product_id",lines.map(x=>x.product_id))
       .eq("market_status","food_cbd_blocked");
     if(riskError||risk?.length)throw new Error("Pack contenant des produits soumis à contrôle réglementaire.");
   }
 }
 const {error:up}=await db.from("brand_implantation_offers").update({
   confirmation_reference:reference,verification_status:"verified",
   published:publish,updated_at:new Date().toISOString()
 }).eq("id",id);
 if(up)throw new Error("Validation impossible : "+up.message);
 revalidatePath("/app/offres-implantation");
 revalidatePath("/catalogue/decouvrir");
 redirect("/app/offres-implantation?validee=1");
}
export async function addImplantationPackLineAction(form:FormData){
 const {db}=await requireOwner();
 const line=z.object({
   offer_id:z.uuid(),product_id:z.uuid(),
   paid_units:z.coerce.number().int().min(1).max(10000),
   free_units:z.coerce.number().int().min(0).max(5000),
   line_note:z.string().trim().max(400),
 }).parse({
   offer_id:form.get("offer_id"),product_id:form.get("product_id"),
   paid_units:form.get("paid_units"),free_units:form.get("free_units")??"0",
   line_note:form.get("line_note")??"",
 });
 const {data:o}=await db.from("brand_implantation_offers").select("brand_id,published").eq("id",line.offer_id).single();
 const {data:p}=await db.from("products").select("brand_id").eq("id",line.product_id).single();
 if(!o||!p||o.brand_id!==p.brand_id)throw new Error("Le produit ne correspond pas à la marque.");
 if(o.published)throw new Error("Dépublier l'offre avant de modifier sa composition.");
 const {error}=await db.from("brand_implantation_offer_lines").upsert({
   ...line,line_note:line.line_note||null
 },{onConflict:"offer_id,product_id"});
 if(error)throw new Error("Ligne de pack non sauvegardée : "+error.message);
 revalidatePath("/app/offres-implantation");
 redirect("/app/offres-implantation?ligne=1");
}
export async function removeImplantationPackLineAction(form:FormData){
 const {db}=await requireOwner();
 const offerId=z.uuid().parse(form.get("offer_id"));
 const productId=z.uuid().parse(form.get("product_id"));
 const {data:o}=await db.from("brand_implantation_offers").select("published").eq("id",offerId).single();
 if(o?.published)throw new Error("Dépublier l'offre avant suppression d'une ligne.");
 const {error}=await db.from("brand_implantation_offer_lines").delete()
   .eq("offer_id",offerId).eq("product_id",productId);
 if(error)throw new Error("Suppression impossible : "+error.message);
 revalidatePath("/app/offres-implantation");
 redirect("/app/offres-implantation?ligne=1");
}
