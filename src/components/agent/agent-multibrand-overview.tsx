import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarPlus, CheckCircle2 } from "lucide-react";
import { getVisitProgress, visitStatusLabel } from "@/lib/agent-day-progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

export function AgentMultibrandOverview({
  day,
  visits,
  plannedVisits,
  canPlanVisit,
}: {
  day: AgentMultibrandDay;
  visits: AgentMultibrandVisitSummary[];
  plannedVisits: AgentMultibrandVisitSummary[];
  canPlanVisit: boolean;
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
  const progress = getVisitProgress(visits);

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
    <section className="space-y-6" aria-label="Exécution de la journée">
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Mon programme</h2>
              <p className="mt-1 text-sm text-muted-foreground">Touchez une visite pour saisir directement son compte rendu et la clôturer.</p>
            </div>
            <Link href="/dashboard/agenda" className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-md px-2 text-sm font-semibold hover:underline focus-visible:ring-2">
              Voir l’agenda <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
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
                    <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--tr1-navy)]">
                      Clôturer <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex items-start gap-3 pb-2">
              <CalendarDays className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-base font-medium">Aucune visite planifiée aujourd’hui</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Ajoutez un rendez-vous depuis votre agenda.</p>
                {canPlanVisit ? <Link href="/dashboard/agenda/new" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--tr1-navy)] px-3.5 py-2 text-sm font-semibold text-white"><CalendarPlus className="size-4" />Planifier une visite</Link> : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {progress.planned > 0 ? (
        <section className="rounded-xl border bg-white/60 p-4" aria-labelledby="day-progress-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="day-progress-title" className="text-sm font-semibold">Progression du jour</h2>
            <span className="text-sm font-semibold tabular-nums">{progress.completed} / {progress.planned} clôturées</span>
          </div>
          <div role="progressbar" aria-label="Visites clôturées aujourd’hui" aria-valuenow={progress.completed} aria-valuemin={0} aria-valuemax={progress.planned} className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--tr1-border)]">
            <div className="h-full rounded-full bg-[var(--tr1-success)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress.percent}%` }} />
          </div>
        </section>
      ) : null}

      {priorityActions.length ? (
        <section className="space-y-3" aria-labelledby="day-priorities-title">
          <h2 id="day-priorities-title" className="text-lg font-semibold">À traiter ensuite <span className="text-muted-foreground">· {priorityActions.length}</span></h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {priorityActions.slice(0, 4).map(actionRow)}
          </div>
          {priorityActions.length > 4 ? (
            <details className="rounded-xl border bg-white/60 p-3">
              <summary className="min-h-11 cursor-pointer touch-manipulation rounded-md py-2.5 text-sm font-semibold focus-visible:ring-2">Voir les {priorityActions.length - 4} autres actions</summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">{priorityActions.slice(4).map(actionRow)}</div>
            </details>
          ) : null}
        </section>
      ) : null}

      {day.reports.length ? (
        <section className="space-y-3" aria-labelledby="day-reports-title">
          <h2 id="day-reports-title" className="text-lg font-semibold">Comptes rendus à terminer</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {day.reports.map((report) => (
              <Link key={report.id} href={`/dashboard/missions/${report.mission_id}`} className="block touch-manipulation rounded-xl border bg-white/60 p-4 transition active:scale-[0.995] hover:bg-white focus-visible:ring-2">
                <BrandBadge name={report.brand_name} />
                <p className="mt-2 text-base font-semibold">{report.pharmacy_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{presentationText(report.title)} · {presentationLabel(report.report_status)}</p>
                <span className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold">Compléter <ArrowRight className="size-4" aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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

      {!priorityActions.length && !day.reports.length && !day.missions.length ? (
        <div className="flex items-start gap-3 rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--tr1-success)]" />
          <p>Aucune autre action terrain prioritaire pour le moment.</p>
        </div>
      ) : null}
    </section>
  );
}
