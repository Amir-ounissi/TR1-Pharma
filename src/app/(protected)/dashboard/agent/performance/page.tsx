import Link from "next/link";
import { ArrowRight, Gauge, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { SectionHeader } from "@/components/ux/section-header";
import { requireActiveBrand } from "@/lib/auth";
import { nextIsoDate, parisYearToDate } from "@/lib/business-date";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCompactPercent,
  formatPerformanceMetric,
  formatPerformanceValue,
  objectiveTone,
} from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type SearchParams = Promise<{ from?: string; to?: string }>;

type ObjectiveRow = {
  objective_id: string;
  metric_key: string;
  target_value: number;
  realized_value: number;
  attainment_percent: number | null;
  projected_value: number | null;
  note: string | null;
};

type NetworkRow = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  health_status: string;
  recommendation: string;
  has_next_action: boolean;
  next_action_at: string | null;
  distribution_rate: number;
  strategic_distribution_rate: number | null;
};

function parseDate(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

export default async function AgentPerformancePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const defaultPeriod = parisYearToDate();
  const from = parseDate(query.from, defaultPeriod.from);
  const to = parseDate(query.to, defaultPeriod.to);
  const { supabase, brand, profile, userId } = await requireActiveBrand();
  const [
    { data: overview },
    { data: objectives },
    { data: networkRows },
    { data: priorities },
    { count: orderCount },
  ] = await Promise.all([
    supabase.rpc("get_performance_overview", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: from,
      target_filter_end: to,
      target_scope_type: null,
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase.rpc("get_performance_network", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase.rpc("get_commercial_priorities", {
      target_brand_id: brand.id,
      target_filter: null,
      result_limit: 5,
    }),
    supabase
      .from("performance_order_facts")
      .select("order_id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("agent_user_id_at_order", userId)
      .gte("order_date", `${from}T00:00:00.000Z`)
      .lt("order_date", `${nextIsoDate(to)}T00:00:00.000Z`),
  ]);

  const summary = (overview ?? {}) as Record<string, number | null>;
  const objectiveRows = (objectives ?? []) as ObjectiveRow[];
  const topObjectives = objectiveRows
    .filter((objective) => ["revenue_ht", "implantations", "reorders", "first_reorder_rate"].includes(objective.metric_key))
    .slice(0, 4);
  const portfolio = (networkRows ?? []) as NetworkRow[];
  const firstName = profile.full_name.split(" ")[0];

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Ma performance · ${brand.name}`}
        title={`Où en es-tu, ${firstName} ?`}
        description="Lis ton avancement, ton activité réelle, l’état de ton portefeuille et les comptes à traiter sans te perdre dans 20 KPI plats."
        tone="dark"
      />

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap gap-3">
            <input className="h-10 rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} />
            <input className="h-10 rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} />
            <button className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Mettre à jour</button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Par défaut : depuis le 1er janvier de l’année en cours.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeader id="where-i-stand" title="Où j’en suis" description="Les 3 à 4 objectifs qui doivent guider ta journée." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {topObjectives.length ? topObjectives.map((objective) => (
            <Card key={objective.objective_id}>
              <CardContent className="pt-5">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--tr1-orange)]">{formatPerformanceMetric(objective.metric_key)}</p>
                <p className={`mt-3 text-2xl font-semibold ${objectiveTone(objective.attainment_percent)}`}>
                  {objective.attainment_percent == null ? "—" : `${objective.attainment_percent.toFixed(1)} %`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatPerformanceValue(objective.metric_key, objective.realized_value)} / {formatPerformanceValue(objective.metric_key, objective.target_value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Projection {objective.projected_value == null ? "—" : formatPerformanceValue(objective.metric_key, objective.projected_value)}
                </p>
              </CardContent>
            </Card>
          )) : (
            <>
              <MetricCard icon={Target} label="CA commandé HT" value={formatCompactCurrency(summary.booked_revenue_ht)} detail="Commandes confirmées" />
              <MetricCard icon={TrendingUp} label="Implantations" value={formatCompactNumber(summary.implantations)} detail="Sur la période" />
              <MetricCard icon={Gauge} label="Premier réassort" value={formatCompactPercent(summary.first_reorder_rate)} detail="Lecture éligible" />
              <MetricCard icon={ArrowRight} label="Réassorts" value={formatCompactNumber(summary.reorders)} detail="Rythme terrain" />
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Mon activité</CardTitle>
            <CardDescription>Ce que tu as réellement exécuté et déclaré.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Detail label="Commandes" value={formatCompactNumber(orderCount)} />
            <Detail label="CA commandé HT" value={formatCompactCurrency(summary.booked_revenue_ht)} />
            <Detail label="CA facturé HT" value={formatCompactCurrency(summary.revenue_ht)} />
            <Detail label="Implantations" value={formatCompactNumber(summary.implantations)} />
            <Detail label="Réassorts" value={formatCompactNumber(summary.reorders)} />
            <Detail label="Missions réalisées" value={formatCompactNumber(summary.missions_completed)} />
            <Detail label="Animations" value={formatCompactNumber(summary.animations_completed)} />
            <Detail label="Sell-out animation" value={`${formatCompactNumber(summary.sell_out_units)} unités`} />
            <Detail label="Moyenne unités / animation" value={summary.average_units_per_animation == null ? "—" : `${formatCompactNumber(summary.average_units_per_animation)} unités`} />
            <Detail label="Formations" value={formatCompactNumber(summary.trainings_completed)} />
            <Detail label="Participants formés" value={formatCompactNumber(summary.participants_count)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mon portefeuille</CardTitle>
            <CardDescription>Portefeuille actif, à risque, dormant et niveau d’assortiment actuel.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Detail label="Pharmacies actives" value={formatCompactNumber(summary.active_pharmacies)} />
            <Detail label="À risque" value={formatCompactNumber(summary.at_risk_accounts)} />
            <Detail label="Dormantes" value={formatCompactNumber(summary.dormant_accounts)} />
            <Detail label="Sans prochaine action" value={formatCompactNumber(summary.without_next_action_count)} />
            <Detail label="Assortiment moyen" value={formatCompactPercent(summary.avg_distribution_rate)} />
            <Detail label="Assortiment stratégique" value={formatCompactPercent(summary.strategic_distribution_rate)} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader id="where-to-act" title="Où agir" description="Des recommandations actionnables, pas un classement agressif." />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Comptes à traiter maintenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(priorities ?? []).length ? (priorities ?? []).map((row: Record<string, unknown>) => (
                <Link
                  key={String(row.brand_pharmacy_id)}
                  href={`/dashboard/pharmacies/${String(row.brand_pharmacy_id)}`}
                  className="flex items-center justify-between gap-4 rounded-[0.4rem] border border-[var(--tr1-line)] p-3 hover:bg-white/45"
                >
                  <div>
                    <p className="font-semibold">{String(row.pharmacy_name)}</p>
                    <p className="text-sm text-muted-foreground">{presentationLabel(String(row.health_status))} · {String(row.recommendation)}</p>
                  </div>
                  <Badge variant="secondary">{String(row.priority_score)}</Badge>
                </Link>
              )) : <p className="text-sm text-muted-foreground">Aucune priorité remontée pour le moment.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comptes suivis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {portfolio.slice(0, 6).map((row) => (
                <Link key={row.brand_pharmacy_id} href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`} className="block rounded-[0.4rem] border border-[var(--tr1-line)] p-3 hover:bg-white/45">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{row.pharmacy_name}</p>
                    <Badge variant="outline">{presentationLabel(row.health_status)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{row.recommendation}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assortiment {formatCompactPercent(row.distribution_rate)} · Strat. {formatCompactPercent(row.strategic_distribution_rate)} · {row.has_next_action ? "Suivi planifié" : "Aucune prochaine action"}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Icon className="size-4 text-[var(--tr1-orange)]" />
        <p className="mt-3 text-2xl font-semibold">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
