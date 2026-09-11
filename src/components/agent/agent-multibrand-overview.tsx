import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CalendarPlus, CheckCircle2, ClipboardCheck, MapPin, Megaphone, Route } from "lucide-react";
import { getVisitProgress, visitStatusLabel } from "@/lib/agent-day-progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  pharmacyId: string;
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
  brandId: string;
  brandName: string;
  pharmacyId: string;
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
  if (task.days_overdue > 0) return `Retard ${task.days_overdue} j`;
  if (task.due_state === "today") return "Aujourd’hui";
  if (task.due_state === "unscheduled") return "À programmer";
  return task.due_at ? formatDateTime(task.due_at) : null;
}

function BrandBadge({ name }: { name: string }) {
  return <span className="inline-flex rounded-full border border-[var(--tr1-border)] bg-white/70 px-2.5 py-1 text-xs font-medium text-[var(--tr1-navy)]">{name}</span>;
}

function ScopeFilter({ brands, selectedBrandId }: { brands: BrandContext[]; selectedBrandId: string | null }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Marques affichées dans la journée">
      <Link href="/dashboard/agent" aria-current={selectedBrandId === null ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)] focus-visible:ring-offset-2 text-sm font-semibold transition active:scale-[0.98] ${selectedBrandId === null ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white" : "bg-background text-[var(--tr1-navy)]"}`}>Toutes mes marques</Link>
      {brands.map((brand) => (
        <Link key={brand.id} href={`/dashboard/agent?brand=${brand.id}`} aria-current={selectedBrandId === brand.id ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)] focus-visible:ring-offset-2 text-sm font-semibold transition active:scale-[0.98] ${selectedBrandId === brand.id ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white" : "bg-background text-[var(--tr1-navy)]"}`}>{brand.name}</Link>
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
  plannedVisits,
  firstName,
  dayLabel,
  canPlanVisit,
  canRequestAnimation,
}: {
  brands: BrandContext[];
  selectedBrandId: string | null;
  day: AgentMultibrandDay;
  nextVisit: AgentMultibrandNextVisit | null;
  visits: AgentMultibrandVisitSummary[];
  plannedVisits: AgentMultibrandVisitSummary[];
  firstName: string;
  dayLabel: string;
  canPlanVisit: boolean;
  canRequestAnimation: boolean;
}) {
  const priorityActions: PriorityAction[] = [
    ...day.tasks.map((task) => ({
      key: `task:${task.id}`,
      href: `/dashboard/pharmacies/${task.brand_pharmacy_id}?tab=activity`,
      score: task.action_score,
      title: taskActionLabel(task),
      brandId: task.brand_id,
      brandName: task.brand_name,
      pharmacyId: task.pharmacy_id,
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
      brandId: followUp.brand_id,
      brandName: followUp.brand_name,
      pharmacyId: followUp.pharmacy_id,
      pharmacyName: followUp.pharmacy_name,
      city: followUp.city,
      timing: null,
      overdue: false,
      reason: followUp.reason,
    })),
  ].sort((a, b) => b.score - a.score);
  const totalPriorityActions = day.tasks.length + day.follow_ups.length;
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? null;
  const progress = getVisitProgress(visits);
  const firstAction = priorityActions[0];
  const firstReport = day.reports[0];
  const nextVisitHref = nextVisit
    ? `/dashboard/agenda?date=${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nextVisit.scheduled_at))}`
    : "/dashboard/agenda";
  const primary = firstAction
    ? { title: firstAction.title, detail: `${firstAction.pharmacyName} · ${firstAction.brandName}`, href: firstAction.href, label: "Consulter cette priorité" }
    : firstReport
      ? { title: "Finalisez votre compte rendu", detail: `${firstReport.pharmacy_name} · ${firstReport.brand_name}`, href: `/dashboard/missions/${firstReport.mission_id}`, label: "Compléter le compte rendu" }
      : nextVisit
        ? { title: "Préparez votre prochaine visite", detail: `${nextVisit.name} · ${formatDateTime(nextVisit.scheduled_at)}`, href: nextVisitHref, label: "Voir la visite dans l’agenda" }
        : { title: "Préparez votre prochaine visite", detail: "Aucune visite planifiée. Retrouvez votre agenda pour organiser la suite.", href: canPlanVisit ? "/dashboard/agenda/new" : "/dashboard/agenda", label: canPlanVisit ? "Planifier une visite" : "Consulter mon agenda" };

  function actionRow(action: PriorityAction) {
    const existingVisit = plannedVisits.find(
      (visit) =>
        visit.pharmacyId === action.pharmacyId &&
        !["completed", "cancelled", "canceled", "missed"].includes(visit.status.toLowerCase()),
    );
    const params = new URLSearchParams({
      pharmacy: action.pharmacyId,
      brand: action.brandId,
      objective: action.title,
    });
    const planningHref = `/dashboard/agenda/new?${params.toString()}`;

    return (
      <article key={action.key} className="relative overflow-hidden rounded-xl border bg-white/60 p-4 transition active:scale-[0.995] hover:border-[var(--tr1-orange)] hover:bg-white">
        <Link
          href={action.href}
          aria-label={`Ouvrir ${action.pharmacyName} — ${action.title}`}
          className="absolute inset-0 z-0 touch-manipulation rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] focus-visible:ring-inset"
        >
          <span className="sr-only">Ouvrir la priorité</span>
        </Link>
        <div className="pointer-events-none relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BrandBadge name={action.brandName} />
            {action.timing ? <span className={`text-sm font-semibold ${action.overdue ? "text-[#a74413]" : "text-muted-foreground"}`}>{action.timing}</span> : null}
          </div>
          <p className="mt-2 break-words text-base font-semibold text-[var(--tr1-navy)]">{action.pharmacyName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{action.title}{action.city ? ` · ${action.city}` : ""}</p>
          {action.reason ? <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canPlanVisit ? (
              <Link href={existingVisit?.href || planningHref} className="pointer-events-auto relative z-20 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-lg bg-[var(--tr1-navy)] px-3.5 py-2 text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)] focus-visible:ring-offset-2">
                <CalendarPlus className="size-4" aria-hidden="true" />
                {existingVisit ? "Voir la visite" : "Planifier une visite"}
              </Link>
            ) : null}
            <span className="inline-flex min-h-11 items-center gap-2 px-2 py-2 text-sm font-semibold text-[var(--tr1-navy)]">
              Ouvrir la fiche <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="multibrand-day-title">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium capitalize text-muted-foreground">Bonjour {firstName} · {dayLabel}</p>
            <h1 id="multibrand-day-title" className="mt-1 break-words text-3xl font-bold tracking-tight text-[var(--tr1-navy)] sm:text-4xl">Aujourd’hui</h1>
            <p className="mt-2 text-base text-muted-foreground">Ma journée · {selectedBrand?.name ?? "Toutes mes marques"}</p>
          </div>
          <p className="text-sm text-muted-foreground">{brands.length} marque{brands.length > 1 ? "s" : ""} disponible{brands.length > 1 ? "s" : ""}</p>
        </div>
        <ScopeFilter brands={brands} selectedBrandId={selectedBrandId} />
      </header>

      <Link
        href={primary.href}
        aria-labelledby="next-step-title"
        className="block touch-manipulation rounded-2xl bg-[var(--tr1-navy)] p-5 text-white shadow-sm transition active:scale-[0.995] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] focus-visible:ring-offset-2 sm:p-7"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#ffb67e]">Votre prochaine étape</p>
            <h2 id="next-step-title" className="mt-2 break-words text-2xl font-semibold leading-tight">{primary.title}</h2>
            <p className="mt-2 break-words text-base leading-relaxed text-slate-200">{primary.detail}</p>
            {nextVisit && !firstAction && !firstReport ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-slate-200">{nextVisit.address}</p>
                {nextVisit.objective ? <p className="text-sm text-slate-200">Objectif : {nextVisit.objective}</p> : null}
                <div className="flex flex-wrap gap-2">{nextVisit.brands.map((visitBrand) => <BrandBadge key={visitBrand.brand_id} name={visitBrand.brand_name} />)}</div>
              </div>
            ) : null}
          </div>
          <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#ffb67e] px-5 py-3 text-center text-base font-semibold text-[#142033] transition group-hover:bg-[#ffc99f]">
            {nextVisit || firstAction || firstReport ? <ArrowRight className="size-5 shrink-0" aria-hidden="true" /> : <CalendarPlus className="size-5 shrink-0" aria-hidden="true" />}
            {primary.label}
          </span>
        </div>
      </Link>

      <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border bg-white/60 px-4 py-3 text-sm" aria-label="État du suivi">
        <span className="inline-flex items-center gap-2"><Route className="size-4" aria-hidden="true" />{progress.planned ? `${progress.planned} visite${progress.planned > 1 ? "s" : ""} au programme` : "Aucune visite aujourd’hui"}</span>
        <span className="inline-flex items-center gap-2">{totalPriorityActions ? <AlertTriangle className="size-4 text-[#a74413]" aria-hidden="true" /> : <CheckCircle2 className="size-4 text-[var(--tr1-success)]" aria-hidden="true" />}{totalPriorityActions ? `${totalPriorityActions} priorité${totalPriorityActions > 1 ? "s" : ""} à consulter` : "Aucune action prioritaire"}</span>
        <span className="inline-flex items-center gap-2"><ClipboardCheck className="size-4" aria-hidden="true" />{day.reports.length ? `${day.reports.length} compte${day.reports.length > 1 ? "s" : ""} rendu${day.reports.length > 1 ? "s" : ""} à terminer` : "Aucun compte rendu en attente"}</span>
      </div>

      <div className={`grid items-start gap-6 ${priorityActions.length || day.reports.length ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : ""}`}>
        <div className="min-w-0 space-y-5">
          <Card className="rounded-xl">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Mon programme</h2>
                <Link href="/dashboard/agenda" className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-md px-2 text-sm font-semibold hover:underline focus-visible:ring-2">Voir l’agenda <ArrowRight className="size-4" aria-hidden="true" /></Link>
              </div>
            </CardHeader>
            <CardContent>
              {visits.length ? (
                <ol className="divide-y">
                  {visits.map((visit) => (
                    <li key={visit.id}>
                      <Link href={visit.href} className="flex min-h-[4.75rem] touch-manipulation items-start gap-3 rounded-md py-4 transition active:bg-muted/50 hover:bg-muted/30 focus-visible:ring-2">
                        <time dateTime={visit.startAt} className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatTime(visit.startAt)}</time>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-base font-semibold">{visit.pharmacyName}</p>
                          {visit.city ? <p className="mt-1 text-sm text-muted-foreground">{visit.city}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-1.5">{visit.brandNames.map((name) => <BrandBadge key={`${visit.id}:${name}`} name={name} />)}</div>
                          <p className="mt-2 text-sm text-muted-foreground">{visitStatusLabel(visit.status)}</p>
                        </div>
                        <ArrowRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex items-start gap-3 pb-2">
                  <CalendarDays className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div><p className="text-base font-medium">Aucune visite planifiée aujourd’hui</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Ajoutez un rendez-vous depuis votre agenda.</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          {(canPlanVisit || canRequestAnimation) ? (
            <Card className="rounded-xl">
              <CardHeader>
                <div>
                  <h2 className="text-lg font-semibold">Actions rapides</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Les actions terrain les plus fréquentes, sans détour.</p>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {canPlanVisit ? (
                  <Link href="/dashboard/agenda/new" className="flex min-h-14 touch-manipulation items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-semibold transition active:scale-[0.99] hover:border-[var(--tr1-orange)] hover:bg-orange-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]">
                    <CalendarPlus className="size-5 text-[var(--tr1-navy)]" aria-hidden="true" />
                    Planifier une visite
                  </Link>
                ) : null}
                {canRequestAnimation ? (
                  <Link href="/dashboard/missions/new?mode=animation" className="flex min-h-14 touch-manipulation items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-semibold transition active:scale-[0.99] hover:border-[var(--tr1-orange)] hover:bg-orange-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]">
                    <Megaphone className="size-5 text-[var(--tr1-navy)]" aria-hidden="true" />
                    Demander une animation
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {nextVisit && (firstAction || firstReport) ? (
            <Link href={nextVisitHref} className="block touch-manipulation rounded-xl border bg-white/60 p-4 transition active:scale-[0.995] hover:border-[var(--tr1-orange)] hover:bg-white focus-visible:ring-2">
              <p className="text-sm text-muted-foreground">Prochaine visite · {formatDateTime(nextVisit.scheduled_at)}</p>
              <p className="mt-1 text-base font-semibold">{nextVisit.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{nextVisit.address}</p>
              <span className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><MapPin className="size-4" aria-hidden="true" />Voir dans l’agenda</span>
            </Link>
          ) : null}

          {progress.planned > 0 ? (
            <section className="rounded-xl border bg-white/60 p-5" aria-labelledby="day-progress-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="day-progress-title" className="text-base font-semibold">Votre progression du jour</h2>
                <span className="text-sm font-semibold tabular-nums">{progress.completed} / {progress.planned} visites réalisées</span>
              </div>
              <div role="progressbar" aria-label="Visites réalisées aujourd’hui" aria-valuenow={progress.completed} aria-valuemin={0} aria-valuemax={progress.planned} aria-valuetext={`${progress.completed} visites réalisées sur ${progress.planned} programmées`} className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--tr1-border)]">
                <div className="h-full rounded-full bg-[var(--tr1-success)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress.percent}%` }} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{progress.completed === progress.planned ? "Toutes les visites au programme ont été réalisées." : "La progression suit les visites marquées comme terminées."}{progress.missed ? ` ${progress.missed} non effectuée${progress.missed > 1 ? "s" : ""}.` : ""}</p>
            </section>
          ) : null}
        </div>

        {priorityActions.length || day.reports.length ? (
          <div className="min-w-0 space-y-5">
            {priorityActions.length ? (
              <section className="space-y-3" aria-labelledby="day-priorities-title">
                <h2 id="day-priorities-title" className="text-lg font-semibold">Mes priorités <span className="text-muted-foreground">· {totalPriorityActions}</span></h2>
                {priorityActions.slice(0, 3).map(actionRow)}
                {priorityActions.length > 3 ? <details className="rounded-xl border bg-white/60 p-3"><summary className="min-h-11 cursor-pointer touch-manipulation rounded-md py-2.5 text-sm font-semibold focus-visible:ring-2">Voir les {priorityActions.length - 3} autres priorités</summary><div className="mt-3 space-y-3">{priorityActions.slice(3).map(actionRow)}</div></details> : null}
              </section>
            ) : null}
            {day.reports.length ? (
              <section className="space-y-3" aria-labelledby="day-reports-title">
                <h2 id="day-reports-title" className="text-lg font-semibold">Comptes rendus à terminer</h2>
                {day.reports.map((report) => (
                  <Link key={report.id} href={`/dashboard/missions/${report.mission_id}`} className="block touch-manipulation rounded-xl border bg-white/60 p-4 transition active:scale-[0.995] hover:bg-white focus-visible:ring-2">
                    <BrandBadge name={report.brand_name} />
                    <p className="mt-2 text-base font-semibold">{report.pharmacy_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{presentationText(report.title)} · {presentationLabel(report.report_status)}</p>
                    <span className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold">Compléter <ArrowRight className="size-4" aria-hidden="true" /></span>
                  </Link>
                ))}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>

      {day.missions.length ? (
        <section className="space-y-3" aria-labelledby="day-missions-title">
          <h2 id="day-missions-title" className="text-lg font-semibold">Missions du jour</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {day.missions.map((mission) => (
              <Link key={mission.id} href={`/dashboard/missions/${mission.id}`} className="touch-manipulation rounded-xl border bg-white/60 p-4 transition active:scale-[0.995] hover:bg-white focus-visible:ring-2">
                <BrandBadge name={mission.brand_name} />
                <p className="mt-2 text-base font-semibold">{presentationText(mission.title)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{formatTime(mission.scheduled_start_at)} · {mission.pharmacy_name}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
