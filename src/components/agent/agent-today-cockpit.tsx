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
  brandName,
  monthLabel,
  revenue,
  orderCount,
  target,
  targetSource,
  pendingVisitCount,
}: {
  brandName: string;
  monthLabel: string;
  revenue: number;
  orderCount: number;
  target: number | null;
  targetSource: "official" | "personal" | null;
  pendingVisitCount: number;
}) {
  const averageBasket = orderCount > 0 ? revenue / orderCount : 0;
  const attainment = target && target > 0 ? (revenue / target) * 100 : null;
  const progress = attainment == null ? 0 : Math.max(0, Math.min(attainment, 100));
  const remaining = target == null ? null : Math.max(target - revenue, 0);

  const actions = [
    {
      href: "/dashboard/agenda/new?mode=quick",
      label: "Ajouter une visite",
      detail: "Visite imprévue en quelques secondes",
      icon: CalendarPlus,
    },
    {
      href: "/dashboard/agenda",
      label: "Agenda",
      detail: "Voir et organiser ma tournée",
      icon: CalendarDays,
    },
    {
      href: "#visit-closeouts",
      label: pendingVisitCount > 0 ? `${pendingVisitCount} visite${pendingVisitCount > 1 ? "s" : ""} à clôturer` : "Visites à jour",
      detail: pendingVisitCount > 0 ? "Faire mes comptes rendus à la suite" : "Aucune clôture en attente",
      icon: CheckCircle2,
    },
    {
      href: "/dashboard/agent/performance",
      label: "Performance",
      detail: "CA, commandes et objectif du mois",
      icon: TrendingUp,
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="today-pilot-title">
      <div>
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
          Pilotage terrain
        </p>
        <h2 id="today-pilot-title" className="mt-1 text-xl font-semibold text-[var(--tr1-navy)]">
          Aujourd’hui
        </h2>
      </div>

      <nav aria-label="Actions principales de la journée" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[var(--tr1-line)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--tr1-orange)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]"
          >
            <action.icon className="size-5 text-[var(--tr1-navy)] transition group-hover:text-[var(--tr1-orange)]" aria-hidden="true" />
            <span>
              <span className="block text-sm font-bold text-[var(--tr1-navy)]">{action.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.detail}</span>
            </span>
          </Link>
        ))}
      </nav>

      <Link
        href="/dashboard/agent/performance"
        className="block rounded-2xl border border-[var(--tr1-line)] bg-[var(--tr1-navy)] p-5 text-white shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">
              Ma performance · {monthLabel}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {currency(revenue)}{target ? <span className="text-lg font-medium text-white/55"> / {currency(target)}</span> : null}
            </p>
            <p className="mt-1 text-xs text-white/55">
              {brandName}{targetSource ? ` · objectif ${targetSource === "official" ? "attribué" : "personnel"}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
            {attainment == null ? "Définir mon objectif" : `${attainment.toFixed(0)} %`}
          </span>
        </div>

        {target ? (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15" aria-label={`${attainment?.toFixed(0) ?? 0} % de l’objectif atteint`}>
            <div className="h-full rounded-full bg-[var(--tr1-orange)]" style={{ width: `${progress}%` }} />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-sm">
          <div>
            <p className="text-xs text-white/55">Commandes</p>
            <p className="mt-1 font-semibold">{orderCount}</p>
          </div>
          <div>
            <p className="text-xs text-white/55">Panier moyen</p>
            <p className="mt-1 font-semibold">{orderCount > 0 ? currency(averageBasket) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/55">Reste à faire</p>
            <p className="mt-1 font-semibold">{remaining == null ? "—" : currency(remaining)}</p>
          </div>
        </div>
      </Link>
    </section>
  );
}
