"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requirePharmacy} from "@/lib/auth";

export async function requestSpecificImplantationOfferAction(form:FormData){
 const input=z.object({offer_id:z.uuid(),note:z.string().trim().max(800)})
   .safeParse({offer_id:form.get("offer_id"),note:form.get("note")??""});
 if(!input.success)redirect("/catalogue/decouvrir?erreur=donnees");
 const {db}=await requirePharmacy();
 const {error}=await db.rpc("request_brand_implantation_offer",{
   p_offer_id:input.data.offer_id,p_note:input.data.note||null,
 });
 if(error)redirect("/catalogue/decouvrir?erreur=acces");
 revalidatePath("/app/implantations");
 revalidatePath("/catalogue/decouvrir");
 redirect("/catalogue/decouvrir?demande=1");
}
