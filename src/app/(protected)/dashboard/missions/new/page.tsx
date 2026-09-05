import { redirect } from "next/navigation";
import { MissionForm } from "@/components/missions/forms";
import {
  FacilitatorAnimationPlanner,
  type FacilitatorPharmacyOption,
} from "@/components/missions/facilitator-animation-planner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBrandContexts, getOptionalActiveBrand } from "@/lib/auth";

type MissionPharmacyRow = {
  brand_id: string;
  brand_name: string;
  brand_pharmacy_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  postal_code?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  cip_code?: string | null;
};

export default async function NewMissionPage() {
  const [session, contexts] = await Promise.all([
    getOptionalActiveBrand(),
    getBrandContexts(),
  ]);
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");
  const activeRole = session.brand
    ? contexts.find((context) => context.id === session.brand?.id)?.role ?? "brand_user"
    : null;
  const isProvider = facilitatorOnly || activeRole === "facilitator";

  if (isProvider) {
    const { data, error } = await session.supabase.rpc("get_provider_mission_pharmacies_v2");
    if (error) throw new Error(error.message);

    const pharmacies = ((data ?? []) as MissionPharmacyRow[])
      .filter((relation) => facilitatorOnly || relation.brand_id === session.brand?.id)
      .map((relation): FacilitatorPharmacyOption => ({
        id: relation.brand_pharmacy_id,
        brandId: relation.brand_id,
        brandName: relation.brand_name,
        label: relation.pharmacy_name || "Pharmacie",
        postalCode: relation.postal_code ?? undefined,
        city: relation.city ?? undefined,
        address: relation.address_line_1 ?? undefined,
        cipCode: relation.cip_code ?? undefined,
      }));

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Planifier des animations</h1>
          <p className="text-muted-foreground">
            Choisissez la pharmacie et la date. Le présentiel, la gamme complète et la validation du budget par la marque sont automatiques.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Animations à proposer</CardTitle>
          </CardHeader>
          <CardContent>
            {pharmacies.length ? (
              <FacilitatorAnimationPlanner pharmacies={pharmacies} />
            ) : (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aucune pharmacie n’est disponible pour vos marques autorisées.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session.brand) redirect("/select-brand");
  const { supabase, brand } = session;
  const role = activeRole ?? "brand_user";
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
      label: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
      detail: pharmacy?.city ?? undefined,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nouvelle mission</h1>
        <p className="text-muted-foreground">
          La marque formule la demande. TR1 affecte ensuite l’intervenant, qui doit accepter avant planification définitive.
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
