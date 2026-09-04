import type { ReactNode } from "react";
import { AlertTriangle, CalendarCheck2, CheckCircle2, ClipboardCheck, Route } from "lucide-react";
import type { TerrainPulse } from "@/lib/terrain-engagement";

const categories = [
  { key: "missionCount", label: "Missions", color: "bg-[var(--tr1-orange)]" },
  { key: "followUpCount", label: "Relances", color: "bg-[var(--tr1-blue)]" },
  { key: "reportCount", label: "Rapports", color: "bg-[var(--tr1-success)]" },
  { key: "overdueCount", label: "Retards", color: "bg-[var(--tr1-danger)]" },
] as const;

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

export function TerrainMomentum({
  firstName,
  dayLabel,
  brandName,
  pulse,
  hasNextVisit,
  action,
}: {
  firstName: string;
  dayLabel: string;
  brandName: string;
  pulse: TerrainPulse;
  hasNextVisit: boolean;
  action?: ReactNode;
}) {
  const activeCategories = categories.filter((category) => pulse[category.key] > 0);

  return (
    <header className="agent-card-enter overflow-hidden rounded-[0.55rem] bg-[var(--tr1-navy)] text-[var(--tr1-ivory)] shadow-[0_18px_45px_rgb(14_26_43/0.16)]" aria-labelledby="terrain-title">
      <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
        <div>
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.17em] text-[#f28a3c]">{dayLabel} · {brandName}</p>
          <h1 id="terrain-title" className="mt-2 max-w-2xl font-mono text-2xl font-black uppercase leading-tight tracking-[-0.055em] text-white sm:text-4xl">
            Bonjour {firstName},<br />votre terrain avance.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#c8d2de]">
            {pulse.totalActions > 0
              ? `${countLabel(pulse.totalActions, "action")} à traiter aujourd’hui${hasNextVisit ? ", avec votre prochaine visite prête" : ""}.`
              : hasNextVisit ? "Votre prochaine visite est prête, sans autre action en attente." : "Votre suivi du jour est à jour."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Synthèse de la journée">
            {pulse.attentionCount > 0 ? <TerrainFact icon={<AlertTriangle />} text={countLabel(pulse.attentionCount, "priorité", "priorités")} /> : <TerrainFact icon={<CheckCircle2 />} text="Suivi à jour" positive />}
            {pulse.missionCount > 0 ? <TerrainFact icon={<CalendarCheck2 />} text={countLabel(pulse.missionCount, "mission terrain", "missions terrain")} /> : null}
            {pulse.reportCount > 0 ? <TerrainFact icon={<ClipboardCheck />} text={countLabel(pulse.reportCount, "rapport à terminer", "rapports à terminer")} /> : null}
          </div>
        </div>
        <div className="rounded-[0.45rem] border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm" aria-label="Charge du jour">
          <div className="flex items-center justify-between gap-4">
            <div><p className="font-mono text-[0.58rem] font-bold uppercase tracking-[.16em] text-[#9fb0c3]">Cap du jour</p><p className="mt-1 text-lg font-semibold">À traiter aujourd’hui</p></div>
            <span className="font-mono text-2xl font-black text-white" aria-label={`${pulse.totalActions} actions`}>{pulse.totalActions}</span>
          </div>
          {activeCategories.length > 0 ? (
            <>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                {activeCategories.map((category) => <span key={category.key} className={category.color} style={{ flexGrow: pulse[category.key] }} />)}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {activeCategories.map((category) => <li key={category.key} className="flex items-center justify-between gap-2"><span className="text-[#c8d2de]">{category.label}</span><strong className="font-mono text-white">{pulse[category.key]}</strong></li>)}
              </ul>
            </>
          ) : <p className="mt-4 flex items-center gap-2 text-sm text-[#cfe0d1]"><CheckCircle2 className="size-4" /> Aucun retard, aucun rapport en attente.</p>}
          {action ? <div className="mt-5 [&_[data-slot=button]]:w-full">{action}</div> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 bg-[var(--tr1-navy-soft)] px-5 py-2.5 text-xs text-[#b9c5d2] sm:px-7"><Route className="size-3.5 text-[#f28a3c]" /> Une lecture fondée sur vos actions terrain réelles.</div>
    </header>
  );
}

function TerrainFact({ icon, text, positive = false }: { icon: ReactNode; text: string; positive?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${positive ? "border-[#80a287]/40 bg-[#4f7a58]/25 text-[#dce9de]" : "border-white/15 bg-white/[0.06] text-[#e2e8ef]"}`}><span className="[&>svg]:size-3.5" aria-hidden="true">{icon}</span>{text}</span>;
}
