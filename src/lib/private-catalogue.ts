import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { IndicativeTier, ContractTier } from "@/lib/private-catalogue-format";

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

export type CatalogRequest = {
  id: string;
  brand_id: string;
  total_ht: number | null;
  request_kind: "quote" | "order";
  status: string;
  created_at: string;
};

type PharmacyContext = { id: string; name: string; city: string | null };
type CataloguePayload = {
  pharmacy: PharmacyContext;
  brands: CatalogBrand[];
  requests: CatalogRequest[];
  brand: CatalogBrand | null;
  products: CatalogProduct[];
};

// Le serveur Supabase valide l'utilisateur confirme et ses droits OFFICINE.
// Un acces par mot de passe au CRM ne donne pas automatiquement acces au catalogue.
export async function requirePharmacyCatalogue() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/catalogue/connexion");

  const { data: globalAdmin, error: adminError } = await supabase
    .from("memberships")
    .select("id,roles!inner(key)")
    .eq("user_id", user.id)
    .is("brand_id", null)
    .eq("status", "active")
    .eq("roles.key", "super_admin")
    .maybeSingle();
  if (adminError) throw adminError;
  if (globalAdmin) redirect("/catalogue/administration");

  // L'invitation prealablement autorisee est rattachee uniquement apres
  // verification de l'email du compte dans auth.users par la base.
  const { error: invitationError } = await supabase.rpc("catalogue_claim_invitation");
  if (invitationError) throw invitationError;

  const { data, error } = await supabase.rpc("catalogue_my_data");
  if (error) throw error;
  const payload = data as CataloguePayload | null;
  if (!payload?.pharmacy) redirect("/catalogue/connexion?erreur=acces");

  return { admin: supabase, pharmacy: payload.pharmacy, userId: user.id, catalog: payload };
}

export async function getCatalogueBrands(
  pharmacyId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CatalogBrand[]> {
  const { data, error } = await supabase.rpc("catalogue_my_data");
  if (error) throw error;
  const payload = data as CataloguePayload | null;
  if (!payload?.pharmacy || payload.pharmacy.id !== pharmacyId) notFound();
  return payload.brands ?? [];
}

/**
 * La base effectue tous les controles et ne renvoie jamais le prix de
 * reference interne, ni les accords des autres pharmacies.
 */
export async function getCatalogueBrandForPharmacy(
  pharmacyId: string,
  slug: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ brand: CatalogBrand; products: CatalogProduct[] }> {
  const { data, error } = await supabase.rpc("catalogue_my_data", { p_slug: slug });
  if (error) throw error;
  const payload = data as CataloguePayload | null;
  if (!payload?.pharmacy || payload.pharmacy.id !== pharmacyId || !payload.brand) notFound();
  return { brand: payload.brand, products: payload.products ?? [] };
}

export { euroHT, isAllowedQuantity, sumOrderCents } from "@/lib/private-catalogue-format";
