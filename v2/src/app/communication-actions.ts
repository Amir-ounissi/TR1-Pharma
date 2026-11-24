"use server";
import {z} from "zod";
import {requireOwner,requirePharmacy} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
const categories=["news","offer","launch","event","training","field_update"] as const;
const resourceTypes=["catalogue","product_sheet","argumentaire","training","plv","other"] as const;
const scopes=["all","implanted","discovery","selected"] as const;
const fields=(form:FormData,keys:string[])=>Object.fromEntries(keys.map(k=>[k,form.get(k)??""]));
const targetIds=(form:FormData)=>form.getAll("target_pharmacy_ids").map(String).filter(Boolean);
const urlOptional=z.string().trim().max(1200).refine(v=>!v||(v.startsWith("https://")||v.startsWith("/catalogue/")),"URL non autorisée");
const urlRequired=z.string().trim().url().refine(v=>v.startsWith("https://"),"Une URL HTTPS est requise");
function invalidate(){for(const p of ["/app/communication","/catalogue","/catalogue/actualites","/catalogue/ressources"])revalidatePath(p);}
export async function createAnnouncement(form:FormData){
 const {db,user}=await requireOwner();
 const parsed=z.object({title:z.string().trim().min(3).max(180),summary:z.string().trim().min(3).max(500),body:z.string().trim().min(3).max(8000),category:z.enum(categories),brand_id:z.union([z.uuid(),z.literal("")]),audience_scope:z.enum(scopes),cover_image_url:urlOptional,cta_label:z.string().trim().max(60),cta_url:urlOptional,status:z.enum(["draft","published"]),starts_on:z.iso.date(),ends_on:z.union([z.iso.date(),z.literal("")])}).safeParse(fields(form,["title","summary","body","category","brand_id","audience_scope","cover_image_url","cta_label","cta_url","status","starts_on","ends_on"]));
 if(!parsed.success)redirect("/app/communication?erreur=annonce");
 const d=parsed.data,targets=targetIds(form);
 if((d.audience_scope==="selected"&&!targets.length)||(d.audience_scope!=="selected"&&targets.length)||(["implanted","discovery"].includes(d.audience_scope)&&!d.brand_id)||(!!d.cta_label!==!!d.cta_url)||(d.ends_on&&d.ends_on<d.starts_on))redirect("/app/communication?erreur=annonce");
 const {error}=await db.from("tr1_announcements").insert({title:d.title,summary:d.summary,body:d.body,category:d.category,brand_id:d.brand_id||null,audience_scope:d.audience_scope,target_pharmacy_ids:targets,cover_image_url:d.cover_image_url||null,cta_label:d.cta_label||null,cta_url:d.cta_url||null,status:d.status,starts_on:d.starts_on,ends_on:d.ends_on||null,created_by:user.id});
 if(error)redirect("/app/communication?erreur=annonce");
 invalidate();redirect("/app/communication?ok=annonce");
}
export async function updateAnnouncementStatus(form:FormData){
 const {db}=await requireOwner();const p=z.object({id:z.uuid(),status:z.enum(["draft","published","archived"])}).safeParse(fields(form,["id","status"]));
 if(!p.success)redirect("/app/communication?erreur=statut");
 const {data,error}=await db.from("tr1_announcements").update({status:p.data.status}).eq("id",p.data.id).select("id").maybeSingle();
 if(error||!data)redirect("/app/communication?erreur=statut");invalidate();redirect("/app/communication?ok=statut");
}
export async function createResource(form:FormData){
 const {db,user}=await requireOwner();
 const parsed=z.object({title:z.string().trim().min(3).max(180),description:z.string().trim().min(3).max(1000),category:z.enum(resourceTypes),brand_id:z.union([z.uuid(),z.literal("")]),audience_scope:z.enum(scopes),resource_url:urlRequired,published:z.enum(["true","false"]),starts_on:z.iso.date(),ends_on:z.union([z.iso.date(),z.literal("")])}).safeParse(fields(form,["title","description","category","brand_id","audience_scope","resource_url","published","starts_on","ends_on"]));
 if(!parsed.success)redirect("/app/communication?erreur=ressource");
 const d=parsed.data,targets=targetIds(form);
 if((d.audience_scope==="selected"&&!targets.length)||(d.audience_scope!=="selected"&&targets.length)||(["implanted","discovery"].includes(d.audience_scope)&&!d.brand_id)||(d.ends_on&&d.ends_on<d.starts_on))redirect("/app/communication?erreur=ressource");
 const {error}=await db.from("tr1_resources").insert({title:d.title,description:d.description,category:d.category,brand_id:d.brand_id||null,audience_scope:d.audience_scope,target_pharmacy_ids:targets,resource_url:d.resource_url,published:d.published==="true",starts_on:d.starts_on,ends_on:d.ends_on||null,created_by:user.id});
 if(error)redirect("/app/communication?erreur=ressource");invalidate();redirect("/app/communication?ok=ressource");
}
export async function updateResourceStatus(form:FormData){
 const {db}=await requireOwner();const p=z.object({id:z.uuid(),published:z.enum(["true","false"])}).safeParse(fields(form,["id","published"]));
 if(!p.success)redirect("/app/communication?erreur=statut");
 const {data,error}=await db.from("tr1_resources").update({published:p.data.published==="true"}).eq("id",p.data.id).select("id").maybeSingle();
 if(error||!data)redirect("/app/communication?erreur=statut");invalidate();redirect("/app/communication?ok=statut");
}
export async function markAnnouncementRead(form:FormData){
 const {db,user}=await requirePharmacy();const id=z.uuid().parse(form.get("announcement_id"));
 const {error}=await db.from("tr1_announcement_reads").upsert({announcement_id:id,user_id:user.id},{onConflict:"announcement_id,user_id",ignoreDuplicates:true});
 if(error)redirect("/catalogue/actualites?erreur=lecture");revalidatePath("/catalogue/actualites");revalidatePath("/catalogue");redirect("/catalogue/actualites?lu=1#"+id);
}
