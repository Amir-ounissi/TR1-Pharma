"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAppUrl } from "@/lib/runtime-environment";

const id = z.uuid();
const nameField = z.string().trim().min(2).max(180);

async function authorizedAdmin() {
  const { supabase } = await requirePlatformAdmin();
  return supabase;
}

function finish() {
  revalidatePath("/catalogue/administration");
  revalidatePath("/catalogue");
  redirect("/catalogue/administration?succes=1");
}

export async function createPrivateCataloguePharmacy(formData: FormData) {
  const input = z.object({
    name: nameField,
    siret: z.union([z.string().regex(/^[0-9]{14}$/), z.literal("")]),
    city: z.string().trim().max(100),
    email: z.union([z.email(), z.literal("")]),
  }).parse({
    name: formData.get("name"), siret: formData.get("siret") ?? "",
    city: formData.get("city") ?? "", email: formData.get("email") ?? "",
  });
  const admin = await authorizedAdmin();
  const { error } = await admin.from("private_catalog_pharmacies").insert({
    name: input.name, siret: input.siret || null, city: input.city || null,
    contact_email: input.email || null,
  });
  if (error) throw error;
  finish();
}

export async function createPrivateCatalogueBrand(formData: FormData) {
  const input = z.object({
    name: nameField,
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100),
    description: z.string().trim().max(1000),
  }).parse({
    name: formData.get("name"), slug: formData.get("slug"),
    description: formData.get("description") ?? "",
  });
  const admin = await authorizedAdmin();
  const { error } = await admin.from("private_catalog_brands").insert({ ...input, active: false });
  if (error) throw error;
  finish();
}

export async function createPrivateCatalogueProduct(formData: FormData) {
  const input = z.object({
    brand_id: id, sku: z.string().trim().min(1).max(80),
    name: nameField, format: z.string().trim().max(120),
    price_ht: z.coerce.number().min(0).max(999999),
    vat_rate: z.coerce.number().min(0).max(100),
    min_quantity: z.coerce.number().int().min(1).max(5000),
    quantity_step: z.coerce.number().int().min(1).max(5000),
  }).parse({
    brand_id: formData.get("brand_id"), sku: formData.get("sku"),
    name: formData.get("name"), format: formData.get("format") ?? "",
    price_ht: formData.get("price_ht"), vat_rate: formData.get("vat_rate"),
    min_quantity: formData.get("min_quantity") ?? "1",
    quantity_step: formData.get("quantity_step") ?? "1",
  });
  const admin = await authorizedAdmin();
  const { error } = await admin.from("private_catalog_products").insert({ ...input, active: true });
  if (error) throw error;
  finish();
}

export async function authorizePrivateCatalogueBrand(formData: FormData) {
  const input = z.object({
    pharmacy_id: id, brand_id: id,
    pricing_mode: z.enum(["indicative","contractual"]),
  }).parse({
    pharmacy_id: formData.get("pharmacy_id"), brand_id: formData.get("brand_id"),
    pricing_mode: formData.get("pricing_mode") ?? "indicative",
  });
  const admin = await authorizedAdmin();
  const { error } = await admin.from("private_catalog_access")
    .upsert({ ...input, active: true }, { onConflict: "pharmacy_id,brand_id" });
  if (error) throw error;
  finish();
}

export async function setPrivateCatalogueBrandPublished(formData: FormData) {
  const brandId = id.parse(formData.get("brand_id"));
  const published = formData.get("published") === "true";
  const admin = await authorizedAdmin();
  const { error } = await admin.from("private_catalog_brands")
    .update({ active: published }).eq("id", brandId);
  if (error) throw error;
  finish();
}

async function requireAuthorizedProduct(
  admin: Awaited<ReturnType<typeof authorizedAdmin>>,
  pharmacyId: string,
  productId: string,
) {
  const { data: product, error: productError } = await admin.from("private_catalog_products")
    .select("brand_id").eq("id", productId).maybeSingle();
  if (productError || !product) throw new Error("Référence inconnue.");
  const { data: access, error: accessError } = await admin.from("private_catalog_access")
    .select("active").eq("pharmacy_id", pharmacyId)
    .eq("brand_id", product.brand_id).maybeSingle();
  if (accessError || !access?.active) {
    throw new Error("Autorisez d'abord cette marque pour la pharmacie.");
  }
  return product.brand_id as string;
}

