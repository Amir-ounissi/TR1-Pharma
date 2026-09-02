import { OrderForm } from "@/components/orders/order-forms";
import { OrderEntryModes } from "@/components/orders/pdf-order-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";

type SearchParams = Promise<{ pharmacy?: string }>;
export default async function NewOrderPage({ searchParams }: { searchParams: SearchParams }) {
  const { pharmacy } = await searchParams;
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const isAgent = contexts.find((context) => context.id === brand.id)?.role === "agent";
  const [{ data: relations }, { data: products }] = await Promise.all([
    supabase.from("brand_pharmacies").select("id,pharmacies(legal_name,trade_name,city)").eq("brand_id", brand.id).is("archived_at", null),
    supabase.from("products").select("id,name,sku,ean,wholesale_price_ht,tax_rate,units_per_case,minimum_order_quantity").eq("brand_id", brand.id).eq("is_active", true).is("discontinued_at", null).order("name"),
  ]);
  const pharmacyOptions = (relations ?? []).map((relation) => { const item = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies; return { id: relation.id, name: item?.trade_name || item?.legal_name || "Pharmacie", detail: item?.city || "" }; });
  const productOptions = (products ?? []).map((product) => ({ id: product.id, name: product.name, detail: product.sku, price: product.wholesale_price_ht, taxRate: product.tax_rate, unitsPerCase: product.units_per_case, minimumOrderQuantity: product.minimum_order_quantity }));
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Nouvelle commande</h1><p className="text-muted-foreground">Les snapshots et totaux sont figés et recalculés côté serveur.</p></div><Card><CardHeader><CardTitle>Commande</CardTitle></CardHeader><CardContent><OrderEntryModes manual={<OrderForm pharmacies={pharmacyOptions} products={productOptions} initialBrandPharmacyId={pharmacy} isAgent={isAgent} />} /></CardContent></Card></div>;
}
