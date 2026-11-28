"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {createServerSupabase} from "@/lib/supabase/server";
const tokenSchema=z.string().regex(/^[a-f0-9]{64}$/);
export async function submitPublicCatalogueRequestAction(form:FormData){
 const token=tokenSchema.safeParse(form.get("token"));
 if(!token.success)redirect("/vitrine");
 const base="/vitrine/prive/"+token.data;
 const p=z.object({contact_name:z.string().trim().min(2).max(120),email:z.email().max(254),phone:z.string().trim().max(30),city:z.string().trim().max(120),note:z.string().trim().max(1500),items_json:z.string().min(2).max(20000),website:z.string().max(200)}).safeParse(Object.fromEntries(["contact_name","email","phone","city","note","items_json","website"].map(k=>[k,form.get(k)??""])));
 if(!p.success)redirect(base+"?erreur=coordonnees#transmission");
 if(p.data.website)redirect(base+"?erreur=coordonnees");
 let raw:unknown;try{raw=JSON.parse(p.data.items_json);}catch{redirect(base+"?erreur=panier");}
 const items=z.array(z.object({product_id:z.uuid(),quantity:z.number().int().min(1).max(5000)})).min(1).max(100).safeParse(raw);
 if(!items.success||new Set(items.data.map(x=>x.product_id)).size!==items.data.length)redirect(base+"?erreur=panier");
 const db=await createServerSupabase();if(!db)redirect(base+"?erreur=indisponible");
 const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user?.email||user.email.toLowerCase()!==p.data.email.toLowerCase())redirect(base+"?erreur=connexion#transmission");
 const {error}=await db.rpc("submit_catalogue_link_request",{p_token:token.data,p_contact_name:p.data.contact_name,p_email:p.data.email,p_phone:p.data.phone||null,p_city:p.data.city||null,p_note:p.data.note||null,p_items:items.data,p_honeypot:""});
 if(error)redirect(base+"?erreur=conditions");
 revalidatePath("/app/catalogue-public");revalidatePath("/app");redirect(base+"/merci?envoye=1");
}
export async function submitBrandInterest(form:FormData){
 const submittedSlugs=form.getAll("brand_slugs").filter((value):value is string=>typeof value==="string").slice(0,20);
 const selectionQuery=submittedSlugs.length?"&marques="+encodeURIComponent(submittedSlugs.join(",")):"";
 const p=z.object({
  brand_slugs:z.array(z.string().min(1).max(100)).min(1).max(20).refine(values=>new Set(values).size===values.length),
  pharmacy_name:z.string().trim().min(2).max(180),
  contact_name:z.string().trim().min(2).max(120),
  email:z.email().max(254),
  city:z.string().trim().min(2).max(120),
  note:z.string().trim().max(1500),
  website:z.string().max(200),
 }).safeParse({
  brand_slugs:form.getAll("brand_slugs"),
  pharmacy_name:form.get("pharmacy_name")??"",
  contact_name:form.get("contact_name")??"",
  email:form.get("email")??"",
  city:form.get("city")??"",
  note:form.get("note")??"",
  website:form.get("website")??"",
 });
 if(!p.success)redirect("/vitrine?erreur=contact"+selectionQuery+"#contact");
 if(p.data.website)redirect("/vitrine?envoye=1#contact");
 const db=await createServerSupabase();if(!db)redirect("/vitrine?erreur=contact#contact");
 const {error}=await db.rpc("submit_public_brand_interests",{
  p_brand_slugs:p.data.brand_slugs,
  p_pharmacy_name:p.data.pharmacy_name,
  p_contact_name:p.data.contact_name,
  p_email:p.data.email,
  p_city:p.data.city,
  p_note:p.data.note||null,
  p_honeypot:"",
 });
 if(error)redirect("/vitrine?erreur=contact"+selectionQuery+"#contact");
 revalidatePath("/app/catalogue-public");
 revalidatePath("/app");
 redirect("/vitrine?envoye=1#contact");
}
