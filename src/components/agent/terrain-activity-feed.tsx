import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ux/section-header";
import { presentationLabel } from "@/lib/presentation";

export type TerrainImpact = {
  mission_id: string;
  mission_title: string;
  mission_date: string;
  mission_type: string;
  sell_out_units: number | null;
  first_order_after_at: string | null;
  days_to_first_order_after: number | null;
  observation_maturity: "early" | "30d_complete" | "60d_complete" | "mature";
};

const maturityLabels: Record<TerrainImpact["observation_maturity"], string> = {
  early: "Observation en cours",
  "30d_complete": "Recul de 30 jours",
  "60d_complete": "Recul de 60 jours",
  mature: "Observation mature",
};

export function TerrainActivityFeed({ impacts }: { impacts: TerrainImpact[] }) {
  if (impacts.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="terrain-activity-title">
      <SectionHeader id="terrain-activity-title" title="Ça bouge sur votre terrain" description="Les signaux observés après vos dernières missions, sans attribution causale." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {impacts.map((impact, index) => (
          <Card key={impact.mission_id} className="agent-card-enter terrain-interactive overflow-hidden" style={{ animationDelay: `${index * 70}ms` }}>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="border-[var(--tr1-blue)]/35 text-[var(--tr1-blue)]">{presentationLabel(impact.mission_type)}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(impact.mission_date).toLocaleDateString("fr-FR")}</span>
              </div>
              <div><Link href={`/dashboard/missions/${impact.mission_id}`} className="group inline-flex items-start gap-1 font-semibold text-[var(--tr1-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{impact.mission_title}<ArrowUpRight className="mt-0.5 size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link></div>
              <div className="space-y-2 text-sm">
                {impact.sell_out_units != null ? <p className="flex items-center gap-2"><TrendingUp className="size-4 text-[var(--tr1-success)]" /><strong>{impact.sell_out_units}</strong> unités de sell-out renseignées</p> : null}
                {impact.first_order_after_at ? <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[var(--tr1-success)]" />Commande observée après {impact.days_to_first_order_after ?? "la"} {impact.days_to_first_order_after == null ? "mission" : `jour${impact.days_to_first_order_after > 1 ? "s" : ""}`}</p> : <p className="text-muted-foreground">Aucune commande observée après la mission à ce stade.</p>}
              </div>
              <p className="flex items-center gap-1.5 border-t border-[var(--tr1-line)] pt-3 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{maturityLabels[impact.observation_maturity]}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
