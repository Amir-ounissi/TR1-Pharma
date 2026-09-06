import Link from "next/link";
import { CalendarClock, CheckCircle2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { NextBestActionForm } from "@/components/commercial/next-best-action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  nextBestActionConfidenceDetail,
  nextBestActionConfidenceLabel,
  summarizeNextBestActions,
  type NextBestActionRow,
} from "@/lib/next-best-action";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function confidenceVariant(value: NextBestActionRow["confidence"]) {
  if (value === "high") return "default" as const;
  if (value === "medium") return "secondary" as const;
  return "outline" as const;
}

function evidenceLabel(evidence: Record<string, unknown>) {
  const source = evidence.interval_source;
  if (source === "median") return "Cadence propre au compte · médiane";
  if (source === "average") return "Cadence propre au compte · moyenne";
  if (source === "brand_fallback") return "Cadence issue de la règle marque";
  return "Signal commercial observable";
}

export function NextBestActionPanel({ rows, canCreateTasks }: { rows: NextBestActionRow[]; canCreateTasks: boolean }) {
  const summary = summarizeNextBestActions(rows);
  const visibleRows = rows.slice(0, 5);

  return (
    <section className="space-y-4" aria-labelledby="next-best-action-title">
      <Card className="overflow-hidden border-[var(--tr1-navy)]/15">
        <CardHeader className="bg-[var(--tr1-navy)] text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/75">
                <Sparkles className="size-4" />
                Décision commerciale explicable
              </div>
              <CardTitle id="next-best-action-title" className="text-2xl text-white">Next Best Action</CardTitle>
              <CardDescription className="mt-2 text-white/70">
                Recommandations déterministes issues des règles de la marque, de la cadence de commande et de signaux observables.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/85">
              <ShieldCheck className="size-4" />
              Aucune action n’est créée automatiquement.
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Recommandations" value={summary.total} icon={Target} />
          <SummaryMetric label="À traiter maintenant" value={summary.dueNow} icon={CalendarClock} />
          <SummaryMetric label="Premiers réassorts" value={summary.firstReorders} icon={Sparkles} />
          <SummaryMetric label="Sans action ouverte" value={summary.withoutExistingAction} icon={CheckCircle2} />
        </CardContent>
      </Card>

      {visibleRows.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleRows.map((row, index) => (
            <Card key={row.brand_pharmacy_id} data-testid="next-best-action-card" className={index === 0 ? "border-[#efb184]" : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {index === 0 ? <Badge>Priorité #1</Badge> : null}
                      <Badge variant={confidenceVariant(row.confidence)}>{nextBestActionConfidenceLabel(row.confidence)}</Badge>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">Score {row.action_score}/100</span>
                    </div>
                    <CardTitle className="text-lg">{row.action_label}</CardTitle>
                    <CardDescription className="mt-1">{row.pharmacy_name} · {row.territory_name || row.city || "Territoire non renseigné"}</CardDescription>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>Échéance proposée</p>
                    <p className="mt-1 font-semibold text-foreground">{dateLabel(row.suggested_due_at)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-muted/35 p-3 text-sm">
                  <p className="font-semibold">Pourquoi TR1 la recommande</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {row.rationale.slice(0, 4).map((reason) => <li key={reason}>• {reason}</li>)}
                  </ul>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p><span className="font-semibold text-foreground">Source :</span> {evidenceLabel(row.evidence)}</p>
                  <p title={nextBestActionConfidenceDetail(row.confidence)}><span className="font-semibold text-foreground">Confiance :</span> {nextBestActionConfidenceDetail(row.confidence)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="outline" className="sm:flex-1">
                    <Link href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`}>Voir la fiche</Link>
                  </Button>
                  <div className="sm:flex-1">
                    {row.has_next_action ? (
                      <div className="grid h-full min-h-10 place-items-center rounded-md border bg-muted/30 px-3 text-center text-xs font-medium text-muted-foreground">
                        Une action est déjà ouverte — aucune duplication proposée.
                      </div>
                    ) : canCreateTasks ? (
                      <NextBestActionForm
                        brandPharmacyId={row.brand_pharmacy_id}
                        actionType={row.action_type}
                        actionLabel={row.action_label}
                        suggestedDueAt={row.suggested_due_at}
                      />
                    ) : (
                      <div className="grid h-full min-h-10 place-items-center rounded-md border bg-muted/30 px-3 text-center text-xs font-medium text-muted-foreground">
                        Lecture seule — la création d’action est réservée aux managers et administrateurs.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucune action prioritaire n’est recommandée à date.</CardContent></Card>
      )}
    </section>
  );
}

function SummaryMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Target }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>
      <Icon className="size-5 text-[var(--tr1-orange)]" />
    </div>
  );
}
