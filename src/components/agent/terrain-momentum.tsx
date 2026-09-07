import Link from "next/link";
import { CalendarCheck2, CheckCircle2, Clock3, Route } from "lucide-react";
import { buildAgentVisitDay, type AgentScheduledVisit } from "@/lib/agent-visits";

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

function time(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function TerrainMomentum({
  firstName,
  dayLabel,
  brandName,
  visits,
  nowIso,
}: {
  firstName: string;
  dayLabel: string;
  brandName: string;
  visits: AgentScheduledVisit[];
  nowIso: string;
}) {
  const day = buildAgentVisitDay(visits, new Date(nowIso));
  const nextVisit = day.upcoming[0] ?? null;

  return (
    <header className="agent-card-enter overflow-hidden rounded-[0.55rem] bg-[var(--tr1-navy)] text-[var(--tr1-ivory)] shadow-[0_18px_45px_rgb(14_26_43/0.16)]" aria-labelledby="terrain-title">
      <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-stretch">
        <div className="flex flex-col justify-between">
          <div>
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.17em] text-[#f28a3c]">{dayLabel} · {brandName}</p>
            <h1 id="terrain-title" className="mt-2 max-w-2xl font-mono text-2xl font-black uppercase leading-tight tracking-[-0.055em] text-white sm:text-4xl">
              Bonjour {firstName},<br />votre journée terrain est planifiée.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#c8d2de]">
              {day.plannedCount > 0
                ? `${countLabel(day.plannedCount, "visite prévue", "visites prévues")} aujourd’hui.`
                : "Aucune visite n’est planifiée aujourd’hui."}
              {day.pendingClosureCount > 0
                ? ` ${countLabel(day.pendingClosureCount, "visite doit", "visites doivent")} maintenant être clôturée${day.pendingClosureCount > 1 ? "s" : ""}.`
                : ""}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2" aria-label="Synthèse des visites du jour">
            <TerrainFact icon={<CalendarCheck2 />} text={countLabel(day.plannedCount, "visite prévue", "visites prévues")} />
            {day.pendingClosureCount > 0 ? (
              <TerrainFact icon={<Clock3 />} text={countLabel(day.pendingClosureCount, "à clôturer", "à clôturer")} attention />
            ) : (
              <TerrainFact icon={<CheckCircle2 />} text="Aucune visite en attente" positive />
            )}
            {day.upcomingCount > 0 ? <TerrainFact icon={<Route />} text={countLabel(day.upcomingCount, "à venir", "à venir")} /> : null}
          </div>
        </div>

        <div className="rounded-[0.45rem] border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm" aria-label="Visites du jour">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.58rem] font-bold uppercase tracking-[.16em] text-[#9fb0c3]">Visites du jour</p>
              <p className="mt-1 text-lg font-semibold">{day.plannedCount ? `${day.plannedCount} prévues aujourd’hui` : "Aucune visite prévue"}</p>
            </div>
            <span className="font-mono text-3xl font-black text-white" aria-label={`${day.plannedCount} visites prévues`}>{day.plannedCount}</span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`${day.completedCount} visites clôturées sur ${day.plannedCount}`}>
            <div className="h-full rounded-full bg-[var(--tr1-success)] transition-[width]" style={{ width: `${day.progressPercent}%` }} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <VisitStat label="Clôturées" value={day.completedCount} />
            <VisitStat label="À clôturer" value={day.pendingClosureCount} attention={day.pendingClosureCount > 0} />
            <VisitStat label="À venir" value={day.upcomingCount} />
          </div>

          {day.pendingClosure.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="font-mono text-[0.56rem] font-bold uppercase tracking-[.14em] text-[#ffb08a]">À clôturer maintenant</p>
              {day.pendingClosure.slice(0, 2).map((visit) => (
                <div key={visit.id} className="flex items-center gap-3 rounded-md border border-[#f28a3c]/35 bg-[#f28a3c]/10 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[0.68rem] font-black text-[#ffb08a]">{time(visit.startAt)}</p>
                    <p className="truncate text-sm font-semibold text-white">{visit.pharmacyName}</p>
                    {visit.city ? <p className="truncate text-xs text-[#aebccc]">{visit.city}</p> : null}
                  </div>
                  <Link href={visit.href} className="shrink-0 rounded-md bg-[var(--tr1-orange)] px-3 py-2 text-xs font-black text-white transition hover:bg-[#d65d05]">
                    Clôturer
                  </Link>
                </div>
              ))}
              {day.pendingClosureCount > 2 ? (
                <Link href="/dashboard/agenda" className="inline-flex text-xs font-semibold text-[#ffb08a] hover:underline">
                  Voir les {day.pendingClosureCount} visites à clôturer →
                </Link>
              ) : null}
            </div>
          ) : nextVisit ? (
            <div className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-3">
              <p className="font-mono text-[0.56rem] font-bold uppercase tracking-[.14em] text-[#9fb0c3]">Prochaine visite</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{nextVisit.pharmacyName}</p>
                  <p className="text-xs text-[#aebccc]">{time(nextVisit.startAt)}{nextVisit.city ? ` · ${nextVisit.city}` : ""}</p>
                </div>
                <Link href={nextVisit.href} className="shrink-0 text-xs font-bold text-[#ffb08a] hover:underline">Ouvrir →</Link>
              </div>
            </div>
          ) : day.plannedCount > 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-[#cfe0d1]"><CheckCircle2 className="size-4" /> Toutes les visites du jour sont clôturées.</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 bg-[var(--tr1-navy-soft)] px-5 py-2.5 text-xs text-[#b9c5d2] sm:px-7">
        <Route className="size-3.5 text-[#f28a3c]" /> Une visite passe à « À clôturer » dès que l’heure prévue est dépassée.
      </div>
    </header>
  );
}

function VisitStat({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className={`rounded-md border px-2 py-2 ${attention ? "border-[#f28a3c]/45 bg-[#f28a3c]/10" : "border-white/10 bg-white/[0.04]"}`}>
      <strong className={`block font-mono text-lg ${attention ? "text-[#ff9d78]" : "text-white"}`}>{value}</strong>
      <span className="text-[#aebccc]">{label}</span>
    </div>
  );
}

function TerrainFact({
  icon,
  text,
  positive = false,
  attention = false,
}: {
  icon: React.ReactNode;
  text: string;
  positive?: boolean;
  attention?: boolean;
}) {
  const tone = attention
    ? "border-[#f28a3c]/45 bg-[#f28a3c]/12 text-[#ffd0b8]"
    : positive
      ? "border-[#80a287]/40 bg-[#4f7a58]/25 text-[#dce9de]"
      : "border-white/15 bg-white/[0.06] text-[#e2e8ef]";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}><span className="[&>svg]:size-3.5" aria-hidden="true">{icon}</span>{text}</span>;
}
