import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, Building2, Gauge, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import {
  buildExecutiveAlerts,
  getExecutivePeriods,
  percentChange,
  pickExecutiveObjective,
  runRateProjection,
  type ExecutiveAlertTone,
  type ExecutiveObjective,
  type ExecutiveOverview,
} from "@/lib/executive-cockpit";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCompactPercent,
  formatPerformanceMetric,
  formatPerformanceValue,
  objectiveTone,
} from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type PriorityRow = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  health_status: string;
  priority_score: number;
  recommendation: string;
};

function asOverview(value: unknown): ExecutiveOverview {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const number = (key: keyof ExecutiveOverview) => Number(source[key] ?? 0);
  return {
    revenue_ht: number("revenue_ht"),
    implantations: number("implantations"),
    reorders: number("reorders"),
    active_pharmacies: number("active_pharmacies"),
    at_risk_accounts: number("at_risk_accounts"),
    dormant_accounts: number("dormant_accounts"),
    without_next_action_count: number("without_next_action_count"),
    strategic_without_action_count: number("strategic_without_action_count"),
    first_reorder_rate: number("first_reorder_rate"),
    avg_distribution_rate: number("avg_distribution_rate"),
    strategic_distribution_rate: number("strategic_distribution_rate"),
  };
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function signedPercent(value: number | null) {
  if (value === null) return "Base N-1 nulle";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function alertClasses(tone: ExecutiveAlertTone) {
  if (tone === "critical") return "border-red-200 bg-red-50/70";
  if (tone === "warning") return "border-amber-200 bg-amber-50/70";
  return "border-sky-200 bg-sky-50/70";
}

export default async function ExecutiveCockpitPage() {
  const periods = getExecutivePeriods();
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["brand_admin", "tr1_manager", "brand_user", "super_admin"].includes(role)) notFound();

  const [currentResult, previousResult, objectivesResult, prioritiesResult] = await Promise.all([
    supabase.rpc("get_performance_overview", {
      target_brand_id: brand.id,
      target_period_start: periods.current.start,
      target_period_end: periods.current.end,
      target_territory_id: null,
      target_agent_id: null,
    }),
    supabase.rpc("get_performance_overview", {
      target_brand_id: brand.id,
      target_period_start: periods.previous.start,
      target_period_end: periods.previous.end,
      target_territory_id: null,
      target_agent_id: null,
    }),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: periods.current.start,
      target_filter_end: periods.current.fullYearEnd,
      target_scope_type: "brand",
      target_territory_id: null,
      target_agent_id: null,
    }),
    supabase.rpc("get_commercial_priorities", {
      target_brand_id: brand.id,
      target_filter: null,
      result_limit: 5,
    }),
  ]);

  if (currentResult.error) throw currentResult.error;
  if (previousResult.error) throw previousResult.error;
  if (objectivesResult.error) throw objectivesResult.error;
  if (prioritiesResult.error) throw prioritiesResult.error;

  const current = asOverview(currentResult.data);
  const previous = asOverview(previousResult.data);
  const objectives = (objectivesResult.data ?? []) as ExecutiveObjective[];
  const priorities = (prioritiesResult.data ?? []) as PriorityRow[];
  const annualRevenueObjective = pickExecutiveObjective(
    objectives,
    "revenue_ht",
    periods.current.start,
    periods.current.fullYearEnd,
  );
  const projectedRevenue = annualRevenueObjective?.projected_value
    ?? runRateProjection(current.revenue_ht, periods.current.start, periods.current.fullYearEnd, periods.current.end);
  const revenueDelta = percentChange(current.revenue_ht, previous.revenue_ht);
  const alerts = buildExecutiveAlerts({
    current,
    previousRevenue: previous.revenue_ht,
    projectedRevenue,
    targetRevenue: annualRevenueObjective?.target_value ?? null,
  });
  const headlineObjectives = objectives
    .filter((objective) => ["revenue_ht", "implantations", "reorders", "first_reorder_rate"].includes(objective.metric_key))
    .slice(0, 4);

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Cockpit Direction · ${brand.name}`}
        title="La trajectoire business, les écarts et les priorités en une page"
        description={`Lecture YTD du ${dateLabel(periods.current.start)} au ${dateLabel(periods.current.end)}, comparée à la même période N-1.`}
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicateurs direction">
        <MetricCard label="CA facturé YTD" value={formatCompactCurrency(current.revenue_ht)} detail="Période courante" icon={TrendingUp} />
        <MetricCard
          label="Évolution vs N-1"
          value={signedPercent(revenueDelta)}
          detail={`${formatCompactCurrency(previous.revenue_ht)} à date l’an dernier`}
          icon={revenueDelta !== null && revenueDelta < 0 ? TrendingDown : TrendingUp}
        />
        <MetricCard
          label="Atterrissage CA"
          value={projectedRevenue === null ? "—" : formatCompactCurrency(projectedRevenue)}
          detail="Run-rate déterministe à date"
          icon={Gauge}
        />
        <MetricCard
          label="Objectif annuel CA"
          value={annualRevenueObjective ? formatCompactCurrency(annualRevenueObjective.target_value) : "Non défini"}
          detail={annualRevenueObjective?.attainment_percent == null ? "Objectif marque" : `${formatCompactPercent(annualRevenueObjective.attainment_percent)} atteint`}
          icon={Target}
        />
        <MetricCard
          label="DN moyenne"
          value={formatCompactPercent(current.avg_distribution_rate)}
          detail={`DN stratégique ${formatCompactPercent(current.strategic_distribution_rate)}`}
          icon={Building2}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Activité commerciale">
        <MiniMetric label="Implantations" value={formatCompactNumber(current.implantations)} />
        <MiniMetric label="Réassorts" value={formatCompactNumber(current.reorders)} />
        <MiniMetric label="Premier réassort" value={formatCompactPercent(current.first_reorder_rate)} />
        <MiniMetric label="Pharmacies actives" value={formatCompactNumber(current.active_pharmacies)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Objectifs de l’exercice</CardTitle>
                <CardDescription>Réalisé, niveau d’atteinte et projection issus des règles de performance TR1.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm"><Link href="/dashboard/network">Voir la performance détaillée</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {headlineObjectives.length ? headlineObjectives.map((objective) => (
              <div key={objective.objective_id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{formatPerformanceMetric(objective.metric_key)}</p>
                    <p className="text-xs text-muted-foreground">{dateLabel(objective.period_start)} → {dateLabel(objective.period_end)}</p>
                  </div>
                  <p className={`text-lg font-bold ${objectiveTone(objective.attainment_percent)}`}>
                    {formatCompactPercent(objective.attainment_percent)}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-muted-foreground">Réalisé</p><p className="font-semibold">{formatPerformanceValue(objective.metric_key, objective.realized_value)}</p></div>
                  <div><p className="text-muted-foreground">Objectif</p><p className="font-semibold">{formatPerformanceValue(objective.metric_key, objective.target_value)}</p></div>
                  <div><p className="text-muted-foreground">Projection</p><p className="font-semibold">{objective.projected_value == null ? "—" : formatPerformanceValue(objective.metric_key, objective.projected_value)}</p></div>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Aucun objectif marque n’est configuré pour l’exercice en cours.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertes Direction</CardTitle>
            <CardDescription>Uniquement les écarts qui appellent une décision ou une action.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.key} className={`rounded-xl border p-4 ${alertClasses(alert.tone)}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">{alert.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Comptes qui demandent une décision</CardTitle>
              <CardDescription>Les priorités commerciales les plus élevées du portefeuille, sans masquer la logique de classement.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm"><Link href="/dashboard/commercial-health">Ouvrir toutes les priorités</Link></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {priorities.length ? priorities.map((priority) => (
            <Link
              key={priority.brand_pharmacy_id}
              href={`/dashboard/pharmacies/${priority.brand_pharmacy_id}`}
              className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{priority.pharmacy_name}</p>
                  <Badge variant={priority.health_status === "at_risk" || priority.health_status === "dormant" ? "destructive" : "secondary"}>
                    {presentationLabel(priority.health_status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{priority.recommendation}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full bg-[var(--tr1-navy)] px-3 py-1 text-sm font-bold text-white">{priority.priority_score}</span>
                <ArrowRight className="size-4" />
              </div>
            </Link>
          )) : (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Aucune priorité commerciale remontée à date.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof TrendingUp }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <Icon className="size-5 text-[var(--tr1-orange)]" />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
