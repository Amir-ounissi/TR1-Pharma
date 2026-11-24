"use server";

import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requirePharmacy} from "@/lib/auth";

export async function requestBrandIntroductionAction(form:FormData) {
  const result=z.object({
    brand_id:z.uuid(),
    note:z.string().trim().max(800),
  }).safeParse({
    brand_id:form.get("brand_id"),
    note:form.get("note")??"",
  });
  if(!result.success) redirect("/catalogue/decouvrir?erreur=donnees");
  const {db}=await requirePharmacy();
  const {error}=await db.rpc("submit_brand_referencing_interest",{
    p_brand_id:result.data.brand_id,
    p_note:result.data.note||null,
  });
  if(error) redirect("/catalogue/decouvrir?erreur=acces");
  revalidatePath("/catalogue");
  revalidatePath("/catalogue/decouvrir");
  revalidatePath("/app/implantations");
  redirect("/catalogue/decouvrir?demande=1");
}
