"use server";
import {z} from "zod";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createServerSupabase} from "@/lib/supabase/server";
export async function requestSupplierEstimate(form:FormData){
 const token=z.string().regex(/^[a-f0-9]{64}$/).safeParse(form.get("token"));
 if(!token.success)redirect("/vitrine");
 const base="/vitrine/prive/"+token.data;
 const p=z.object({contact:z.string().trim().min(2).max(120),email:z.email().max(254),brand_id:z.uuid(),note:z.string().trim().max(500),items:z.string().min(2).max(2000),website:z.string().max(200)}).safeParse(Object.fromEntries(["contact","email","brand_id","note","items","website"].map(k=>[k,form.get(k)??""])));
 if(!p.success||p.data.website)redirect(base+"?devis=erreur#devis");
 let raw:unknown;try{raw=JSON.parse(p.data.items)}catch{redirect(base+"?devis=erreur#devis")}
 const items=z.array(z.object({product_id:z.uuid(),paid:z.number().int().min(1).max(5000)})).min(1).max(5).safeParse(raw);
 if(!items.success||new Set(items.data.map(x=>x.product_id)).size!==items.data.length)redirect(base+"?devis=erreur#devis");
 const db=await createServerSupabase();if(!db)redirect(base+"?devis=erreur#devis");
 const {error}=await db.rpc("submit_structured_invitation_estimate",{p_token:token.data,p_contact:p.data.contact,p_email:p.data.email.toLowerCase().trim(),p_brand_id:p.data.brand_id,p_items:items.data,p_note:p.data.note,p_honeypot:""});
 if(error)redirect(base+"?devis=erreur#devis");
 revalidatePath("/app/catalogue-public");revalidatePath("/app");redirect(base+"?devis=ok#devis");
}
