"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";

const productIdSchema = z.uuid();
const money = z.coerce.number().nonnegative().max(999999);
const optionalText = (max: number) => z.string().trim().max(max);

export async function saveProductAction(form: FormData) {
  const data = z.object({
    product_id: productIdSchema,
    name: z.string().trim().min(2).max(180),
    sku: z.string().trim().min(1).max(80),
    ean: z.union([z.string().regex(/^[0-9]{8,14}$/), z.literal("")]),
    format: optionalText(200),
    category: optionalText(150),
    description: optionalText(4000),
    benefits: optionalText(4000),
    actives: optionalText(4000),
    inci: optionalText(10000),
    usage_advice: optionalText(4000),
    precautions: optionalText(4000),
    image_url: z.union([z.string().url().startsWith("https://"), z.literal("")]),
    price_ht: money,
    vat_rate: z.coerce.number().min(0).max(100),
    min_qty: z.coerce.number().int().positive().max(5000),
    qty_step: z.coerce.number().int().positive().max(5000),
  }).parse(Object.fromEntries([
    "product_id","name","sku","ean","format","category","description",
    "benefits","actives","inci","usage_advice","precautions","image_url",
    "price_ht","vat_rate","min_qty","qty_step",
  ].map(key => [key, form.get(key) ?? ""])));
  const reviewConfirmed = form.get("confirm_review") === "yes";
  const priceConfirmed = form.get("confirm_price") === "yes";
  if (reviewConfirmed && (!data.ean || data.description.length < 10 || !data.image_url)) {
    throw new Error("Une fiche vérifiée doit avoir un EAN, une description et un visuel HTTPS.");
  }
  if (priceConfirmed && data.price_ht <= 0) {
    throw new Error("Le prix HT confirmé doit être positif.");
  }
  const { db } = await requireOwner();
  const { product_id, ...fields } = data;
  const { error } = await db.from("products").update({
    ...fields, ean: fields.ean || null, format: fields.format || null,
    category: fields.category || null, description: fields.description || null,
    benefits: fields.benefits || null, actives: fields.actives || null,
    inci: fields.inci || null, usage_advice: fields.usage_advice || null,
    precautions: fields.precautions || null, image_url: fields.image_url || null,
    requires_review: !reviewConfirmed, price_verified: priceConfirmed,
    published: false,
  }).eq("id",product_id);
  if (error) throw new Error("Enregistrement de la fiche impossible : " + error.message);
  revalidatePath("/app/produits");
  revalidatePath("/app/produits/" + product_id);
  revalidatePath("/catalogue");
  redirect("/app/produits/" + product_id + "?enregistre=1");
}

