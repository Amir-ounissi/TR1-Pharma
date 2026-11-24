"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireVitaloraDemo } from "@/lib/vitalora-demo";

export async function setDemoCartItemAction(form:FormData) {
  const parsed=z.object({
    product_id:z.uuid(),
    quantity:z.coerce.number().int().min(0).max(500),
  }).safeParse({product_id:form.get("product_id"),quantity:form.get("quantity")});
  if(!parsed.success) redirect("/catalogue/demo?erreur=quantite");
  const {db,pharmacyId}=await requireVitaloraDemo();
  if(!pharmacyId) redirect("/catalogue/demo?erreur=acces");
  const {error}=await db.rpc("demo_set_cart_item",{
    p_pharmacy_id:pharmacyId,
    p_product_id:parsed.data.product_id,
    p_quantity:parsed.data.quantity,
  });
  if(error) redirect("/catalogue/demo?erreur=conditions");
  revalidatePath("/catalogue/demo");
  revalidatePath("/catalogue/demo/panier");
  redirect("/catalogue/demo/panier?ajoute=1");
}

export async function removeDemoCartItemAction(form:FormData) {
  const result=z.uuid().safeParse(form.get("product_id"));
  if(!result.success)redirect("/catalogue/demo/panier?erreur=1");
  const {db,pharmacyId}=await requireVitaloraDemo();
  if(!pharmacyId)redirect("/catalogue/demo?erreur=acces");
  const {error}=await db.rpc("demo_set_cart_item",{
    p_pharmacy_id:pharmacyId,p_product_id:result.data,p_quantity:0,
  });
  if(error)redirect("/catalogue/demo/panier?erreur=1");
  revalidatePath("/catalogue/demo/panier");
  redirect("/catalogue/demo/panier?retire=1");
}

export async function checkoutDemoAction() {
  const {db,pharmacyId,brandId}=await requireVitaloraDemo();
  if(!pharmacyId)redirect("/catalogue/demo?erreur=acces");
  const {error}=await db.rpc("demo_checkout",{
    p_pharmacy_id:pharmacyId,p_brand_id:brandId,
  });
  if(error)redirect("/catalogue/demo/panier?erreur=1");
  revalidatePath("/catalogue/demo/panier");
  revalidatePath("/catalogue/demo/demandes");
  revalidatePath("/app/demo");
  redirect("/catalogue/demo/demandes?simulee=1");
}
