import type { CommercialContext, CommercialGiftRule } from "@/lib/catalogue-commercial";

type Brand = { id: string; slug: string; active: boolean };
type Product = { id: string; brand_id: string; active: boolean };
type Group = {
  id: string; brand_id: string; name: string; active: boolean;
  minimum_total_units: number; quantity_multiple: number;
};
type GroupProduct = { group_id: string; product_id: string };
type Supplier = { id: string; display_name: string; active: boolean };
type SupplierBrand = { supplier_id: string; brand_id: string };
type Terms = {
  supplier_id: string; active: boolean; verified_at: string | null;
  minimum_order_units: number | null; minimum_order_ht: number | null;
  shipping_fee_ht: number | null; free_shipping_from_ht: number | null;
  gift_rules: unknown;
};

function gifts(value: unknown): CommercialGiftRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CommercialGiftRule => (
    Boolean(item) && typeof item === "object" &&
    Number.isInteger(item.minimum_order_units) && item.minimum_order_units > 0 &&
    Number.isInteger(item.free_units) && item.free_units >= 0 &&
    (item.description === undefined || typeof item.description === "string")
  ));
}

/**
 * Read-only admin counterpart of catalogue_commercial_context.
 * Filter every group and supplier by the pharmacy's authorised brands.
 * Supplier prices and unverified supplier terms are never sent to the buyer preview.
 */
export function buildAdminCommercialPreviewContext({
  allowedBrandIds,brands,products,groups,groupProducts,suppliers,supplierBrands,terms,
}: {
  allowedBrandIds: readonly string[];
  brands: readonly Brand[]; products: readonly Product[];
  groups: readonly Group[]; groupProducts: readonly GroupProduct[];
  suppliers: readonly Supplier[]; supplierBrands: readonly SupplierBrand[];
  terms: readonly Terms[];
}): CommercialContext {
  const allowed=new Set(allowedBrandIds);
  const brandById=new Map(brands.filter(b=>b.active&&allowed.has(b.id)).map(b=>[b.id,b]));
  const activeProducts=new Set(products.filter(p=>p.active&&brandById.has(p.brand_id)).map(p=>p.id));
  const quantity_groups=groups.filter(g=>g.active&&brandById.has(g.brand_id))
    .map(g=>({
      id:g.id,brand_slug:brandById.get(g.brand_id)!.slug,name:g.name,
      minimum_total_units:g.minimum_total_units,quantity_multiple:g.quantity_multiple,
      product_ids:groupProducts.filter(gp=>gp.group_id===g.id&&activeProducts.has(gp.product_id)).map(gp=>gp.product_id),
    })).filter(g=>g.product_ids.length>0);
  const verifiedTerms=new Map(terms.filter(t=>t.active&&t.verified_at).map(t=>[t.supplier_id,t]));
  const suppliersForView=suppliers.filter(s=>s.active).flatMap(s=>{
    const brand_slugs=supplierBrands.filter(sb=>sb.supplier_id===s.id&&brandById.has(sb.brand_id))
      .map(sb=>brandById.get(sb.brand_id)!.slug);
    if(!brand_slugs.length)return [];
    const t=verifiedTerms.get(s.id);
    return [{
      id:s.id,name:s.display_name,brand_slugs,
      conditions_verified:Boolean(t),
      minimum_order_units:t?.minimum_order_units??null,
      minimum_order_ht:t?.minimum_order_ht??null,
      shipping_fee_ht:t?.shipping_fee_ht??null,
      free_shipping_from_ht:t?.free_shipping_from_ht??null,
      gift_rules:t?gifts(t.gift_rules):[],
    }];
  });
  return {quantity_groups,suppliers:suppliersForView};
}
