import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  missionDataQualityLabels,
  missionEffectivenessLabels,
  missionMaturityLabels,
  type MissionEffectivenessStatus,
  type MissionImpactDataQuality,
  type MissionObservationMaturity,
} from "@/lib/mission-impact";
import { createMissionFollowupAction } from "@/app/(protected)/dashboard/mission-performance/actions";

export type ImpactRow = Record<string, unknown> & {
  mission_id: string;
  mission_total_cost: number | null;
  sell_out_units: number | null;
  cost_per_unit: number | null;
  cost_per_contact: number | null;
  first_order_after_at: string | null;
  days_to_first_order_after: number | null;
  first_order_observed_after_mission: boolean;
  reorder_observed_60d: boolean;
  revenue_30d_before: number;
  revenue_30d_after: number;
  revenue_60d_after: number;
  revenue_90d_after: number;
  observed_revenue_cost_ratio: number | null;
  observation_maturity: MissionObservationMaturity;
  mission_effectiveness_status: MissionEffectivenessStatus;
  impact_data_quality: MissionImpactDataQuality;
  mission_effectiveness_reasons: string[];
  data_quality_reasons: string[];
  overlapping_missions: boolean;
  followup_recommended: boolean;
};

const money = (value: number | null | undefined) => value == null ? "—" : `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

export function MissionImpact({ impact, compact = false }: { impact: ImpactRow; compact?: boolean }) {
  const j30Complete = impact.observation_maturity !== "early";
  const j60Complete = impact.observation_maturity === "60d_complete" || impact.observation_maturity === "mature";
  const j90Complete = impact.observation_maturity === "mature";
  return <Card data-testid="mission-impact">
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Impact observé</CardTitle>
        <div className="flex gap-2">
          <Badge>{missionEffectivenessLabels[impact.mission_effectiveness_status]}</Badge>
          <Badge variant="outline">{missionMaturityLabels[impact.observation_maturity]}</Badge>
        </div>
      </div>
      <CardDescription>Comparaison descriptive avant/après mission. Elle ne prouve pas un lien causal.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Sell-out déclaré" value={impact.sell_out_units == null ? "—" : `${impact.sell_out_units} unités`} />
        <Metric label="Coût / unité" value={money(impact.cost_per_unit)} />
        <Metric label="CA J-30" value={money(impact.revenue_30d_before)} />
        <Metric label="CA J+30 observé" value={j30Complete ? money(impact.revenue_30d_after) : "En cours d’observation"} />
        {!compact ? <><Metric label="CA J+60 observé" value={j60Complete ? money(impact.revenue_60d_after) : "En cours d’observation"} /><Metric label="CA J+90 observé" value={j90Complete ? money(impact.revenue_90d_after) : "En cours d’observation"} /><Metric label="Ratio CA observé / coût" value={impact.observed_revenue_cost_ratio == null ? "—" : `${Number(impact.observed_revenue_cost_ratio).toFixed(2)}×`} /><Metric label="Première commande après" value={impact.first_order_after_at ? `${impact.days_to_first_order_after} j · ${impact.first_order_observed_after_mission ? "implantation" : "réassort"}` : "Non observée"} /></> : null}
      </div>
      <div>
        <p className="text-sm font-medium">Pourquoi ce statut ?</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {(impact.mission_effectiveness_reasons ?? []).map((reason) => <li key={reason}>{reason}</li>)}
          {impact.mission_effectiveness_reasons?.length ? null : <li>Aucun signal suffisamment mature.</li>}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={impact.impact_data_quality === "complete" ? "secondary" : "outline"}>{missionDataQualityLabels[impact.impact_data_quality]}</Badge>
        {impact.overlapping_missions ? <Badge variant="outline">Interventions chevauchantes</Badge> : null}
        {(impact.data_quality_reasons ?? []).map((reason) => <span key={reason} className="text-xs text-muted-foreground">{reason}</span>)}
      </div>
      {!compact ? <p className="text-xs text-muted-foreground">Le ratio compare le CA observé après la mission à son coût. Il ne prouve pas que l’intégralité du CA a été causée par la mission.</p> : null}
      {impact.followup_recommended ? <form action={createMissionFollowupAction} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <input type="hidden" name="missionId" value={impact.mission_id} />
        <label className="grid gap-1 text-sm">Relance recommandée<input className="h-9 rounded-md border bg-background px-3" type="datetime-local" name="dueAt" required /></label>
        <Button type="submit">Créer la tâche</Button>
      </form> : null}
      {compact ? <Button asChild variant="outline"><Link href={`/dashboard/missions/${impact.mission_id}`}>Voir l’analyse</Link></Button> : null}
    </CardContent>
  </Card>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><p className="text-lg font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}