export async function saveQuantityTierAction(form: FormData) {
  const data = z.object({
    product_id: productIdSchema,
    min_qty: z.coerce.number().int().positive().max(5000),
    price_ht: money,
  }).parse({
    product_id: form.get("product_id"),
    min_qty: form.get("min_qty"),
    price_ht: form.get("price_ht"),
  });
  const { db } = await requireOwner();
  const { data: product, error: productError } = await db.from("products")
    .select("min_qty,qty_step").eq("id",data.product_id).single();
  if (productError || !product) throw new Error("Produit introuvable.");
  if (data.min_qty < product.min_qty || (data.min_qty-product.min_qty) % product.qty_step !== 0) {
    throw new Error("Le palier doit respecter le minimum et le pas de commande du produit.");
  }
  const verified = form.get("confirmed_price") === "yes";
  const { error } = await db.from("product_quantity_tiers").upsert(
    { ...data, verified, source_note: verified ? "Tarif confirmé par administrateur TR1" : "Brouillon à vérifier" },
    { onConflict: "product_id,min_qty" },
  );
  if (error) throw new Error("Palier non enregistré : "+error.message);
  revalidatePath("/app/produits/"+data.product_id);
  revalidatePath("/catalogue");
  redirect("/app/produits/"+data.product_id+"?palier=1");
}
export async function deleteQuantityTierAction(form: FormData) {
  const product_id = productIdSchema.parse(form.get("product_id"));
  const min_qty = z.coerce.number().int().positive().parse(form.get("min_qty"));
  const { db } = await requireOwner();
  const { error } = await db.from("product_quantity_tiers").delete()
    .eq("product_id",product_id).eq("min_qty",min_qty);
  if (error) throw new Error("Suppression du palier impossible.");
  revalidatePath("/app/produits/"+product_id);
  revalidatePath("/catalogue");
  redirect("/app/produits/"+product_id+"?palier_supprime=1");
}
const optionalCurrency = z.preprocess(v => v === "" || v == null ? null : v, money.nullable());
const optionalPositiveInteger = z.preprocess(v => v === "" || v == null ? null : v, z.coerce.number().int().positive().nullable());
export async function saveBrandTermsAction(form: FormData) {
  const data = z.object({
    brand_id: z.uuid(),
    minimum_order_units: optionalPositiveInteger,
    minimum_order_ht: optionalCurrency,
    shipping_fee_ht: optionalCurrency,
    free_shipping_from_ht: optionalCurrency,
    order_email: z.union([z.email(), z.literal("")]),
    notes: optionalText(2500),
  }).parse(Object.fromEntries([
    "brand_id","minimum_order_units","minimum_order_ht",
    "shipping_fee_ht","free_shipping_from_ht","order_email","notes",
  ].map(key => [key,form.get(key) ?? ""])));
  const { db } = await requireOwner();
  const { error } = await db.from("brand_trade_terms").upsert({
    ...data, order_email: data.order_email || null,
    notes: data.notes || null,
    verified: form.get("confirmed_terms") === "yes",
  },{onConflict:"brand_id"});
  if (error) throw new Error("Conditions de marque non enregistrées : "+error.message);
  revalidatePath("/app/conditions");
  redirect("/app/conditions?marque="+data.brand_id+"&enregistre=1");
}
export async function linkPharmacyAccountAction(form: FormData) {
  const data = z.object({
    pharmacy_id: z.uuid(), email: z.email().max(254),
  }).parse({ pharmacy_id:form.get("pharmacy_id"), email:form.get("email") });
  const { db } = await requireOwner();
  const { error } = await db.rpc("link_pharmacy_account", {
    p_pharmacy_id: data.pharmacy_id, p_email: data.email.toLowerCase(),
  });
  if (error) throw new Error("Compte non associé : "+error.message);
  revalidatePath("/app/acces");
  redirect("/app/acces?compte=lie");
}
export async function disablePharmacyAccountAction(form: FormData) {
  const data = z.object({pharmacy_id:z.uuid(),user_id:z.uuid()})
   .parse({pharmacy_id:form.get("pharmacy_id"),user_id:form.get("user_id")});
  const { db } = await requireOwner();
  const { error } = await db.from("pharmacy_memberships").update({active:false})
   .eq("pharmacy_id",data.pharmacy_id).eq("user_id",data.user_id);
  if(error)throw new Error("Impossible de suspendre cet accès.");
  revalidatePath("/app/acces");
}
export async function updateOrderRequestStatusAction(form: FormData) {
  const data = z.object({
    request_id:z.uuid(),
    status:z.enum(["received","verifying","forwarded","confirmed","closed","declined"]),
  }).parse({ request_id:form.get("request_id"),status:form.get("status") });
  if (data.status === "forwarded" && form.get("transmission_confirmed") !== "yes")
    throw new Error("Confirmer la transmission réelle de la demande avant de marquer ce statut.");
  const { db } = await requireOwner();
  const { error } = await db.from("order_requests").update({status:data.status})
   .eq("id",data.request_id);
  if (error) throw new Error("Mise à jour du statut impossible.");
  revalidatePath("/app/commandes");
}
