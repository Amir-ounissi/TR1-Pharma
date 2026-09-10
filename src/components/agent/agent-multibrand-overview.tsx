import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, MapPin, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrandContext } from "@/lib/auth";
import { presentationLabel, presentationText } from "@/lib/presentation";

export type AgentMultibrandTask = {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_pharmacy_id: string;
  pharmacy_id: string;
  title: string;
  task_type: string;
  priority: string;
  source: string;
  action_code: string | null;
  rule_code: string | null;
  triggered_at: string | null;
  due_at: string | null;
  snoozed_until: string | null;
  is_overdue: boolean;
  due_state: "unscheduled" | "overdue" | "today" | "upcoming";
  days_overdue: number;
  action_score: number;
  priority_reasons: string[];
  account_activity_status: string | null;
  account_priority_level: string | null;
  potential_level: string | null;
  pharmacy_name: string;
  city: string | null;
};

export type AgentMultibrandMission = {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_pharmacy_id: string;
  pharmacy_id: string;
  title: string;
  objective: string | null;
  scheduled_start_at: string;
  priority: string;
  status: string;
  pharmacy_name: string;
  city: string | null;
};

export type AgentMultibrandReport = {
  id: string;
  brand_id: string;
  brand_name: string;
  mission_id: string;
  title: string;
  brand_pharmacy_id: string;
  pharmacy_id: string;
  report_status: string;
  pharmacy_name: string;
};

export type AgentMultibrandFollowUp = {
  brand_id: string;
  brand_name: string;
  brand_pharmacy_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  city: string | null;
  last_interaction_at: string | null;
  priority: string;
  activity_status: string | null;
  reason: string;
  action_score: number;
};

export type AgentMultibrandDay = {
  tasks: AgentMultibrandTask[];
  missions: AgentMultibrandMission[];
  reports: AgentMultibrandReport[];
  follow_ups: AgentMultibrandFollowUp[];
};

export type AgentMultibrandNextVisit = {
  visit_id: string;
  pharmacy_id: string;
  name: string;
  address: string;
  city: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  visit_kind: string;
  status: string;
  title: string;
  objective: string | null;
  scheduled_at: string;
  scheduled_end_at: string;
  brands: Array<{
    brand_id: string;
    brand_name: string;
    brand_pharmacy_id: string;
    objective: string | null;
    is_primary: boolean;
  }>;
  primary_contact: { name: string; phone: string | null } | null;
};

export type AgentMultibrandVisitSummary = {
  id: string;
  pharmacyName: string;
  city: string | null;
  startAt: string;
  endAt: string | null;
  status: string;
  brandNames: string[];
  href: string;
};

type PriorityAction = {
  key: string;
  href: string;
  score: number;
  title: string;
  brandName: string;
  pharmacyName: string;
  city: string | null;
  timing: string | null;
  overdue: boolean;
  reason: string | null;
};

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "Non planifiée";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function taskActionLabel(task: AgentMultibrandTask) {
  switch (task.action_code) {
    case "post_implantation":
      return "Suivi post-implantation";
    case "activity_watch":
      return "Vérifier l’activité du compte";
    case "activity_at_risk":
      return "Sécuriser le compte à risque";
    case "activity_dormant":
      return "Réactiver le compte dormant";
    default:
      return presentationText(task.title);
  }
}

function followUpActionLabel(followUp: AgentMultibrandFollowUp) {
  switch (followUp.activity_status) {
    case "watch":
      return "Vérifier l’activité du compte";
    case "at_risk":
      return "Sécuriser le compte à risque";
    case "dormant":
      return "Réactiver le compte dormant";
    default:
      return "Programmer une prochaine action";
  }
}

function taskTiming(task: AgentMultibrandTask) {
  if (task.days_overdue > 0) {
    return `Retard ${task.days_overdue} j`;
  }
  if (task.due_state === "today") {
    return "Aujourd’hui";
  }
  if (task.due_state === "unscheduled") {
    return "À planifier";
  }
  return task.due_at ? formatDateTime(task.due_at) : null;
}

