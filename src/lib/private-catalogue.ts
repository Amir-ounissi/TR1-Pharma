import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CatalogProduct = {
  id: string;
  brand_id: string;
  sku: string;
  ean: string | null;
  name: string;
  description: string;
  format: string;
  image_url: string | null;
  price_ht: number;
  vat_rate: number;
  min_quantity: number;
  quantity_step: number;
};

export type CatalogBrand = {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
};

export async function requirePharmacyCatalogue() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/catalogue/connexion");

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("private_catalog_memberships")
    .select("pharmacy_id,invited_email,active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) throw membershipError;
  // The authorisation is not inferred from the public profile or editable JWT metadata.
  if (!membership?.active || user.email?.toLowerCase() !== membership.invited_email.toLowerCase()) {
    redirect("/catalogue/connexion?erreur=acces");
  }

  const { data: pharmacy, error: pharmacyError } = await admin
    .from("private_catalog_pharmacies")
    .select("id,name,city")
    .eq("id", membership.pharmacy_id)
    .single();
  if (pharmacyError || !pharmacy) redirect("/catalogue/connexion?erreur=acces");

  return { admin, pharmacy: pharmacy as { id: string; name: string; city: string | null }, userId: user.id };
}

export async function getCatalogueBrands(pharmacyId: string, admin: ReturnType<typeof createAdminClient>): Promise<CatalogBrand[]> {
  const { data: permissions, error: accessError } = await admin
    .from("private_catalog_access")
    .select("brand_id")
    .eq("pharmacy_id", pharmacyId)
    .eq("active", true);
  if (accessError) throw accessError;
  const ids = (permissions ?? []).map((row) => row.brand_id as string);
  if (!ids.length) return [];

  const { data, error } = await admin.from("private_catalog_brands")
    .select("id,slug,name,description,logo_url")
    .eq("active", true)
    .in("id", ids)
    .order("name");
  if (error) throw error;
  return (data ?? []) as CatalogBrand[];
}

export async function getCatalogueBrandForPharmacy(
  pharmacyId: string,
  slug: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  const brands = await getCatalogueBrands(pharmacyId, admin);
  const brand = brands.find((item) => item.slug === slug);
  if (!brand) notFound();

  const { data: rows, error } = await admin.from("private_catalog_products")
    .select("id,brand_id,sku,ean,name,description,format,image_url,price_ht,vat_rate,min_quantity,quantity_step")
    .eq("brand_id", brand.id)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  const products = (rows ?? []) as CatalogProduct[];
  if (!products.length) return { brand, products };

  const { data: prices, error: priceError } = await admin
    .from("private_catalog_prices")
    .select("product_id,price_ht")
    .eq("pharmacy_id", pharmacyId)
    .in("product_id", products.map((p) => p.id));
  if (priceError) throw priceError;
  const priceByProduct = new Map((prices ?? []).map((p) => [p.product_id as string, Number(p.price_ht)]));
  return {
    brand,
    products: products.map((p) => ({ ...p, price_ht: priceByProduct.get(p.id) ?? Number(p.price_ht) })),
  };
}

export function euroHT(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

/** Quantities must follow the configured pack rule, not merely be positive. */
export function isAllowedQuantity(quantity: number, minimum: number, step: number) {
  return Number.isSafeInteger(quantity) && quantity >= minimum && quantity <= 5000
    && Number.isSafeInteger(minimum) && minimum > 0
    && Number.isSafeInteger(step) && step > 0
    && (quantity - minimum) % step === 0;
}

export function sumOrderCents(lines: { price_ht: number; quantity: number }[]) {
  return lines.reduce((sum, line) => sum + Math.round(line.price_ht * 100) * line.quantity, 0);
}
