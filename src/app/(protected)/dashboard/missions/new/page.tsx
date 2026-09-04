import { redirect } from "next/navigation";
import { MissionForm, MissionProposalForm } from "@/components/missions/forms";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";

type MissionPharmacyRow = { brand_pharmacy_id?: string; pharmacy_name?: string; city?: string | null; id?: string; pharmacies?: { legal_name?: string | null; trade_name?: string | null; city?: string | null } | Array<{ legal_name?: string | null; trade_name?: string | null; city?: string | null }> | null };

export default async function NewMissionPage() {
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role =
    contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";

  const isProvider = role === "facilitator";
  if (!["brand_admin", "tr1_manager", "super_admin", "facilitator"].includes(role)) {
    redirect("/dashboard/missions");
  }

  const [{ data: relations }, { data: products }] = await Promise.all([
    isProvider ? supabase.rpc("get_provider_mission_pharmacies", { target_brand_id: brand.id }) : supabase
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

  const pharmacies = ((relations ?? []) as unknown as MissionPharmacyRow[]).map((relation) => {
    if (isProvider && "brand_pharmacy_id" in relation) {
      return { id: relation.brand_pharmacy_id ?? "", label: relation.pharmacy_name || "Pharmacie", detail: relation.city ?? undefined };
    }
    const pharmacy = Array.isArray(relation.pharmacies)
      ? relation.pharmacies[0]
      : relation.pharmacies;

    return {
      id: relation.id ?? "",
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
        <h1 className="text-2xl font-semibold">{isProvider ? "Proposer une mission" : "Nouvelle mission"}</h1>
        <p className="text-muted-foreground">
          {isProvider ? "Votre proposition sera relue par la marque avant de devenir une mission planifiée." : "La marque formule la demande. TR1 affecte ensuite l’intervenant, qui doit accepter avant planification définitive."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brief terrain</CardTitle>
        </CardHeader>
        <CardContent>
          {isProvider ? <MissionProposalForm
            pharmacies={pharmacies}
            products={(products ?? []).map((product) => ({ id: product.id, label: `${product.name} · ${product.sku}` }))}
          /> : <MissionForm
            pharmacies={pharmacies}
            products={(products ?? []).map((product) => ({
              id: product.id,
              label: `${product.name} · ${product.sku}`,
            }))}
          />}
        </CardContent>
      </Card>
    </div>
  );
}
