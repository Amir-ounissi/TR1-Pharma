"use server";
import {z} from "zod";
import {requireOwner,requirePharmacy} from "@/lib/auth";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
const cats=["question","appointment","animation","training","resources","implantation","reorder","delivery","claim","other"] as const;
const fields=(form:FormData,keys:string[])=>Object.fromEntries(keys.map(k=>[k,form.get(k)??""]));
const reply=z.object({request_id:z.uuid(),body:z.string().trim().min(1).max(4000)});
function refresh(){revalidatePath("/catalogue/contact");revalidatePath("/app/relation-client");revalidatePath("/app");}
export async function createSupportRequest(form:FormData){
 const {db}=await requirePharmacy();
 const p=z.object({pharmacy_id:z.uuid(),category:z.enum(cats),subject:z.string().trim().min(3).max(180),brand_label:z.string().trim().max(120),body:z.string().trim().min(3).max(4000)}).safeParse(fields(form,["pharmacy_id","category","subject","brand_label","body"]));
 if(!p.success)redirect("/catalogue/contact?erreur=1");
 const {error}=await db.from("pharmacy_support_requests").insert({...p.data,brand_label:p.data.brand_label||null});
 if(error)redirect("/catalogue/contact?erreur=1");refresh();redirect("/catalogue/contact?ok=1");
}
export async function pharmacyReply(form:FormData){
 const {db}=await requirePharmacy();const p=reply.safeParse(fields(form,["request_id","body"]));
 if(!p.success)redirect("/catalogue/contact?erreur=1");
 const {error}=await db.from("pharmacy_support_messages").insert({...p.data,sender_role:"pharmacy"});
 if(error)redirect("/catalogue/contact?erreur=1");refresh();redirect("/catalogue/contact?ok=1#"+p.data.request_id);
}
export async function ownerReply(form:FormData){
 const {db}=await requireOwner();const p=reply.safeParse(fields(form,["request_id","body"]));
 if(!p.success)redirect("/app/relation-client?erreur=1");
 const {error}=await db.from("pharmacy_support_messages").insert({...p.data,sender_role:"owner"});
 if(error)redirect("/app/relation-client?erreur=1");refresh();redirect("/app/relation-client?ok=1#"+p.data.request_id);
}
export async function updateSupportStatus(form:FormData){
 const {db}=await requireOwner();const p=z.object({request_id:z.uuid(),status:z.enum(["received","in_progress","waiting_client","resolved"])}).safeParse(fields(form,["request_id","status"]));
 if(!p.success)redirect("/app/relation-client?erreur=1");
 const {data,error}=await db.from("pharmacy_support_requests").update({status:p.data.status}).eq("id",p.data.request_id).select("id").maybeSingle();
 if(error||!data)redirect("/app/relation-client?erreur=1");refresh();redirect("/app/relation-client?ok=1#"+p.data.request_id);
}
