import Link from "next/link";
import { redirect } from "next/navigation";
import { MissionStatusForm } from "@/components/missions/forms";
import { OwnAnimationScheduleForm } from "@/components/missions/own-animation-schedule-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";
import { presentationLabel } from "@/lib/presentation";

type Requirements = {
  merch_plan_required?: boolean;
  merch_result_required?: boolean;
  cash_register_required?: boolean;
  before_after_required?: boolean;
  sales_by_product_required?: boolean;
};

type AnimationMission = {
  id: string;
  title: string;
  objective: string;
  briefing: string | null;
  status: string;
  mission_type: string;
  assigned_user_id: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  provider_cost_ht: number | null;
  travel_cost_ht: number | null;
  execution_requirements: Requirements | null;
  pharmacies:
    | { legal_name: string | null; trade_name: string | null; city: string | null }
    | Array<{ legal_name: string | null; trade_name: string | null; city: string | null }>
    | null;
};

export default async function AnimationBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, brand, userId } = await requireActiveBrand();

  const [{ data: rawMission }, { data: products }] = await Promise.all([
    supabase
      .from("missions")
      .select("*,pharmacies(legal_name,trade_name,city)")
      .eq("id", id)
      .eq("brand_id", brand.id)
      .eq("assigned_user_id", userId)
      .maybeSingle(),
    supabase
      .from("mission_products")
      .select("id,target_quantity,priority,briefing_notes,products(name,sku)")
      .eq("mission_id", id),
  ]);

  const mission = rawMission as unknown as AnimationMission | null;
  if (!mission || mission.mission_type !== "animation") redirect("/dashboard/field");

  const pharmacy = Array.isArray(mission.pharmacies) ? mission.pharmacies[0] : mission.pharmacies;
  const requirements = mission.execution_requirements ?? {};
  const proofLabels = [
    requirements.merch_plan_required ? "Photo plan merchandising" : null,
    requirements.merch_result_required ? "Photo résultat merchandising" : null,
    requirements.cash_register_required ? "Sortie de caisse photo / PDF" : null,
    requirements.sales_by_product_required ? "Ventes par produit" : null,
    requirements.before_after_required ? "Photos avant + après" : null,
    "Compte rendu",
  ].filter((label): label is string => Boolean(label));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="flex flex-wrap gap-2">
          <Badge>Animation</Badge>
          <Badge variant="secondary">{presentationLabel(mission.status)}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--tr1-navy)]">{mission.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"}{pharmacy?.city ? ` · ${pharmacy.city}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Mission proposée</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Créneau souhaité</p>
            <p className="mt-1 text-sm font-semibold">
              {mission.scheduled_start_at ? new Date(mission.scheduled_start_at).toLocaleString("fr-FR") : "À définir"}
              {mission.scheduled_end_at ? ` → ${new Date(mission.scheduled_end_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conditions</p>
            <p className="mt-1 text-sm font-semibold">{Number(mission.provider_cost_ht ?? 0).toLocaleString("fr-FR")} € HT de rémunération</p>
            <p className="text-xs text-muted-foreground">+ {Number(mission.travel_cost_ht ?? 0).toLocaleString("fr-FR")} € HT de frais prévus</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Objectif</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{mission.objective}</p>
          </div>
          {mission.briefing ? <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consignes</p><p className="mt-1 whitespace-pre-wrap text-sm">{mission.briefing}</p></div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Produits à travailler</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(products ?? []).length ? (products ?? []).map((item) => {
            const product = Array.isArray(item.products) ? item.products[0] : item.products;
            return <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
              <div><p className="font-medium">{product?.name || "Produit"}</p><p className="text-xs text-muted-foreground">{product?.sku || ""}{item.briefing_notes ? ` · ${item.briefing_notes}` : ""}</p></div>
              <div className="text-right"><p className="font-semibold">{item.target_quantity ?? "—"}</p><p className="text-xs text-muted-foreground">objectif unités</p></div>
            </div>;
          }) : <p className="text-sm text-muted-foreground">Aucune référence spécifique imposée.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Livrables attendus</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {proofLabels.map((label) => <Badge key={label} variant="outline" className="px-3 py-1.5">{label}</Badge>)}
        </CardContent>
      </Card>

      {mission.status === "assigned" ? (
        <Card>
          <CardHeader><CardTitle>Votre décision</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">En acceptant, vous pourrez confirmer ou ajuster le créneau avant que la mission soit planifiée.</p>
            <MissionStatusForm missionId={id} options={["accepted", "rejected"]} />
          </CardContent>
        </Card>
      ) : null}

      {mission.status === "accepted" ? (
        <Card>
          <CardHeader><CardTitle>Confirmer le créneau</CardTitle></CardHeader>
          <CardContent>
            <OwnAnimationScheduleForm missionId={id} defaultStart={mission.scheduled_start_at} defaultEnd={mission.scheduled_end_at} />
          </CardContent>
        </Card>
      ) : null}

      {!["assigned", "accepted"].includes(mission.status) ? (
        <Button asChild><Link href={`/dashboard/missions/${id}`}>Ouvrir la mission</Link></Button>
      ) : null}
    </div>
  );
}
