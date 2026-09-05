import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompletedOnboarding } from "@/lib/auth";
import { uiLabel } from "@/lib/ui-copy";

export default async function FieldPage() {
  const { supabase, userId } = await requireCompletedOnboarding();
  const { data: missions } = await supabase
    .from("missions")
    .select("id,title,status,mission_type,scheduled_start_at,report_due_at,address_snapshot,proposal_review_status,brands(name),pharmacies(trade_name,legal_name,city)")
    .eq("assigned_user_id", userId)
    .is("archived_at", null)
    .order("scheduled_start_at")
    .limit(30);

  return <div className="mx-auto max-w-3xl space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Aujourd’hui</h1>
        <p className="text-muted-foreground">Toutes vos marques, animations et rapports dans un seul espace.</p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline"><Link href="/dashboard/agenda"><CalendarDays className="size-4"/>Agenda</Link></Button>
        <Button asChild><Link href="/dashboard/missions/new"><Plus className="size-4"/>Planifier des animations</Link></Button>
      </div>
    </div>

    {(missions ?? []).map((mission) => {
      const brand = Array.isArray(mission.brands) ? mission.brands[0] : mission.brands;
      const pharmacy = Array.isArray(mission.pharmacies) ? mission.pharmacies[0] : mission.pharmacies;
      return <Link href={`/dashboard/field/missions/${mission.id}`} key={mission.id}>
        <Card className="mb-3 transition hover:border-primary">
          <CardHeader className="pb-2">
            <div className="flex justify-between gap-2">
              <CardTitle className="text-base">{mission.title}</CardTitle>
              <Badge variant={mission.status === "report_pending" ? "destructive" : "secondary"}>{uiLabel(mission.proposal_review_status !== "not_applicable" ? mission.proposal_review_status : mission.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{mission.scheduled_start_at ? new Date(mission.scheduled_start_at).toLocaleString("fr-FR") : "À planifier"}</p>
            <p className="text-muted-foreground">{pharmacy?.trade_name || pharmacy?.legal_name || String((mission.address_snapshot as Record<string,string> | null)?.city ?? "Pharmacie")} · {pharmacy?.city ?? ""} · {brand?.name ?? "Marque"}</p>
          </CardContent>
        </Card>
      </Link>;
    })}

    {!missions?.length && <div className="rounded-md border p-6 text-center">
      <p className="text-muted-foreground">Aucune animation planifiée pour le moment.</p>
      <Button asChild className="mt-4" size="sm"><Link href="/dashboard/missions/new"><Plus className="size-4"/>Planifier une animation</Link></Button>
    </div>}
  </div>;
}
