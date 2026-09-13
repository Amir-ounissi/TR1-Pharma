import { BookOpenCheck, CheckCircle2, GraduationCap, UsersRound } from "lucide-react";

export function LandingTrainingDemo() {
  return (
    <div className="rounded-[1.25rem] border border-[var(--tr1-line)] bg-[#fffdf8] p-4 shadow-[0_18px_55px_rgba(14,29,49,.08)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tr1-line)] pb-4">
        <div>
          <p className="font-mono text-[.6rem] font-black uppercase tracking-[.16em] text-[var(--tr1-orange)]">Aperçu formation</p>
          <p className="mt-1 font-black">Parcours équipe officinale</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[.68rem] font-bold text-emerald-700">Démonstration</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-[var(--tr1-line)] bg-white p-4">
          <div className="flex items-center gap-2"><BookOpenCheck className="size-4 text-[var(--tr1-orange)]" /><strong className="text-sm">Modules</strong></div>
          <div className="mt-4 space-y-3 text-sm">
            {["Comprendre la gamme", "Conseiller au comptoir", "Répondre aux objections"].map((module, index) => (
              <div className="flex items-center justify-between gap-3" key={module}>
                <span>{module}</span><span className="font-mono text-[.65rem] text-[var(--tr1-muted)]">0{index + 1}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-[var(--tr1-line)] bg-white p-4">
          <div className="flex items-center gap-2"><UsersRound className="size-4 text-[var(--tr1-orange)]" /><strong className="text-sm">Pharmacie Comédie</strong></div>
          <div className="mt-4 grid gap-2 text-sm text-[var(--tr1-muted)]">
            <p><span className="font-black text-[var(--tr1-navy)]">6</span> participants</p>
            <p><span className="font-black text-[var(--tr1-navy)]">3</span> modules suivis</p>
            <p><span className="font-black text-[var(--tr1-navy)]">91 %</span> score moyen au quiz</p>
          </div>
        </article>

        <article className="rounded-xl border border-[var(--tr1-line)] bg-[var(--tr1-navy)] p-4 text-white sm:col-span-2">
          <div className="flex items-center gap-2"><GraduationCap className="size-4 text-[var(--tr1-orange)]" /><strong className="text-sm">Question de quiz</strong></div>
          <p className="mt-4 text-sm font-semibold">Quel est le premier point à vérifier avant de recommander la gamme ?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/70">Le nombre de références en rayon</div>
            <div className="rounded-lg border border-emerald-400/45 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100">Le besoin exprimé par le patient</div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-white/7 p-3 text-xs leading-5 text-white/70">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
            <p>La réponse est expliquée immédiatement pour consolider l’acquis et identifier les notions à renforcer.</p>
          </div>
        </article>
      </div>
    </div>
  );
}
