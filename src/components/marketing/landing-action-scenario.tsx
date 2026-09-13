"use client";

import { useState } from "react";
import { ArrowRight, CalendarCheck2, FileCheck2, MapPinned } from "lucide-react";

const steps = [
  {
    id: "identifier",
    index: "01",
    label: "Identifier",
    title: "Une pharmacie à relancer",
    text: "Le compte ressort parce qu’un réassort est attendu et qu’aucune prochaine action n’est planifiée.",
    detail: "Pharmacie des Arcades · Lille",
    meta: "Réassort attendu · relance à prévoir",
    image: "/marketing/pharmacy-account.webp",
    imageAlt: "Fiche pharmacie TR1 utilisée pour identifier une pharmacie à relancer",
    icon: MapPinned,
  },
  {
    id: "organiser",
    index: "02",
    label: "Organiser",
    title: "Une animation planifiée",
    text: "Le brief, l’intervenant, la date et les objectifs sont rattachés à la pharmacie et partagés avec les personnes concernées.",
    detail: "Animation conseil · 22 septembre",
    meta: "Brief validé · intervenant affecté",
    image: "/marketing/missions-board.webp",
    imageAlt: "Planning TR1 utilisé pour organiser une animation terrain",
    icon: CalendarCheck2,
  },
  {
    id: "suivre",
    index: "03",
    label: "Suivre",
    title: "Un bilan disponible",
    text: "Le compte rendu, les preuves et les résultats déclarés reviennent dans le cockpit pour préparer la prochaine décision.",
    detail: "Compte rendu reçu",
    meta: "Résultats observés · prochaine action à décider",
    image: "/marketing/manager-day.webp",
    imageAlt: "Cockpit Manager TR1 utilisé pour suivre le bilan d’une action terrain",
    icon: FileCheck2,
  },
] as const;

type StepId = (typeof steps)[number]["id"];

export function LandingActionScenario() {
  const [activeId, setActiveId] = useState<StepId>("identifier");
  const active = steps.find((step) => step.id === activeId) ?? steps[0];

  return (
    <div className="grid gap-7 lg:grid-cols-[.72fr_1.28fr] lg:gap-12">
      <div className="space-y-3" role="tablist" aria-label="Étapes d’une action terrain TR1">
        {steps.map((step) => {
          const selected = step.id === active.id;
          const Icon = step.icon;
          return (
            <button
              aria-controls={`scenario-panel-${step.id}`}
              aria-selected={selected}
              className={`w-full rounded-xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] motion-reduce:transition-none sm:p-5 ${selected ? "border-[var(--tr1-navy)] bg-white shadow-[0_14px_38px_rgba(14,29,49,.08)]" : "border-[var(--tr1-line)] bg-white/28 hover:bg-white/55"}`}
              id={`scenario-tab-${step.id}`}
              key={step.id}
              onClick={() => setActiveId(step.id)}
              role="tab"
              type="button"
            >
              <div className="flex items-start gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${selected ? "bg-[var(--tr1-navy)] text-white" : "bg-[var(--tr1-ivory-deep)] text-[var(--tr1-muted)]"}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[.62rem] font-black text-[var(--tr1-orange)]">{step.index}</span>
                    <span className="font-mono text-[.62rem] font-black uppercase tracking-[.12em] text-[var(--tr1-muted)]">{step.label}</span>
                  </div>
                  <p className="mt-2 text-lg font-black tracking-[-.03em]">{step.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--tr1-muted)]">{step.text}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="lg:sticky lg:top-28 lg:self-start" id={`scenario-panel-${active.id}`} role="tabpanel" aria-labelledby={`scenario-tab-${active.id}`}>
        <div className="overflow-hidden rounded-[1.35rem] border border-[var(--tr1-line)] bg-[#fffdf8] shadow-[0_24px_70px_rgba(14,29,49,.09)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tr1-line)] px-5 py-4">
            <div>
              <p className="font-mono text-[.6rem] font-black uppercase tracking-[.16em] text-[var(--tr1-orange)]">{active.label}</p>
              <p className="mt-1 text-sm font-black">{active.detail}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tr1-ivory)] px-3 py-1.5 text-[.68rem] font-bold text-[var(--tr1-muted)]">
              {active.meta}
            </span>
          </div>
          <div className="p-3 sm:p-5">
            <img
              alt={active.imageAlt}
              className="h-auto w-full rounded-xl border border-[var(--tr1-line)] bg-white"
              height="600"
              key={active.image}
              loading="lazy"
              src={active.image}
              width="716"
            />
          </div>
        </div>
        <div className="mt-4 hidden items-center justify-center gap-2 font-mono text-[.62rem] font-black uppercase tracking-[.1em] text-[var(--tr1-muted)] sm:flex">
          <span>Identifier</span><ArrowRight className="size-3" /><span>Organiser</span><ArrowRight className="size-3" /><span>Suivre</span>
        </div>
      </div>
    </div>
  );
}
