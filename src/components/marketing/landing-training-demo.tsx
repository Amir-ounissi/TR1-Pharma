"use client";

import { useState } from "react";
import { BookOpenCheck, CheckCircle2, CircleX, GraduationCap, UsersRound } from "lucide-react";

const answers = [
  { id: "stock", label: "Le nombre de références en rayon", correct: false },
  { id: "need", label: "Le besoin exprimé par le patient", correct: true },
  { id: "price", label: "Le prix du produit le plus vendu", correct: false },
] as const;

type AnswerId = (typeof answers)[number]["id"];

export function LandingTrainingDemo() {
  const [answerId, setAnswerId] = useState<AnswerId | null>(null);
  const selected = answers.find((answer) => answer.id === answerId);

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
          <div className="flex items-center gap-2"><GraduationCap className="size-4 text-[var(--tr1-orange)]" /><strong className="text-sm">Essayez une question</strong></div>
          <p className="mt-4 text-sm font-semibold">Quel est le premier point à vérifier avant de recommander la gamme ?</p>
          <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Réponses au quiz de démonstration">
            {answers.map((answer) => {
              const isSelected = answer.id === answerId;
              const showCorrect = answerId !== null && answer.correct;
              const showIncorrect = isSelected && !answer.correct;
              return (
                <button
                  aria-checked={isSelected}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] motion-reduce:transition-none ${showCorrect ? "border-emerald-400/55 bg-emerald-400/12 text-emerald-100" : showIncorrect ? "border-red-300/55 bg-red-400/10 text-red-100" : isSelected ? "border-white/45 bg-white/10 text-white" : "border-white/12 bg-white/5 text-white/72 hover:bg-white/10"}`}
                  key={answer.id}
                  onClick={() => setAnswerId(answer.id)}
                  role="radio"
                  type="button"
                >
                  <span>{answer.label}</span>
                  {showCorrect ? <CheckCircle2 className="size-4 shrink-0 text-emerald-300" /> : null}
                  {showIncorrect ? <CircleX className="size-4 shrink-0 text-red-300" /> : null}
                </button>
              );
            })}
          </div>

          {selected ? (
            <div aria-live="polite" className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-xs leading-5 ${selected.correct ? "bg-emerald-400/10 text-emerald-100" : "bg-white/7 text-white/72"}`}>
              {selected.correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-orange-300" />}
              <p>
                {selected.correct
                  ? "Exact. Le conseil commence par le besoin exprimé. Le quiz confirme l’acquis et permet à la marque de suivre les résultats."
                  : "Pas tout à fait. Avant le stock ou le prix, il faut d’abord qualifier le besoin exprimé par le patient."
                }
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs leading-5 text-white/55">Sélectionnez une réponse pour voir l’explication.</p>
          )}
        </article>
      </div>

      <p className="mt-4 text-center text-sm font-black tracking-[-.02em] text-[var(--tr1-navy)]">Vos équipes participent. Votre marque retrouve les résultats.</p>
    </div>
  );
}
