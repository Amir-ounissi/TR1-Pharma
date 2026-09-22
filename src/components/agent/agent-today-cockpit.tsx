import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarPlus, CheckCircle2, MapPin, TrendingUp } from "lucide-react";
import { HubSpotManualSync } from "@/components/agent/hubspot-manual-sync";

function currency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function visitDate(value: string | null) {
  if (!value) return "Horaire à confirmer";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

type NextVisitFocus = {
  name: string;
  address: string;
  scheduledAt: string | null;
  objective: string;
  href: string;
  ctaLabel: string;
} | null;

export function AgentTodayCockpit({
  brandId,
  brandName,
  monthStart,
  monthLabel,
  revenue,
  orderCount,
  target,
  targetSource,
  pendingVisitCount,
  plannedVisitCount,
  firstName,
  dayLabel,
  nextVisit,
  hubSpotSyncAvailable,
  lastHubSpotSyncAt,
}: {
  brandId: string;
  brandName: string;
  monthStart: string;
  monthLabel: string;
  revenue: number;
  orderCount: number;
  target: number | null;
  targetSource: "official" | "personal" | null;
  pendingVisitCount: number;
  plannedVisitCount: number;
  firstName: string;
  dayLabel: string;
  nextVisit: NextVisitFocus;
  hubSpotSyncAvailable: boolean;
  lastHubSpotSyncAt: string | null;
}) {
  const attainment = target && target > 0 ? (revenue / target) * 100 : null;
  const settingsHref = `/dashboard/agent/settings?month=${encodeURIComponent(monthStart)}`;

  return (
    <section className="space-y-5" aria-labelledby="today-pilot-title">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium capitalize text-muted-foreground">Bonjour {firstName} · {dayLabel}</p>
          <h1 id="today-pilot-title" className="mt-1 text-[2rem] font-bold leading-none tracking-[-0.04em] text-[var(--tr1-navy)] sm:text-[2.5rem]">
            Ma journée
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{brandName} · {plannedVisitCount} {plannedVisitCount === 1 ? "visite" : "visites"} aujourd’hui</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <HubSpotManualSync
            available={hubSpotSyncAvailable}
            lastFullSyncAt={lastHubSpotSyncAt}
          />
          {pendingVisitCount > 0 ? (
            <Link href="/dashboard/agent/closeouts" className="inline-flex min-h-11 items-center gap-2 rounded-[0.65rem] border border-[var(--tr1-orange)]/25 bg-[var(--tr1-orange)]/[0.06] px-3.5 py-2 text-sm font-semibold text-[var(--tr1-navy)] transition hover:bg-[var(--tr1-orange)]/[0.1]">
              <CheckCircle2 className="size-4 text-[var(--tr1-orange)]" />
              {pendingVisitCount} visite{pendingVisitCount > 1 ? "s" : ""} à clôturer
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.55fr)]">
        <article className="rounded-[0.9rem] border border-[var(--tr1-line)] bg-white p-5 shadow-[0_10px_28px_rgb(14_29_49/0.035)] sm:p-6">
          <p className="text-xs font-semibold tracking-[0.03em] text-[var(--tr1-orange)]">{nextVisit ? "Prochaine visite" : "Terrain"}</p>

          {nextVisit ? (
            <div className="mt-3">
              <p className="text-sm font-semibold capitalize text-muted-foreground">{visitDate(nextVisit.scheduledAt)}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[var(--tr1-navy)]">{nextVisit.name}</h2>
              <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>{nextVisit.address}</span>
              </p>
              <div className="mt-5 rounded-[0.75rem] bg-[#f4f6f4] p-4">
                <p className="text-xs font-semibold text-muted-foreground">Objectif de la visite</p>
                <p className="mt-1 text-sm font-medium leading-6 text-[var(--tr1-navy)]">{nextVisit.objective || "Suivi commercial"}</p>
              </div>
              <div className="mt-5">
                <Link href={nextVisit.href} className="inline-flex min-h-11 items-center gap-2 rounded-[0.65rem] bg-[var(--tr1-navy)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--tr1-navy-soft)]">
                  {nextVisit.ctaLabel} <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <h2 className="text-xl font-semibold text-[var(--tr1-navy)]">Aucune visite à venir</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Votre agenda est libre. Ajoutez une pharmacie à votre tournée ou utilisez vos priorités plus bas pour préparer la suite.</p>
              <Link href={`/dashboard/agenda/new?mode=quick&brand=${encodeURIComponent(brandId)}`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[0.65rem] bg-[var(--tr1-navy)] px-4 py-2 text-sm font-semibold text-white">
                <CalendarPlus className="size-4" /> Planifier une visite
              </Link>
            </div>
          )}
        </article>

        <aside className="rounded-[0.9rem] border border-[var(--tr1-line)] bg-white p-5 shadow-[0_10px_28px_rgb(14_29_49/0.035)]" aria-label="Performance du mois">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Performance · {monthLabel}</p>
              <p className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[var(--tr1-navy)] tabular-nums">{currency(revenue)}</p>
            </div>
            <TrendingUp className="size-5 text-[var(--tr1-orange)]" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <p className="text-xs text-muted-foreground">Commandes</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{orderCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Objectif atteint</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{attainment == null ? "—" : `${attainment.toFixed(0)} %`}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-[var(--tr1-orange)]" style={{ width: `${Math.min(100, Math.max(0, attainment ?? 0))}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{target ? `${currency(revenue)} / ${currency(target)}` : "Objectif non défini"}</p>
          </div>

          <Link href="/dashboard/agent/performance" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[0.65rem] border px-3 py-2 text-sm font-semibold text-[var(--tr1-navy)] hover:bg-muted">
            Voir ma performance <ArrowRight className="size-4" />
          </Link>
          {targetSource !== "official" ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              L’objectif se règle dans <Link href={settingsHref} className="font-semibold text-[var(--tr1-navy)] underline-offset-4 hover:underline">Paramètres</Link>.
            </p>
          ) : null}
        </aside>
      </div>

      {!nextVisit || pendingVisitCount > 0 ? (
        <nav aria-label="Raccourcis de la journée" className="flex flex-wrap gap-2">
          {!nextVisit ? (
            <>
              <Link href={`/dashboard/agenda/new?mode=quick&brand=${encodeURIComponent(brandId)}`} className="inline-flex min-h-11 items-center gap-2 rounded-[0.65rem] border bg-white px-3.5 py-2 text-sm font-semibold text-[var(--tr1-navy)] hover:bg-muted">
                <CalendarPlus className="size-4 text-[var(--tr1-orange)]" /> Ajouter une visite
              </Link>
              <Link href="/dashboard/agenda" className="inline-flex min-h-11 items-center gap-2 rounded-[0.65rem] border bg-white px-3.5 py-2 text-sm font-semibold text-[var(--tr1-navy)] hover:bg-muted">
                <CalendarDays className="size-4" /> Agenda
              </Link>
            </>
          ) : null}
          {pendingVisitCount > 0 ? (
            <Link href="/dashboard/agent/closeouts" className="inline-flex min-h-11 items-center gap-2 rounded-[0.65rem] border bg-white px-3.5 py-2 text-sm font-semibold text-[var(--tr1-navy)] hover:bg-muted">
              <CheckCircle2 className="size-4" /> Clôturer
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
