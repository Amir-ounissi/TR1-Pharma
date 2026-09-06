import { redirect } from "next/navigation";
import { OrderForm } from "@/components/orders/order-forms";
import { OrderEntryModes } from "@/components/orders/pdf-order-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import type { OrderPharmacySearchResult } from "@/app/(protected)/dashboard/orders/actions";
import { activeBrandHasCapability } from "@/lib/saas/server";

type SearchParams = Promise<{ pharmacy?: string }>;
export default async function NewOrderPage({ searchParams }: { searchParams: SearchParams }) {
  const { pharmacy } = await searchParams;
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role =
    contexts.find((context) => context.id === brand.id)?.role ??
    "brand_user";

  if (!["agent", "tr1_manager", "brand_admin", "super_admin"].includes(role)) {
    redirect("/dashboard/orders");
  }

  const isAgent = role === "agent";
  const [{ data: initialRelation }, { data: products }, pdfImportEnabled] = await Promise.all([
    pharmacy ? supabase.from("brand_pharmacies").select("id,pharmacy_id,pharmacies(legal_name,trade_name,city,cip_code,siret)").eq("id", pharmacy).eq("brand_id", brand.id).is("archived_at", null).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("products").select("id,name,sku,ean,wholesale_price_ht,tax_rate,units_per_case,minimum_order_quantity").eq("brand_id", brand.id).eq("is_active", true).is("discontinued_at", null).order("name"),
    activeBrandHasCapability("pdf_order_import"),
  ]);
  const pharmacyItem = initialRelation && (Array.isArray(initialRelation.pharmacies) ? initialRelation.pharmacies[0] : initialRelation.pharmacies);
  const initialPharmacy: OrderPharmacySearchResult | undefined = initialRelation ? {
    pharmacyId: initialRelation.pharmacy_id,
    brandPharmacyId: initialRelation.id,
    relationStatus: "existing_brand_relation",
    name: pharmacyItem?.trade_name || pharmacyItem?.legal_name || "Pharmacie",
    detail: [pharmacyItem?.city, pharmacyItem?.cip_code ? `CIP ${pharmacyItem.cip_code}` : null, pharmacyItem?.siret ? `SIRET ${pharmacyItem.siret}` : null].filter(Boolean).join(" · "),
  } : undefined;
  const productOptions = (products ?? []).map((product) => ({ id: product.id, name: product.name, detail: product.sku, price: product.wholesale_price_ht, taxRate: product.tax_rate, unitsPerCase: product.units_per_case, minimumOrderQuantity: product.minimum_order_quantity }));
  const manualOrderForm = <OrderForm products={productOptions} initialPharmacy={initialPharmacy} isAgent={isAgent} />;
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Nouvelle commande</h1><p className="text-muted-foreground">Les snapshots et totaux sont figés et recalculés côté serveur.</p></div><Card><CardHeader><CardTitle>Commande</CardTitle></CardHeader><CardContent>{pdfImportEnabled ? <OrderEntryModes isAgent={isAgent} manual={manualOrderForm} /> : manualOrderForm}</CardContent></Card></div>;
}
