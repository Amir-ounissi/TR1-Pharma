import Link from "next/link";
import { CalendarDays, CalendarPlus, CheckCircle2, TrendingUp } from "lucide-react";

function currency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

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
}) {
  const attainment = target && target > 0 ? (revenue / target) * 100 : null;
  const settingsHref = `/dashboard/agent/settings?month=${encodeURIComponent(monthStart)}`;

  return (
    <section className="space-y-4" aria-labelledby="today-pilot-title">
      <header>
        <p className="text-sm font-medium capitalize text-muted-foreground">
          Bonjour {firstName} · {dayLabel}
        </p>
        <h1 id="today-pilot-title" className="mt-1 text-3xl font-bold tracking-tight text-[var(--tr1-navy)] sm:text-4xl">
          Aujourd’hui
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Ma journée · {brandName}</p>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--tr1-line)] bg-white/70 p-3 sm:grid-cols-4">
        <Link href="/dashboard/agenda" className="rounded-xl p-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]">
          <p className="text-xs text-muted-foreground">Visites aujourd’hui</p>
          <p className="mt-1 text-xl font-semibold text-[var(--tr1-navy)]">{plannedVisitCount}</p>
        </Link>
        <Link href="/dashboard/agent/closeouts" className="rounded-xl p-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]">
          <p className="text-xs text-muted-foreground">À clôturer</p>
          <p className="mt-1 text-xl font-semibold text-[var(--tr1-navy)]">{pendingVisitCount}</p>
        </Link>
        <Link href="/dashboard/agent/performance" className="rounded-xl p-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]">
          <p className="text-xs text-muted-foreground">CA · {monthLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[var(--tr1-navy)]">{currency(revenue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{orderCount} commande{orderCount > 1 ? "s" : ""}</p>
        </Link>
        <Link href="/dashboard/agent/performance" className="rounded-xl p-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]">
          <p className="text-xs text-muted-foreground">Objectif</p>
          <p className="mt-1 text-xl font-semibold text-[var(--tr1-navy)]">
            {attainment == null ? "—" : `${attainment.toFixed(0)} %`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{target ? `${currency(revenue)} / ${currency(target)}` : "Non défini"}</p>
        </Link>
      </div>

      <nav aria-label="Raccourcis de la journée" className="flex flex-wrap gap-2">
        <Link href={`/dashboard/agenda/new?mode=quick&brand=${encodeURIComponent(brandId)}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--tr1-navy)] px-3.5 py-2 text-sm font-semibold text-white">
          <CalendarPlus className="size-4" /> Ajouter une visite
        </Link>
        <Link href="/dashboard/agenda" className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold text-[var(--tr1-navy)]">
          <CalendarDays className="size-4" /> Agenda
        </Link>
        {pendingVisitCount > 0 ? (
          <Link href="/dashboard/agent/closeouts" className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold text-[var(--tr1-navy)]">
            <CheckCircle2 className="size-4" /> Clôturer
          </Link>
        ) : null}
        <Link href="/dashboard/agent/performance" className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold text-[var(--tr1-navy)]">
          <TrendingUp className="size-4" /> Performance
        </Link>
      </nav>

      {targetSource !== "official" ? (
        <p className="text-xs text-muted-foreground">
          L’objectif se règle dans <Link href={settingsHref} className="font-semibold text-[var(--tr1-navy)] underline-offset-4 hover:underline">Paramètres</Link>.
        </p>
      ) : null}
    </section>
  );
}
