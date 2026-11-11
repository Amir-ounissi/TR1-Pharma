import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractTier, IndicativeTier } from "@/lib/private-catalogue-format";

export type CataloguePricing =
  | { mode: "indicative"; tiers: IndicativeTier[] }
  | { mode: "contractual"; tiers: ContractTier[] };

export type CatalogProduct = {
  id: string;
  brand_id: string;
  sku: string;
  ean: string | null;
  name: string;
  description: string;
  format: string;
  image_url: string | null;
  vat_rate: number;
  min_quantity: number;
  quantity_step: number;
  pricing: CataloguePricing;
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

  // Platform owners are not pharmacy members: send them to their own
  // administration instead of attempting a privileged pharmacy lookup.
  const { data: globalAdmin, error: globalAdminError } = await supabase
    .from("memberships")
    .select("id,roles!inner(key)")
    .eq("user_id", user.id)
    .is("brand_id", null)
    .eq("status", "active")
    .eq("roles.key", "super_admin")
    .maybeSingle();
  if (globalAdminError) throw globalAdminError;
  if (globalAdmin) redirect("/catalogue/administration");

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("private_catalog_memberships")
    .select("pharmacy_id,invited_email,active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) throw membershipError;
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

/**
 * Les prix internes du produit ne figurent jamais dans l'objet renvoye au client.
 * La tarification contractuelle requiert une autorisation par pharmacie ET par marque,
 * puis un prix explicite par produit (ou par palier). Sinon seule la fourchette est renvoyee.
 */
export async function getCatalogueBrandForPharmacy(
  pharmacyId: string,
  slug: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  const brands = await getCatalogueBrands(pharmacyId, admin);
  const brand = brands.find((item) => item.slug === slug);
  if (!brand) notFound();

  const { data: access, error: permissionError } = await admin.from("private_catalog_access")
    .select("pricing_mode")
    .eq("pharmacy_id", pharmacyId)
    .eq("brand_id", brand.id)
    .eq("active", true)
    .maybeSingle();
  if (permissionError) throw permissionError;
  if (!access) notFound();

  const { data: rows, error } = await admin.from("private_catalog_products")
    .select("id,brand_id,sku,ean,name,description,format,image_url,vat_rate,min_quantity,quantity_step")
    .eq("brand_id", brand.id)
    .eq("active", true)
    .order("name");
  if (error) throw error;

  const sourceProducts = rows ?? [];
  if (!sourceProducts.length) return { brand, products: [] as CatalogProduct[] };

  const productIds = sourceProducts.map((p) => p.id);
  const [indicative, contractual, legacy] = await Promise.all([
    admin.from("private_catalog_indicative_tiers")
      .select("product_id,min_quantity,price_min_ht,price_max_ht").in("product_id", productIds)
      .order("min_quantity"),
    // Le client serveur charge ces donnees mais ne les transmet jamais au navigateur
    // si l'officine n'a pas de contrat autorise.
    access.pricing_mode === "contractual"
      ? admin.from("private_catalog_contract_tiers")
        .select("product_id,min_quantity,price_ht").eq("pharmacy_id", pharmacyId)
        .in("product_id", productIds).order("min_quantity")
      : Promise.resolve({ data: [], error: null }),
    access.pricing_mode === "contractual"
      ? admin.from("private_catalog_prices")
        .select("product_id,price_ht").eq("pharmacy_id", pharmacyId).in("product_id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (indicative.error) throw indicative.error;
  if (contractual.error) throw contractual.error;
  if (legacy.error) throw legacy.error;

  const indicativeByProduct = new Map<string, IndicativeTier[]>();
  for (const row of indicative.data ?? []) {
    const tiers = indicativeByProduct.get(row.product_id) ?? [];
    tiers.push({
      min_quantity: Number(row.min_quantity),
      price_min_ht: Number(row.price_min_ht),
      price_max_ht: Number(row.price_max_ht),
    });
    indicativeByProduct.set(row.product_id, tiers);
  }

  const contractualByProduct = new Map<string, ContractTier[]>();
  for (const row of contractual.data ?? []) {
    const tiers = contractualByProduct.get(row.product_id) ?? [];
    tiers.push({ min_quantity: Number(row.min_quantity), price_ht: Number(row.price_ht) });
    contractualByProduct.set(row.product_id, tiers);
  }
  const legacyByProduct = new Map(
    (legacy.data ?? []).map((row) => [row.product_id as string, Number(row.price_ht)]),
  );

  const products: CatalogProduct[] = sourceProducts.map((product) => {
    const tiers = contractualByProduct.get(product.id);
    const flatPrice = legacyByProduct.get(product.id);
    // Un ancien tarif fixe reste applicable au seuil de base, sauf s'il
    // existe un palier contractuel explicite au meme seuil.
    const byMinimum = new Map<number, ContractTier>();
    if (flatPrice !== undefined) {
      byMinimum.set(product.min_quantity, { min_quantity: product.min_quantity, price_ht: flatPrice });
    }
    for (const tier of tiers ?? []) byMinimum.set(tier.min_quantity, tier);
    const contractualTiers = [...byMinimum.values()].sort((a, b) => a.min_quantity - b.min_quantity);

    const pricing: CataloguePricing = access.pricing_mode === "contractual" && contractualTiers.length
      ? { mode: "contractual", tiers: contractualTiers }
      : { mode: "indicative", tiers: indicativeByProduct.get(product.id) ?? [] };

    return {
      id: product.id, brand_id: product.brand_id, sku: product.sku, ean: product.ean,
      name: product.name, description: product.description, format: product.format,
      image_url: product.image_url, vat_rate: Number(product.vat_rate),
      min_quantity: Number(product.min_quantity), quantity_step: Number(product.quantity_step),
      pricing,
    };
  });
  return { brand, products };
}

export { euroHT, isAllowedQuantity, sumOrderCents } from "@/lib/private-catalogue-format";
