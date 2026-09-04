import { redirect } from "next/navigation";
import { MissionForm } from "@/components/missions/forms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";

export default async function NewMissionPage() {
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role =
    contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";

  if (!["brand_admin", "tr1_manager", "super_admin"].includes(role)) {
    redirect("/dashboard/missions");
  }

  const [{ data: relations }, { data: products }] = await Promise.all([
    supabase
      .from("brand_pharmacies")
      .select("id,pharmacies(legal_name,trade_name,city)")
      .eq("brand_id", brand.id)
      .is("archived_at", null),
    supabase
      .from("products")
      .select("id,name,sku")
      .eq("brand_id", brand.id)
      .eq("is_active", true),
  ]);

  const pharmacies = (relations ?? []).map((relation) => {
    const pharmacy = Array.isArray(relation.pharmacies)
      ? relation.pharmacies[0]
      : relation.pharmacies;

    return {
      id: relation.id,
      label:
        pharmacy?.trade_name ||
        pharmacy?.legal_name ||
        "Pharmacie",
      detail: pharmacy?.city ?? undefined,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nouvelle mission</h1>
        <p className="text-muted-foreground">
          La marque formule la demande. TR1 affecte ensuite l’intervenant,
          qui doit accepter avant planification définitive.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brief terrain</CardTitle>
        </CardHeader>
        <CardContent>
          <MissionForm
            pharmacies={pharmacies}
            products={(products ?? []).map((product) => ({
              id: product.id,
              label: `${product.name} · ${product.sku}`,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