function BrandBadge({ name }: { name: string }) {
  return <Badge variant="outline" className="border-[var(--tr1-border)] bg-white/70 text-[var(--tr1-navy)]">{name}</Badge>;
}

function ScopeFilter({ brands, selectedBrandId }: { brands: BrandContext[]; selectedBrandId: string | null }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer par marque">
      <Link
        href="/dashboard/agent"
        className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold transition ${selectedBrandId === null ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white" : "bg-background text-[var(--tr1-navy)]"}`}
      >
        Toutes mes marques
      </Link>
      {brands.map((brand) => (
        <Link
          key={brand.id}
          href={`/dashboard/agent?brand=${brand.id}`}
          className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold transition ${selectedBrandId === brand.id ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white" : "bg-background text-[var(--tr1-navy)]"}`}
        >
          {brand.name}
        </Link>
      ))}
    </div>
  );
}

export function AgentMultibrandOverview({
  brands,
  selectedBrandId,
  day,
  nextVisit,
  visits,
}: {
  brands: BrandContext[];
  selectedBrandId: string | null;
  day: AgentMultibrandDay;
  nextVisit: AgentMultibrandNextVisit | null;
  visits: AgentMultibrandVisitSummary[];
}) {
  const priorityActions: PriorityAction[] = [
    ...day.tasks.map((task) => ({
      key: `task:${task.id}`,
      href: `/dashboard/pharmacies/${task.brand_pharmacy_id}?tab=activity`,
      score: task.action_score,
      title: taskActionLabel(task),
      brandName: task.brand_name,
      pharmacyName: task.pharmacy_name,
      city: task.city,
      timing: taskTiming(task),
      overdue: task.is_overdue,
      reason: task.priority_reasons?.[0] ?? null,
    })),
    ...day.follow_ups.map((followUp) => ({
      key: `follow-up:${followUp.brand_pharmacy_id}`,
      href: `/dashboard/pharmacies/${followUp.brand_pharmacy_id}?tab=activity`,
      score: followUp.action_score,
      title: followUpActionLabel(followUp),
      brandName: followUp.brand_name,
      pharmacyName: followUp.pharmacy_name,
      city: followUp.city,
      timing: null,
      overdue: false,
      reason: followUp.reason,
    })),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const totalPriorityActions = day.tasks.length + day.follow_ups.length;
  const remainingPriorityActions = Math.max(0, totalPriorityActions - priorityActions.length);
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? null;

  return (
    <section className="space-y-4" aria-labelledby="multibrand-day-title">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] font-black uppercase tracking-[0.18em] text-[var(--tr1-orange)]">Bureau commercial</p>
            <h1 id="multibrand-day-title" className="mt-1 text-2xl font-black tracking-tight text-[var(--tr1-navy)] sm:text-3xl">
              Aujourd’hui
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedBrand ? `Vue filtrée · ${selectedBrand.name}` : "Votre journée, toutes cartes réunies."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tags className="size-4" aria-hidden="true" />
            {brands.length} carte{brands.length > 1 ? "s" : ""} connectée{brands.length > 1 ? "s" : ""}
          </div>
        </div>
        <ScopeFilter brands={brands} selectedBrandId={selectedBrandId} />
      </div>

      {nextVisit ? (
        <Card className="overflow-hidden border-[var(--tr1-border)] bg-[var(--tr1-ivory)]">
          <div className="h-1 bg-[var(--tr1-orange)]" />
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--tr1-orange)]">Prochaine visite</p>
                <CardTitle className="mt-1 text-xl font-black text-[var(--tr1-navy)]">{nextVisit.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{nextVisit.address}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-black text-[var(--tr1-navy)]">{formatDateTime(nextVisit.scheduled_at)}</p>
                <Badge variant="secondary" className="mt-1">{presentationLabel(nextVisit.status)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {nextVisit.brands.map((brand) => <BrandBadge key={brand.brand_id} name={brand.brand_name} />)}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objectif commun</p>
                <p className="mt-1 text-sm font-medium text-[var(--tr1-navy)]">{nextVisit.objective || nextVisit.title || "Suivi commercial"}</p>
              </div>
              <Link href="/dashboard/agenda" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tr1-navy)] px-4 text-sm font-semibold text-white">
                <MapPin className="size-4" aria-hidden="true" />
                Ouvrir la visite
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-5">
            <CheckCircle2 className="mt-0.5 size-5 text-[var(--tr1-success)]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[var(--tr1-navy)]">Aucune prochaine visite planifiée.</p>
              <p className="mt-1 text-sm text-muted-foreground">La journée reste disponible pour les relances et la prospection.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tr1-blue)]">Ma tournée du jour</p>
                <CardTitle className="mt-1 text-lg">Une pharmacie, une étape</CardTitle>
              </div>
              <Badge variant="secondary">{visits.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {visits.length ? (
              <div className="divide-y">
                {visits.map((visit) => (
                  <Link key={visit.id} href={visit.href} className="flex min-h-16 items-start gap-3 py-3 transition hover:bg-muted/30">
                    <div className="w-12 shrink-0 pt-0.5 font-mono text-sm font-black text-[var(--tr1-navy)]">{formatTime(visit.startAt)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--tr1-navy)]">{visit.pharmacyName}</p>
                        {visit.city ? <span className="text-xs text-muted-foreground">{visit.city}</span> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {visit.brandNames.map((name) => <BrandBadge key={`${visit.id}:${name}`} name={name} />)}
                      </div>
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">Aucune visite terrain planifiée aujourd’hui.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-[var(--tr1-orange)]" aria-hidden="true" />
                  <CardTitle className="text-base">Actions prioritaires</CardTitle>
                </div>
                <Badge variant="secondary">{totalPriorityActions} à traiter</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {priorityActions.map((action) => (
                <Link key={action.key} href={action.href} className="block rounded-lg border px-3 py-2.5 transition hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-5 text-[var(--tr1-navy)]">{action.title}</p>
                    <BrandBadge name={action.brandName} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {action.pharmacyName}{action.city ? ` · ${action.city}` : ""}
                  </p>
                  {(action.timing || action.reason) ? (
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
                      {action.timing ? (
                        <span className={action.overdue ? "shrink-0 font-semibold text-[var(--tr1-orange)]" : "shrink-0 font-semibold text-[var(--tr1-navy)]"}>
                          {action.timing}
                        </span>
                      ) : null}
                      {action.timing && action.reason ? <span className="text-muted-foreground">·</span> : null}
                      {action.reason ? <span className="truncate text-muted-foreground">{action.reason}</span> : null}
                    </p>
                  ) : null}
                </Link>
              ))}
              {!priorityActions.length ? <p className="py-2 text-sm text-muted-foreground">Aucune action prioritaire.</p> : null}
              {remainingPriorityActions > 0 ? (
                <Link href="/dashboard/tasks" className="flex min-h-9 items-center justify-between rounded-lg px-1 text-sm font-semibold text-[var(--tr1-navy)] hover:underline">
                  Voir les {remainingPriorityActions} autres actions
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-[var(--tr1-blue)]" aria-hidden="true" />
                  <CardTitle className="text-base">À finaliser</CardTitle>
                </div>
                <Badge variant="secondary">{day.reports.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {day.reports.slice(0, 4).map((report) => (
                <Link key={report.id} href={`/dashboard/missions/${report.mission_id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--tr1-navy)]">{presentationText(report.title)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{report.pharmacy_name} · {presentationLabel(report.report_status)}</p>
                  </div>
                  <BrandBadge name={report.brand_name} />
                </Link>
              ))}
              {!day.reports.length ? <p className="py-2 text-sm text-muted-foreground">Aucun compte rendu en attente.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {day.missions.length ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[var(--tr1-blue)]" aria-hidden="true" />
              <CardTitle className="text-base">Missions du jour</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {day.missions.slice(0, 6).map((mission) => (
              <Link key={mission.id} href={`/dashboard/missions/${mission.id}`} className="rounded-lg border p-3 transition hover:bg-muted/30">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--tr1-navy)]">{presentationText(mission.title)}</p>
                  <BrandBadge name={mission.brand_name} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatTime(mission.scheduled_start_at)} · {mission.pharmacy_name}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
