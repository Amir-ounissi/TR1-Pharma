import { CommercialEventTracker } from "@/components/commercial/commercial-event-tracker";
import { ReorderFollowupForm } from "@/components/commercial/reorder-followup-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommercialHealthRow } from "@/lib/commercial-health";
import { presentationLabel } from "@/lib/presentation";

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function currency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
}

export function CommercialHealthSummary({ health }: { health: CommercialHealthRow | null }) {
  if (!health) return null;
  return (
    <Card className="xl:col-span-2" data-testid="commercial-health-summary">
      <CommercialEventTracker eventName="commercial_health_viewed" pharmacyId={health.pharmacy_id} />
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2d6f9f]">Pilotage réassort</p><CardTitle className="mt-1">Santé commerciale</CardTitle></div>
        <div className="text-right"><span className="text-2xl font-bold text-[#0f2740]">{health.priority_score}</span><p className="text-xs text-muted-foreground">Priorité / 100</p></div>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2"><Badge variant={health.health_status === "at_risk" || health.health_status === "dormant" ? "destructive" : "secondary"}>{presentationLabel(health.health_status)}</Badge><span className="font-semibold">{health.recommendation}</span></div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label="Dernière commande" value={date(health.last_order_at)} />
            <Metric label="Réassort estimé" value={date(health.expected_reorder_at)} />
            <Metric label="Commandes / réassorts" value={`${health.orders_count} / ${health.reorder_count}`} />
            <Metric label="Fréquence" value={`${health.expected_interval_days} jours`} />
            <Metric label="CA 90 jours" value={currency(health.revenue_last_90d)} />
            <Metric label="Tendance" value={presentationLabel(health.revenue_trend)} />
            <Metric label="Prochaine action" value={health.has_next_action ? date(health.next_action_at) : "Aucune"} />
            <Metric label="Premier réassort" value={health.first_reorder_at ? date(health.first_reorder_at) : "À convertir"} />
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">{health.priority_reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
        </div>
        <ReorderFollowupForm brandPharmacyId={health.brand_pharmacy_id} recommendation={health.recommendation} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
