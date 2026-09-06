import { AlertTriangle, Building2, Gauge, Map, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { requireActiveBrand } from "@/lib/auth";
import { formatCompactCurrency, formatCompactNumber, formatCompactPercent } from "@/lib/performance";

type TerritoryRow = {
  territory_id: string | null;
  territory_name: string;
  revenue_ht: number;
  implantations: number;
  reorders: number;
};

type DirectionWorkspace = {
  revenue_ht: number;
  previous_revenue_ht: number;
  revenue_delta_percent: number | null;
  booked_pipeline_ht: number;
  expected_reorder_revenue_ht: number;
  projected_revenue_ht: number;
  run_rate_projection_ht: number;
  objective_revenue_ht: number | null;
  objective_gap_ht: number | null;
  objective_attainment_projection_percent: number | null;
  implantations: number;
  reorders: number;
  active_pharmacies: number;
  at_risk_accounts: number;
  dormant_accounts: number;
  avg_distribution_rate: number;
  strategic_distribution_rate: number;
  expected_reorders_count: number;
  overdue_reorders_count: number;
  territories: TerritoryRow[];
};

function numeric(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function optionalNumeric(value: unknown) {
  if (value === null || value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function parseWorkspace(value: unknown): DirectionWorkspace {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const territories = Array.isArray(source.territories) ? source.territories : [];
  return {
    revenue_ht: numeric(source.revenue_ht),
    previous_revenue_ht: numeric(source.previous_revenue_ht),
    revenue_delta_percent: optionalNumeric(source.revenue_delta_percent),
    booked_pipeline_ht: numeric(source.booked_pipeline_ht),
    expected_reorder_revenue_ht: numeric(source.expected_reorder_revenue_ht),
    projected_revenue_ht: numeric(source.projected_revenue_ht),
    run_rate_projection_ht: numeric(source.run_rate_projection_ht),
    objective_revenue_ht: optionalNumeric(source.objective_revenue_ht),
    objective_gap_ht: optionalNumeric(source.objective_gap_ht),
    objective_attainment_projection_percent: optionalNumeric(source.objective_attainment_projection_percent),
    implantations: numeric(source.implantations),
    reorders: numeric(source.reorders),
    active_pharmacies: numeric(source.active_pharmacies),
    at_risk_accounts: numeric(source.at_risk_accounts),
    dormant_accounts: numeric(source.dormant_accounts),
    avg_distribution_rate: numeric(source.avg_distribution_rate),
    strategic_distribution_rate: numeric(source.strategic_distribution_rate),
    expected_reorders_count: numeric(source.expected_reorders_count),
    overdue_reorders_count: numeric(source.overdue_reorders_count),
    territories: territories.map((row) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        territory_id: typeof item.territory_id === "string" ? item.territory_id : null,
        territory_name: typeof item.territory_name === "string" ? item.territory_name : "Sans territoire",
        revenue_ht: numeric(item.revenue_ht),
        implantations: numeric(item.implantations),
        reorders: numeric(item.reorders),
      };
    }),
  };
}

function signedPercent(value: number | null) {
  if (value === null) return "Base N-1 nulle";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export default async function DirectionPage() {
  const { supabase, brand } = await requireActiveBrand();
  const now = new Date();
  const year = now.getUTCFullYear();
  const periodStart = `${year}-01-01`;
  const periodEnd = `${year}-12-31`;
  const asOf = now.toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("get_direction_workspace", {
    target_brand_id: brand.id,
    target_period_start: periodStart,
    target_period_end: periodEnd,
    target_as_of: asOf,
  });
  if (error) throw error;

  const workspace = parseWorkspace(data);
  const deltaNegative = workspace.revenue_delta_percent !== null && workspace.revenue_delta_percent < 0;
  const projectedAttainment = workspace.objective_attainment_projection_percent;

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Direction · ${brand.name}`}
        title="Piloter la trajectoire, sans bruit opérationnel"
        description="Vue exécutive en lecture seule : CA, atterrissage, N-1, distribution, risques et comparaison des territoires."
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Trajectoire Direction">
        <Metric label="CA réalisé YTD" value={formatCompactCurrency(workspace.revenue_ht)} detail="Facturé / livré à date" icon={TrendingUp} />
        <Metric label="Évolution vs N-1" value={signedPercent(workspace.revenue_delta_percent)} detail={`${formatCompactCurrency(workspace.previous_revenue_ht)} à date N-1`} icon={deltaNegative ? TrendingDown : TrendingUp} />
        <Metric label="Atterrissage déterministe" value={formatCompactCurrency(workspace.projected_revenue_ht)} detail={`Run-rate ${formatCompactCurrency(workspace.run_rate_projection_ht)}`} icon={Gauge} />
        <Metric label="Objectif annuel" value={workspace.objective_revenue_ht === null ? "Non défini" : formatCompactCurrency(workspace.objective_revenue_ht)} detail={projectedAttainment === null ? "Objectif marque" : `${formatCompactPercent(projectedAttainment)} projeté`} icon={Target} />
        <Metric label="DN moyenne" value={formatCompactPercent(workspace.avg_distribution_rate)} detail={`DN stratégique ${formatCompactPercent(workspace.strategic_distribution_rate)}`} icon={Building2} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Lecture réseau">
        <MiniMetric label="Implantations YTD" value={formatCompactNumber(workspace.implantations)} />
        <MiniMetric label="Réassorts YTD" value={formatCompactNumber(workspace.reorders)} />
        <MiniMetric label="Pharmacies actives" value={formatCompactNumber(workspace.active_pharmacies)} />
        <MiniMetric label="Écart objectif projeté" value={workspace.objective_gap_ht === null ? "—" : formatCompactCurrency(workspace.objective_gap_ht)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Construction de l’atterrissage</CardTitle>
            <CardDescription>Projection déterministe, sans décision opaque.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Breakdown label="Réalisé" value={formatCompactCurrency(workspace.revenue_ht)} />
            <Breakdown label="Commandé à venir" value={formatCompactCurrency(workspace.booked_pipeline_ht)} />
            <Breakdown label="Réassorts attendus" value={formatCompactCurrency(workspace.expected_reorder_revenue_ht)} detail={`${formatCompactNumber(workspace.expected_reorders_count)} compte(s)`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signaux Direction</CardTitle>
            <CardDescription>Les volumes qui demandent une vigilance managériale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Signal label="Comptes à risque" value={workspace.at_risk_accounts} />
            <Signal label="Comptes dormants" value={workspace.dormant_accounts} />
            <Signal label="Réassorts déjà en retard" value={workspace.overdue_reorders_count} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Comparaison des territoires</CardTitle>
              <CardDescription>CA, implantations et réassorts à date. Lecture uniquement.</CardDescription>
            </div>
            <Badge variant="secondary"><Map className="mr-1 size-3" /> YTD</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {workspace.territories.length ? workspace.territories.map((territory) => (
            <div key={territory.territory_id ?? territory.territory_name} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-6">
              <p className="font-semibold">{territory.territory_name}</p>
              <div><p className="text-xs text-muted-foreground">CA</p><p className="font-semibold">{formatCompactCurrency(territory.revenue_ht)}</p></div>
              <div><p className="text-xs text-muted-foreground">Implantations</p><p className="font-semibold">{formatCompactNumber(territory.implantations)}</p></div>
              <div><p className="text-xs text-muted-foreground">Réassorts</p><p className="font-semibold">{formatCompactNumber(territory.reorders)}</p></div>
            </div>
          )) : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Aucune activité territoriale sur la période.</p>}
        </CardContent>
      </Card>
    </main>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof TrendingUp }) {
  return <Card><CardContent className="pt-5"><Icon className="size-4 text-[var(--tr1-orange)]" /><p className="mt-3 text-2xl font-semibold">{value}</p><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></CardContent></Card>;
}

function Breakdown({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-xl border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p>{detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}</div>;
}

function Signal({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between rounded-xl border p-4"><div className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /><p className="font-medium">{label}</p></div><strong className="text-xl">{formatCompactNumber(value)}</strong></div>;
}
