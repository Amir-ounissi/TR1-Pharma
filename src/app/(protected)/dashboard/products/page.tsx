import { ProductCatalog } from "@/components/reference/product-catalog";
import { ProductForm } from "@/components/reference/simple-forms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireActiveBrandRole } from "@/lib/auth";
import { referenceAdministrationRoles } from "@/lib/ux/permissions";

export default async function ProductsPage() {
  const { supabase, brand } = await requireActiveBrandRole(referenceAdministrationRoles);

  const [{ data: products }, { data: brandRecord }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("brand_id", brand.id)
      .order("name"),
    supabase
      .from("brands")
      .select("currency_code")
      .eq("id", brand.id)
      .single(),
  ]);

  const currency = brandRecord?.currency_code ?? "EUR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Produits
        </h1>
        <p className="text-muted-foreground">
          Catalogue de {brand.name}. Cliquez sur un produit pour
          consulter ou compléter sa fiche.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Catalogue</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <ProductCatalog
              products={products ?? []}
              currency={currency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouveau produit</CardTitle>
          </CardHeader>

          <CardContent>
            <ProductForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