export async function setPrivateCatalogueIndicativeTier(formData: FormData) {
  const input = z.object({
    product_id: id, min_quantity: z.coerce.number().int().min(1).max(5000),
    price_min_ht: z.coerce.number().min(0).max(999999),
    price_max_ht: z.coerce.number().min(0).max(999999),
  }).refine((v) => v.price_min_ht <= v.price_max_ht).parse({
    product_id: formData.get("product_id"), min_quantity: formData.get("min_quantity"),
    price_min_ht: formData.get("price_min_ht"), price_max_ht: formData.get("price_max_ht"),
  });
  const admin = await authorizedAdmin();
  const { error } = await admin.from("private_catalog_indicative_tiers")
    .upsert(input, { onConflict: "product_id,min_quantity" });
  if (error) throw error;
  finish();
}

export async function setPrivateCatalogueContractTier(formData: FormData) {
  const input = z.object({
    pharmacy_id: id, product_id: id,
    min_quantity: z.coerce.number().int().min(1).max(5000),
    price_ht: z.coerce.number().min(0).max(999999),
  }).parse({
    pharmacy_id: formData.get("pharmacy_id"), product_id: formData.get("product_id"),
    min_quantity: formData.get("min_quantity"), price_ht: formData.get("price_ht"),
  });
  const admin = await authorizedAdmin();
  const brandId = await requireAuthorizedProduct(admin, input.pharmacy_id, input.product_id);
  const { error } = await admin.from("private_catalog_contract_tiers")
    .upsert(input, { onConflict: "pharmacy_id,product_id,min_quantity" });
  if (error) throw error;
  const { error: modeError } = await admin.from("private_catalog_access")
    .update({ pricing_mode: "contractual" })
    .eq("pharmacy_id", input.pharmacy_id).eq("brand_id", brandId);
  if (modeError) throw modeError;
  finish();
}

// Compatibilite avec les prix fixes deja prevus dans l'ancien formulaire.
export async function setPrivateCataloguePrice(formData: FormData) {
  const input = z.object({
    pharmacy_id: id, product_id: id, price_ht: z.coerce.number().min(0).max(999999),
  }).parse({
    pharmacy_id: formData.get("pharmacy_id"), product_id: formData.get("product_id"),
    price_ht: formData.get("price_ht"),
  });
  const admin = await authorizedAdmin();
  const brandId = await requireAuthorizedProduct(admin, input.pharmacy_id, input.product_id);
  const { error } = await admin.from("private_catalog_prices")
    .upsert(input, { onConflict: "pharmacy_id,product_id" });
  if (error) throw error;
  const { error: modeError } = await admin.from("private_catalog_access")
    .update({ pricing_mode: "contractual" })
    .eq("pharmacy_id", input.pharmacy_id).eq("brand_id", brandId);
  if (modeError) throw modeError;
  finish();
}

export async function invitePrivateCatalogueUser(formData: FormData) {
  const input = z.object({ pharmacy_id: id, email: z.email() }).parse({
    pharmacy_id: formData.get("pharmacy_id"), email: formData.get("email"),
  });
  const admin = await authorizedAdmin();
  // Admin Auth invitation API is explicitly disabled until staging service
  // credentials and Supabase Auth redirects have been verified.
  if (process.env.PRIVATE_CATALOG_INVITES_ENABLED !== "true") {
    throw new Error("Invitations indisponibles sur cet environnement de test.");
  }
  const { data: pharmacy } = await admin.from("private_catalog_pharmacies")
    .select("id").eq("id", input.pharmacy_id).maybeSingle();
  if (!pharmacy) throw new Error("Pharmacie inconnue.");

  const origin = resolveAppUrl();
  if (!origin) throw new Error("URL publique de TR1 PHARMA non configurée.");
  const redirectTo = new URL("/auth/confirm?next=/catalogue/activer", origin).toString();
  // Actual invitation mail is sent only when an administrator explicitly submits this form.
  const privileged = createAdminClient();
  const { data, error: inviteError } = await privileged.auth.admin.inviteUserByEmail(
    input.email.toLowerCase(), { redirectTo },
  );
  if (inviteError || !data.user) {
    throw new Error("Invitation impossible : vérifiez si cette adresse possède déjà un compte.");
  }
  const { error } = await admin.from("private_catalog_memberships").upsert({
    user_id: data.user.id, pharmacy_id: input.pharmacy_id,
    invited_email: input.email.toLowerCase(), active: true, role: "pharmacien",
  }, { onConflict: "user_id" });
  if (error) throw error;
  finish();
}

export async function updatePrivateCatalogueRequestStatus(formData: FormData) {
  const input = z.object({
    request_id: id,
    status: z.enum(["received","verifying","forwarded","confirmed","closed","declined"]),
  }).parse({ request_id: formData.get("request_id"), status: formData.get("status") });
  const admin = await authorizedAdmin();
  const { error } = await admin.from("private_catalog_requests")
    .update({ status: input.status }).eq("id", input.request_id);
  if (error) throw error;
  finish();
}
