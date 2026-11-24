"use server";
import { requireOwner } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
const kinds=["commission","implantation","animation","formation","forfait","other"] as const;
const date=z.iso.date();
const fields=(form:FormData,keys:string[])=>Object.fromEntries(keys.map(k=>[k,form.get(k)??""]));
export async function addRevenueEntry(form:FormData){
 const {db}=await requireOwner();
 const parsed=z.object({brand_id:z.uuid(),pharmacy_id:z.union([z.uuid(),z.literal("")]),kind:z.enum(kinds),title:z.string().trim().min(3).max(180),source_ref:z.string().trim().min(3).max(300),event_date:date,amount_ht:z.coerce.number().positive().max(9999999999.99).refine(n=>Math.abs(n*100-Math.round(n*100))<0.0001)}).safeParse(fields(form,["brand_id","pharmacy_id","kind","title","source_ref","event_date","amount_ht"]));
 if(!parsed.success)redirect("/app/revenus/registre?erreur=creation");
 const data=parsed.data;
 const {error}=await db.from("tr1_revenue_entries").insert({...data,pharmacy_id:data.pharmacy_id||null});
 if(error)redirect("/app/revenus/registre?erreur="+(error.code==="23505"?"doublon":"creation"));
 revalidatePath("/app/revenus/registre");redirect("/app/revenus/registre?ok=1");
}
export async function advanceRevenueEntry(form:FormData){
 const {db}=await requireOwner();
 const parsed=z.object({id:z.uuid(),next:z.enum(["acquired","invoiced","paid","cancelled"]),reference:z.string().trim().min(3).max(300),event_date:z.union([date,z.literal("")])}).safeParse(fields(form,["id","next","reference","event_date"]));
 if(!parsed.success)redirect("/app/revenus/registre?erreur=transition");
 const data=parsed.data;
 const expected={acquired:"estimated",invoiced:"acquired",paid:"invoiced",cancelled:"estimated"}[data.next];
 if(data.next!=="cancelled"&&!data.event_date)redirect("/app/revenus/registre?erreur=transition");
 const patch=data.next==="acquired"?{status:data.next,acquired_on:data.event_date,acquisition_ref:data.reference}:data.next==="invoiced"?{status:data.next,invoiced_on:data.event_date,invoice_ref:data.reference}:data.next==="paid"?{status:data.next,paid_on:data.event_date,payment_ref:data.reference}:{status:data.next,cancelled_ref:data.reference};
 const {data:changed,error}=await db.from("tr1_revenue_entries").update(patch).eq("id",data.id).eq("status",expected).select("id").maybeSingle();
 if(error||!changed)redirect("/app/revenus/registre?erreur=transition");
 revalidatePath("/app/revenus/registre");redirect("/app/revenus/registre?ok=1");
}
