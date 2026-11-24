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
    fr_market_document: optionalText(400),
    image_url: z.union([z.string().url().startsWith("https://"), z.literal("")]),
    price_ht: money,
    vat_rate: z.coerce.number().min(0).max(100),
    min_qty: z.coerce.number().int().positive().max(5000),
    qty_step: z.coerce.number().int().positive().max(5000),
  }).parse(Object.fromEntries([
    "product_id","name","sku","ean","format","category","description",
    "benefits","actives","inci","usage_advice","precautions","fr_market_document","image_url",
    "price_ht","vat_rate","min_qty","qty_step",
  ].map(key => [key, form.get(key) ?? ""])));
  const frMarketChecked = form.get("fr_market_checked") === "yes";
  const frLabelChecked = form.get("fr_label_checked") === "yes";
  if (frMarketChecked && data.fr_market_document.length < 6) {
    throw new Error("La conformité du marché français exige une référence de dossier ou un justificatif précis.");
  }
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
    fr_market_document: fields.fr_market_document || null,
    fr_market_checked: frMarketChecked, fr_label_checked: frLabelChecked,
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
  const { db } = await requireOwner();
  const { data: current, error: readError } = await db.from("order_requests")
    .select("status").eq("id",data.request_id).single();
  if(readError||!current) throw new Error("Demande introuvable.");
  if(current.status===data.status) return;
  const next: Record<string,string[]> = {
    received:["verifying","declined"], verifying:["forwarded","declined"],
    forwarded:["confirmed","declined"], confirmed:["closed"], closed:[], declined:[],
  };
  if(!(next[current.status]??[]).includes(data.status))
    throw new Error("Transition interdite. Respecter les étapes de validation et de transmission.");
  if(data.status==="forwarded" && form.get("transmission_confirmed")!=="yes")
    throw new Error("Confirmer la transmission réelle avant de marquer la demande comme transmise.");
  const { data: changed,error } = await db.from("order_requests").update({status:data.status})
    .eq("id",data.request_id).eq("status",current.status).select("id").maybeSingle();
  if(error||!changed) throw new Error("Le statut a changé ou la mise à jour est impossible. Actualiser la page.");
  revalidatePath("/app/commandes");
  revalidatePath("/app/revenus");
}

export async function savePharmacyPriceAction(form: FormData) {
  const data = z.object({
    pharmacy_id: z.uuid(),
    product_id: z.uuid(),
    min_qty: z.coerce.number().int().positive().max(5000),
    price_ht: money,
  }).parse({
    pharmacy_id: form.get("pharmacy_id"), product_id: form.get("product_id"),
    min_qty: form.get("min_qty"), price_ht: form.get("price_ht"),
  });
  if (form.get("confirmed_price") !== "yes") {
    throw new Error("Confirmer que le prix négocié avec la pharmacie est vérifié.");
  }
  const { db } = await requireOwner();
  const { data: product, error: loadError } = await db.from("products")
    .select("brand_id,min_qty,qty_step").eq("id",data.product_id).single();
  if (loadError || !product) throw new Error("Produit introuvable.");
  if (data.min_qty < product.min_qty ||
      (data.min_qty-product.min_qty) % product.qty_step !== 0) {
    throw new Error("Le palier spécifique doit respecter le minimum et le pas du produit.");
  }
  const { error } = await db.from("price_rules").upsert(
    data, { onConflict:"pharmacy_id,product_id,min_qty" },
  );
  if (error) throw new Error("Tarif officinal non enregistré.");
  revalidatePath("/app/acces");
  revalidatePath("/catalogue");
  redirect("/app/acces?tarif=enregistre");
}
export async function deletePharmacyPriceAction(form: FormData) {
  const data = z.object({
    pharmacy_id: z.uuid(),
    product_id: z.uuid(),
    min_qty: z.coerce.number().int().positive(),
  }).parse({
    pharmacy_id: form.get("pharmacy_id"),
    product_id: form.get("product_id"),
    min_qty: form.get("min_qty"),
  });
  const { db } = await requireOwner();
  const { error } = await db.from("price_rules").delete()
    .eq("pharmacy_id",data.pharmacy_id).eq("product_id",data.product_id).eq("min_qty",data.min_qty);
  if (error) throw new Error("Suppression du tarif impossible.");
  revalidatePath("/app/acces");
  revalidatePath("/catalogue");
  redirect("/app/acces?tarif=supprime");
}
