import { supabase } from "./supabase";
import type { FacilitatorSellOutProduct } from "./facilitator-sell-out-api";

export async function searchFacilitatorSellOutProducts(
  brandId: string,
  term: string,
): Promise<FacilitatorSellOutProduct[]> {
  const query = term.trim();
  if (!query) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id,name,sku,ean,tax_rate")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .is("discontinued_at", null)
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .limit(20);

  if (error) throw new Error("La recherche produit est indisponible.");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    sku: typeof row.sku === "string" ? row.sku : null,
    ean: typeof row.ean === "string" ? row.ean : null,
    taxRate: row.tax_rate == null ? null : Number(row.tax_rate),
  }));
}
