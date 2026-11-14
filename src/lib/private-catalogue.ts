import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
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
  shipping_batch_id?: string | null;
  items?: { product_id: string | null; name: string; quantity: number }[];
};

type PharmacyContext = { id: string; name: string; city: string | null };
type CataloguePayload = {
  pharmacy: PharmacyContext;
  brands: CatalogBrand[];
  requests: CatalogRequest[];
  brand: CatalogBrand | null;
  products: CatalogProduct[];
};

export const PRIVATE_CATALOGUE_LINK_COOKIE = "tr1_catalogue_link";

type CatalogueSupabaseClient = SupabaseClient;

async function resolvePrivateCatalogueLink(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("private_catalog_access_links")
    .select("id,pharmacy_id,expires_at")
    .eq("token_hash", tokenHash)
    .eq("active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link) return null;

  const { data: pharmacy, error: pharmacyError } = await admin
    .from("private_catalog_pharmacies")
    .select("id,name,city")
    .eq("id", link.pharmacy_id)
    .maybeSingle();
  if (pharmacyError) throw pharmacyError;
  if (!pharmacy) return null;

  const { data, error } = await admin.rpc("catalogue_private_link_my_data", {
    p_token_hash: tokenHash,
  });
  if (error) throw error;
  const catalog = data as CataloguePayload | null;
  if (!catalog?.pharmacy || catalog.pharmacy.id !== pharmacy.id) return null;

  return {
    admin,
    pharmacy,
    userId: null,
    accessLinkHash: tokenHash,
    isLinkAccess: true as const,
    catalog,
  };
}

// Le compte pharmacie reste le parcours standard. Le lien prive constitue
// une voie distincte, limitee au catalogue et validee en base a chaque requete.
export async function requirePharmacyCatalogue() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!authError && user) {
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

    const { error: invitationError } = await supabase.rpc("catalogue_claim_invitation");
    if (invitationError) throw invitationError;

    const { data, error } = await supabase.rpc("catalogue_my_data");
    if (error) throw error;
    const payload = data as CataloguePayload | null;
    if (payload?.pharmacy) {
      return {
        admin: supabase,
        pharmacy: payload.pharmacy,
        userId: user.id,
        accessLinkHash: null,
        isLinkAccess: false as const,
        catalog: payload,
      };
    }
  }

  const cookieStore = await cookies();
  const linkToken = cookieStore.get(PRIVATE_CATALOGUE_LINK_COOKIE)?.value;
  if (linkToken) {
    const context = await resolvePrivateCatalogueLink(linkToken);
    if (context) return context;
    redirect("/catalogue/acces-invalide");
  }

  redirect("/catalogue/connexion");
}

export async function getCatalogueBrands(
  pharmacyId: string,
  supabase: CatalogueSupabaseClient,
  accessLinkHash?: string | null,
): Promise<CatalogBrand[]> {
  const { data, error } = accessLinkHash
    ? await supabase.rpc("catalogue_private_link_my_data", { p_token_hash: accessLinkHash })
    : await supabase.rpc("catalogue_my_data");
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
  supabase: CatalogueSupabaseClient,
  accessLinkHash?: string | null,
): Promise<{ brand: CatalogBrand; products: CatalogProduct[] }> {
  const { data, error } = accessLinkHash
    ? await supabase.rpc("catalogue_private_link_my_data", {
        p_token_hash: accessLinkHash,
        p_slug: slug,
      })
    : await supabase.rpc("catalogue_my_data", { p_slug: slug });
  if (error) throw error;
  const payload = data as CataloguePayload | null;
  if (!payload?.pharmacy || payload.pharmacy.id !== pharmacyId || !payload.brand) notFound();
  return { brand: payload.brand, products: payload.products ?? [] };
}

export { euroHT, isAllowedQuantity, sumOrderCents } from "@/lib/private-catalogue-format";
