"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";

const name = z.string().trim().min(2).max(180);
export async function createBrandAction(form: FormData) {
  const parsed = z.object({ name, slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) })
    .parse({ name: form.get("name"), slug: form.get("slug") });
  const { db } = await requireOwner();
  const { error } = await db.from("brands").insert(parsed);
  if (error) throw new Error("Impossible de créer la marque.");
  revalidatePath("/app/marques");
}
export async function createPharmacyAction(form: FormData) {
  const parsed = z.object({
    name, city: z.string().trim().max(120),
    siret: z.union([z.string().regex(/^[0-9]{14}$/), z.literal("")]),
  }).parse({ name: form.get("name"), city: form.get("city") ?? "", siret: form.get("siret") ?? "" });
  const { db } = await requireOwner();
  const { error } = await db.from("pharmacies").insert({ name: parsed.name, city: parsed.city || null, siret: parsed.siret || null });
  if (error) throw new Error("Impossible de créer la pharmacie.");
  revalidatePath("/app/pharmacies");
}
export async function createProductAction(form: FormData) {
  const parsed = z.object({
    brand_id: z.uuid(), sku: z.string().trim().min(1).max(80), name,
    price_ht: z.coerce.number().nonnegative().max(999999),
    min_qty: z.coerce.number().int().positive(), qty_step: z.coerce.number().int().positive(),
  }).parse({
    brand_id: form.get("brand_id"), sku: form.get("sku"), name: form.get("name"),
    price_ht: form.get("price_ht"), min_qty: form.get("min_qty"), qty_step: form.get("qty_step"),
  });
  const { db } = await requireOwner();
  const { error } = await db.from("products").insert({ ...parsed, published: false });
  if (error) throw new Error("Impossible de créer le produit.");
  revalidatePath("/app/produits");
}

export async function setBrandActiveAction(form: FormData) {
  const brandId = z.uuid().parse(form.get("brand_id"));
  const active = form.get("active") === "true";
  const { db } = await requireOwner();
  const { error } = await db.from("brands").update({ active }).eq("id", brandId);
  if (error) throw new Error("Impossible de modifier la publication de cette marque.");
  revalidatePath("/app/marques");
  revalidatePath("/catalogue");
}
export async function setProductPublishedAction(form: FormData) {
  const productId = z.uuid().parse(form.get("product_id"));
  const published = form.get("published") === "true";
  const { db } = await requireOwner();
  const { error } = await db.from("products").update({ published }).eq("id", productId);
  if (error) throw new Error("Impossible de modifier la publication du produit.");
  revalidatePath("/app/produits");
  revalidatePath("/catalogue");
}
export async function authorizeBrandAction(form: FormData) {
  const value = z.object({ pharmacy_id: z.uuid(), brand_id: z.uuid() })
    .parse({ pharmacy_id: form.get("pharmacy_id"), brand_id: form.get("brand_id") });
  const { db } = await requireOwner();
  const { error } = await db.from("pharmacy_brand_access").upsert(
    { ...value, active: true }, { onConflict: "pharmacy_id,brand_id" },
  );
  if (error) throw new Error("Impossible d'autoriser cette marque.");
  revalidatePath("/app/acces");
  revalidatePath("/catalogue");
}
export async function setBrandAccessActiveAction(form: FormData) {
  const value = z.object({ pharmacy_id: z.uuid(), brand_id: z.uuid() })
    .parse({ pharmacy_id: form.get("pharmacy_id"), brand_id: form.get("brand_id") });
  const active = form.get("active") === "true";
  const { db } = await requireOwner();
  const { error } = await db.from("pharmacy_brand_access").update({ active })
    .eq("pharmacy_id", value.pharmacy_id).eq("brand_id", value.brand_id);
  if (error) throw new Error("Impossible de modifier cet accès.");
  revalidatePath("/app/acces");
  revalidatePath("/catalogue");
}
