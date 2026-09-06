import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, Gauge, ReceiptText, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import {
  forecastConfidenceLabel,
  forecastGapStatus,
  forecastIntervalLabel,
  getForecastPeriod,
  normalizeRevenueForecast,
  type ForecastExpectedReorder,
} from "@/lib/forecast";
import { formatCompactCurrency, formatCompactNumber, formatCompactPercent } from "@/lib/performance";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function confidenceVariant(confidence: ForecastExpectedReorder["confidence"]): "default" | "secondary" | "outline" {
  if (confidence === "high") return "default";
  if (confidence === "medium") return "secondary";
  return "outline";
}

export default async function ForecastPage() {
  const period = getForecastPeriod();
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["brand_admin", "tr1_manager", "brand_user", "super_admin"].includes(role)) notFound();

  const { data, error } = await supabase.rpc("get_revenue_forecast", {
    target_brand_id: brand.id,
    target_period_start: period.start,
    target_period_end: period.end,
    target_as_of: period.asOf,
  });
  if (error) throw error;

  const forecast = normalizeRevenueForecast(data);
  const gapStatus = forecastGapStatus(forecast.objective_gap_ht);
  const visibleReorders = forecast.expected_reorders.slice(0, 20);

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Forecast · ${brand.name}`}
        title="Comprendre l’atterrissage du chiffre d’affaires avant la fin de l’exercice"
        description={`Projection déterministe au ${dateLabel(forecast.as_of)} : CA réalisé + commandes confirmées + prochains réassorts attendus.`}
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicateurs forecast">
        <MetricCard
          label="CA réalisé"
          value={formatCompactCurrency(forecast.realized_revenue_ht)}
          detail="Facturé / livré à date"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Commandes sécurisées"
          value={formatCompactCurrency(forecast.booked_pipeline_ht)}
          detail="Confirmées, pas encore en CA réalisé"
          icon={ReceiptText}
        />
        <MetricCard
          label="Réassorts attendus"
          value={formatCompactCurrency(forecast.expected_reorder_revenue_ht)}
          detail={`${formatCompactNumber(forecast.expected_reorders_count)} prochain(s) réassort(s)`}
          icon={CalendarClock}
        />
        <MetricCard
          label="Atterrissage déterministe"
          value={formatCompactCurrency(forecast.projected_revenue_ht)}
          detail={`Run-rate simple : ${formatCompactCurrency(forecast.run_rate_projection_ht)}`}
          icon={Gauge}
        />
        <MetricCard
          label="Objectif annuel"
          value={forecast.objective_revenue_ht === null ? "Non défini" : formatCompactCurrency(forecast.objective_revenue_ht)}
          detail={forecast.objective_attainment_projection_percent === null
            ? "Aucun objectif CA exact sur l’exercice"
            : `${formatCompactPercent(forecast.objective_attainment_projection_percent)} projeté`}
          icon={Target}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Construction de l’atterrissage</CardTitle>
            <CardDescription>Chaque composante est visible et additionnée sans coefficient opaque.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ForecastComponent label="CA déjà réalisé" value={forecast.realized_revenue_ht} detail="Base certaine à date" />
            <ForecastComponent label="Commandes confirmées" value={forecast.booked_pipeline_ht} detail="Sécurisées mais pas encore réalisées" />
            <ForecastComponent label="Réassorts attendus" value={forecast.expected_reorder_revenue_ht} detail="Fréquence commerciale × panier moyen" />
            <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--tr1-navy)] p-4 text-white">
              <div>
                <p className="text-sm font-medium">Atterrissage projeté</p>
                <p className="mt-1 text-xs text-white/70">Somme des trois composantes ci-dessus</p>
              </div>
              <p className="text-2xl font-bold">{formatCompactCurrency(forecast.projected_revenue_ht)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Écart à l’objectif et risques</CardTitle>
            <CardDescription>Ce qui peut encore empêcher l’atterrissage annoncé.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {gapStatus === "no_objective" ? (
              <div className="rounded-xl border border-dashed p-4">
                <p className="font-semibold">Objectif annuel non défini</p>
                <p className="mt-1 text-sm text-muted-foreground">Le forecast reste calculé, mais aucun écart à l’objectif ne peut être affiché.</p>
              </div>
            ) : gapStatus === "behind" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Écart restant : {formatCompactCurrency(forecast.objective_gap_ht ?? 0)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">L’atterrissage déterministe reste sous l’objectif annuel.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="font-semibold">Trajectoire au niveau de l’objectif</p>
                <p className="mt-1 text-sm text-muted-foreground">Le forecast déterministe couvre l’objectif annuel à date.</p>
              </div>
            )}

            <RiskLine label="Réassorts déjà en retard" value={forecast.overdue_reorders_count} detail="Exclus du CA projeté tant qu’ils ne sont pas sécurisés" />
            <RiskLine label="Prévisions à confiance faible" value={forecast.low_confidence_expected_reorders_count} detail="Fréquence issue du délai par défaut de la marque" />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Prochains réassorts attendus</CardTitle>
              <CardDescription>La liste qui explique concrètement la composante « réassorts attendus » du forecast.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm"><Link href="/dashboard/commercial-health">Ouvrir les priorités commerciales</Link></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleReorders.length ? visibleReorders.map((reorder) => (
            <Link
              key={reorder.brand_pharmacy_id}
              href={`/dashboard/pharmacies/${reorder.brand_pharmacy_id}`}
              className="grid gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30 md:grid-cols-[1.4fr_.8fr_.7fr_.7fr] md:items-center"
            >
              <div className="min-w-0">
                <p className="font-semibold">{reorder.pharmacy_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[reorder.territory_name, reorder.agent_name].filter(Boolean).join(" · ") || "Portefeuille marque"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date attendue</p>
                <p className="font-medium">{dateLabel(reorder.expected_reorder_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Panier attendu</p>
                <p className="font-semibold">{formatCompactCurrency(reorder.expected_value_ht)}</p>
              </div>
              <div className="flex items-center gap-2 md:justify-end">
                <Badge variant={confidenceVariant(reorder.confidence)}>{forecastConfidenceLabel(reorder.confidence)}</Badge>
                <span className="text-xs text-muted-foreground">{forecastIntervalLabel(reorder.interval_source)}</span>
              </div>
            </Link>
          )) : (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Aucun réassort futur éligible n’est attendu avant la fin de l’exercice selon les données disponibles.
            </p>
          )}
          {forecast.expected_reorders.length > visibleReorders.length ? (
            <p className="pt-2 text-xs text-muted-foreground">20 premières échéances affichées sur {forecast.expected_reorders.length}.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Méthode de calcul</CardTitle>
          <CardDescription>Le forecast reste explicable : aucune décision ou probabilité n’est produite par un modèle opaque.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <MethodLine label="Réalisé" value={forecast.methodology.realized} />
          <MethodLine label="Sécurisé" value={forecast.methodology.booked} />
          <MethodLine label="Réassorts" value={forecast.methodology.expected_reorders} />
          <MethodLine label="Confiance" value={forecast.methodology.confidence} />
          <MethodLine label="Exclusions" value={forecast.methodology.exclusions} />
        </CardContent>
      </Card>
    </main>
  );
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Gauge }) {
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

function ForecastComponent({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <p className="text-xl font-bold">{formatCompactCurrency(value)}</p>
    </div>
  );
}

function RiskLine({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <p className="text-xl font-bold">{formatCompactNumber(value)}</p>
    </div>
  );
}

function MethodLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}
