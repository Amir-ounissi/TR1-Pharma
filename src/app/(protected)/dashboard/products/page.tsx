import { ProductCatalog } from "@/components/reference/product-catalog";
import { ProductForm } from "@/components/reference/simple-forms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import {
  countProductPresence,
  type ProductPresenceRow,
} from "@/lib/product-distribution";
import { canAdministerProducts } from "@/lib/product-permissions";

export default async function ProductsPage() {
  const [{ supabase, brand }, contexts] = await Promise.all([
    requireActiveBrand(),
    getBrandContexts(),
  ]);
  const role = contexts.find((context) => context.id === brand.id)?.role;
  const canManage = canAdministerProducts(role);

  const [
    { data: products, error: productsError },
    { data: brandRecord, error: brandError },
    { data: brandPharmacies, error: pharmaciesError },
    { data: presenceRows, error: presenceError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("brand_id", brand.id)
      .order("name"),
    supabase
      .from("brands")
      .select("currency_code,status")
      .eq("id", brand.id)
      .single(),
    supabase
      .from("brand_pharmacies")
      .select("id")
      .eq("brand_id", brand.id)
      .is("archived_at", null),
    supabase
      .from("brand_pharmacy_products")
      .select(
        "product_id,brand_pharmacy_id,order_presence,status,manually_confirmed_present,removed_at,brand_pharmacies!inner(brand_id,archived_at)",
      )
      .eq("brand_pharmacies.brand_id", brand.id)
      .is("brand_pharmacies.archived_at", null),
  ]);

  const queryError = productsError ?? brandError ?? pharmaciesError ?? presenceError;
  if (queryError) throw queryError;

  const currency = brandRecord?.currency_code ?? "EUR";
  const portfolioCount = brandRecord?.status === "active"
    ? (brandPharmacies ?? []).length
    : 0;
  const presenceCounts = countProductPresence(
    (presenceRows ?? []) as unknown as ProductPresenceRow[],
  );
  const catalogProducts = (products ?? []).map((product) => ({
    ...product,
    distribution_present_count: presenceCounts.get(product.id) ?? 0,
    distribution_portfolio_count: portfolioCount,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Produits
        </h1>
        <p className="text-muted-foreground">
          Catalogue de {brand.name}. Cliquez sur un produit pour consulter
          sa fiche{canManage ? " ou la compléter" : ""}.
        </p>
      </div>

      <div className={canManage ? "grid gap-6 xl:grid-cols-[1fr_420px]" : "grid gap-6"}>
        <Card>
          <CardHeader>
            <CardTitle>Catalogue</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <ProductCatalog
              products={catalogProducts}
              currency={currency}
              canManage={canManage}
            />
          </CardContent>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Nouveau produit</CardTitle>
            </CardHeader>

            <CardContent>
              <ProductForm />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
