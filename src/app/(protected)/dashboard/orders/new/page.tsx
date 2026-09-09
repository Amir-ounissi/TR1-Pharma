import { redirect } from "next/navigation";
import { QuickOrderForm } from "@/components/orders/quick-order-form";
import { QuickOrderEntryModes } from "@/components/orders/quick-order-entry-modes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import type { OrderPharmacySearchResult } from "@/app/(protected)/dashboard/orders/actions";
import { activeBrandHasCapability } from "@/lib/saas/server";

type SearchParams = Promise<{ pharmacy?: string; product?: string }>;

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { pharmacy, product } = await searchParams;
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role =
    contexts.find((context) => context.id === brand.id)?.role ??
    "brand_user";

  if (!["agent", "tr1_manager", "brand_admin", "super_admin"].includes(role)) {
    redirect("/dashboard/orders");
  }

  const isAgent = role === "agent";
  const [{ data: initialRelation }, { data: products }, pdfImportEnabled] =
    await Promise.all([
      pharmacy
        ? supabase
            .from("brand_pharmacies")
            .select(
              "id,pharmacy_id,pharmacies(legal_name,trade_name,city,cip_code,siret)",
            )
            .eq("id", pharmacy)
            .eq("brand_id", brand.id)
            .is("archived_at", null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("products")
        .select(
          "id,name,sku,ean,wholesale_price_ht,tax_rate,units_per_case,minimum_order_quantity",
        )
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .is("discontinued_at", null)
        .order("name"),
      activeBrandHasCapability("pdf_order_import"),
    ]);

  const pharmacyItem =
    initialRelation &&
    (Array.isArray(initialRelation.pharmacies)
      ? initialRelation.pharmacies[0]
      : initialRelation.pharmacies);

  const initialPharmacy: OrderPharmacySearchResult | undefined = initialRelation
    ? {
        pharmacyId: initialRelation.pharmacy_id,
        brandPharmacyId: initialRelation.id,
        relationStatus: "existing_brand_relation",
        name:
          pharmacyItem?.trade_name ||
          pharmacyItem?.legal_name ||
          "Pharmacie",
        detail: [
          pharmacyItem?.city,
          pharmacyItem?.cip_code ? `CIP ${pharmacyItem.cip_code}` : null,
          pharmacyItem?.siret ? `SIRET ${pharmacyItem.siret}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      }
    : undefined;

  const productOptions = (products ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    detail: item.sku,
    price: item.wholesale_price_ht,
    taxRate: item.tax_rate,
    unitsPerCase: item.units_per_case,
    minimumOrderQuantity: item.minimum_order_quantity,
  }));

  const { data: lastOrder } = initialRelation
    ? await supabase
        .from("orders")
        .select("id")
        .eq("brand_pharmacy_id", initialRelation.id)
        .eq("brand_id", brand.id)
        .in("order_status", [
          "confirmed",
          "invoiced",
          "partially_delivered",
          "delivered",
        ])
        .is("archived_at", null)
        .order("order_date", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: lastItems } = lastOrder
    ? await supabase
        .from("order_items")
        .select(
          "product_id,quantity,free_quantity,unit_price_ht,discount_rate",
        )
        .eq("order_id", lastOrder.id)
        .order("created_at")
    : { data: [] };

  const lastOrderItems = (lastItems ?? [])
    .filter(
      (item) =>
        Number(item.quantity ?? 0) > 0 &&
        productOptions.some((option) => option.id === item.product_id),
    )
    .map((item) => ({
      productId: item.product_id,
      quantity: Number(item.quantity),
      freeQuantity: Number(item.free_quantity ?? 0),
      unitPriceHt: item.unit_price_ht,
      discountRate: item.discount_rate,
    }));

  const prioritizedProduct = product
    ? productOptions.find((option) => option.id === product)
    : undefined;

  const quickOrderForm = (
    <QuickOrderForm
      products={productOptions}
      initialPharmacy={initialPharmacy}
      lastOrderItems={lastOrderItems}
      initialProductId={prioritizedProduct?.id}
      initialOrderType={
        initialRelation ? (lastOrderItems.length ? "reorder" : "initial") : "other"
      }
      isAgent={isAgent}
    />
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
          Terrain
        </p>
        <h1 className="text-2xl font-black text-[var(--tr1-navy)]">
          Nouvelle commande
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sélectionnez les références, ajustez les quantités et envoyez.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle>Prendre une commande</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {pdfImportEnabled ? (
            <QuickOrderEntryModes isAgent={isAgent} manual={quickOrderForm} />
          ) : (
            quickOrderForm
          )}
        </CardContent>
      </Card>
    </div>
  );
}
