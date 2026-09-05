import Link from "next/link";
import { redirect } from "next/navigation";
import { ProposalReviewForm } from "@/components/missions/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineError } from "@/components/ux/inline-error";
import { isoToParisLocal } from "@/lib/agenda";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { attachProposalAssignees, reviewableProposalStatuses } from "@/lib/mission-proposals";
import { uiLabel } from "@/lib/ui-copy";

export default async function MissionProposalsPage() {
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role = contexts.find((item) => item.id === brand.id)?.role ?? "brand_user";
  if (!["brand_admin", "tr1_manager", "super_admin"].includes(role)) redirect("/dashboard/missions");

  const { data: proposalRows, error: proposalsError } = await supabase
    .from("missions")
    .select("id,title,mission_type,scheduled_start_at,scheduled_end_at,budget_estimated_ht,objective,briefing,assigned_user_id,proposal_review_status,proposal_review_note,pharmacies(trade_name,legal_name,city),mission_products(products(name,sku))")
    .eq("brand_id", brand.id)
    .eq("proposal_source", "provider")
    .in("proposal_review_status", [...reviewableProposalStatuses])
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (proposalsError) {
    console.error("Impossible de charger les propositions de mission.", { code: proposalsError.code, message: proposalsError.message });
    return <InlineError title="Impossible de charger les propositions." description="La file de validation est momentanément indisponible." action={<Button asChild size="sm" variant="outline"><Link href="/dashboard/missions/proposals">Réessayer</Link></Button>} />;
  }

  const assignedUserIds = [...new Set((proposalRows ?? []).map((proposal) => proposal.assigned_user_id).filter((id): id is string => Boolean(id)))];
  const usersResult = assignedUserIds.length
    ? await supabase.from("users").select("id,user_profiles(full_name)").in("id", assignedUserIds)
    : { data: [], error: null };

  if (usersResult.error) console.error("Impossible de charger les intervenants des propositions.", { code: usersResult.error.code, message: usersResult.error.message });
  const proposals = attachProposalAssignees(proposalRows ?? [], usersResult.data ?? []);

  return <div className="space-y-5">
    <header><p className="font-mono text-xs font-bold uppercase text-[var(--tr1-orange)]">Missions · {brand.name}</p><h1 className="text-3xl font-black text-[var(--tr1-navy)]">Propositions à valider</h1><p className="text-sm text-muted-foreground">La planification n’est officielle qu’après succès de la validation.</p></header>
    {usersResult.error ? <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Les propositions restent disponibles, mais certains noms d’intervenants n’ont pas pu être chargés.</p> : null}
    {proposals.map((mission) => {
      const pharmacy = Array.isArray(mission.pharmacies) ? mission.pharmacies[0] : mission.pharmacies;
      const isPending = mission.proposal_review_status === "pending";
      const products = mission.mission_products?.map((entry) => {
        const product = entry.products as unknown as { name?: string } | { name?: string }[] | null;
        return Array.isArray(product) ? product[0]?.name : product?.name;
      }).filter(Boolean).join(", ");
      return <Card key={mission.id}><CardHeader><div className="flex flex-wrap justify-between gap-2"><div><CardTitle><Link href={`/dashboard/missions/${mission.id}`}>{mission.title}</Link></CardTitle><p className="text-sm text-muted-foreground">{pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"}{pharmacy?.city ? ` · ${pharmacy.city}` : ""} · {mission.assigneeName}</p></div><div className="flex gap-2"><Badge>{uiLabel(mission.mission_type)}</Badge><Badge variant="secondary">{uiLabel(mission.proposal_review_status)}</Badge></div></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 text-sm sm:grid-cols-3"><p><strong>Créneau</strong><br />{mission.scheduled_start_at ? isoToParisLocal(mission.scheduled_start_at).replace("T", " ") : "À préciser"}</p><p><strong>Budget proposé</strong><br />{Number(mission.budget_estimated_ht ?? 0).toLocaleString("fr-FR")} € HT</p><p><strong>Produits</strong><br />{products || "Aucun"}</p></div><p className="text-sm"><strong>Objectif :</strong> {mission.objective}</p><p className="whitespace-pre-wrap text-sm"><strong>Brief :</strong> {mission.briefing || "—"}</p>{isPending ? <ProposalReviewForm mission={mission} /> : <p className="rounded-md bg-muted p-3 text-sm">Correction demandée à l’intervenant{mission.proposal_review_note ? ` : ${mission.proposal_review_note}` : "."}</p>}</CardContent></Card>;
    })}
    {!proposals.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Aucune proposition à traiter pour le moment.</CardContent></Card> : null}
  </div>;
}
