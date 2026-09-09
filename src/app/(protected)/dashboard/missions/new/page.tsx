import { redirect } from "next/navigation";
import { AnimationRequestForm } from "@/components/missions/animation-request-form";
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

type AnimationPharmacyRow = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  city: string | null;
};

type AnimationFacilitatorRow = {
  user_id: string;
  full_name: string;
};

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const filters = await searchParams;
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
          <CardHeader><CardTitle>Animations à proposer</CardTitle></CardHeader>
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
  const managerRoles = ["brand_admin", "tr1_manager", "super_admin"];
  const animationMode = role === "agent" || filters.mode === "animation";

  if (animationMode) {
    if (![...managerRoles, "agent"].includes(role)) redirect("/dashboard/missions");

    const callRpc = supabase.rpc as unknown as <T>(name: string, args: Record<string, unknown>) => RpcResult<T>;
    const [pharmacyResult, productResult, facilitatorResult] = await Promise.all([
      callRpc<AnimationPharmacyRow[]>("get_animation_request_pharmacies", { target_brand_id: brand.id }),
      supabase.from("products").select("id,name,sku").eq("brand_id", brand.id).eq("is_active", true).order("name"),
      callRpc<AnimationFacilitatorRow[]>("get_animation_facilitators", { target_brand_id: brand.id }),
    ]);

    if (pharmacyResult.error) throw new Error(pharmacyResult.error.message);
    if (productResult.error) throw new Error(productResult.error.message);
    if (facilitatorResult.error) throw new Error(facilitatorResult.error.message);

    const pharmacies = (pharmacyResult.data ?? []).map((item) => ({
      id: item.brand_pharmacy_id,
      label: item.pharmacy_name,
      detail: item.city ?? undefined,
    }));
    const products = (productResult.data ?? []).map((product) => ({
      id: product.id,
      label: product.name,
      detail: product.sku,
    }));
    const facilitators = (facilitatorResult.data ?? []).map((item) => ({ id: item.user_id, label: item.full_name }));

    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">Exécution terrain / Animation</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--tr1-navy)]">Demander une animation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Définissez l’objectif, les conditions et les preuves attendues. Ce brief suivra la mission jusqu’à sa clôture.
          </p>
        </div>
        {pharmacies.length ? (
          <AnimationRequestForm pharmacies={pharmacies} products={products} facilitators={facilitators} requesterRole={role} />
        ) : (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            {role === "agent" ? "Aucune pharmacie active de votre portefeuille n’est disponible pour une demande d’animation." : "Aucune pharmacie active n’est disponible pour cette marque."}
          </CardContent></Card>
        )}
      </div>
    );
  }

  if (!managerRoles.includes(role)) redirect("/dashboard/missions");

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
    const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
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
        <CardHeader><CardTitle>Brief terrain</CardTitle></CardHeader>
        <CardContent>
          <MissionForm
            pharmacies={pharmacies}
            products={(products ?? []).map((product) => ({ id: product.id, label: `${product.name} · ${product.sku}` }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
