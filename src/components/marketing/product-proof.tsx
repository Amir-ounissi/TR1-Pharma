"use client";

import Image from "next/image";
import { useState } from "react";
import { trackMarketingEvent } from "@/lib/marketing/analytics";

const views = {
  manager: {
    label: "Pilotage Manager",
    title: "Identifiez les pharmacies à ouvrir et préparez chaque visite commerciale.",
    image: "/marketing/manager-day.webp",
    alt: "Vue TR1 Manager avec priorités, tournée et actions rapides",
  },
  agent: {
    label: "Expérience Agent",
    title: "Chaque intervenant suit ses visites et enregistre la première commande.",
    image: "/marketing/agent-day-mobile.webp",
    alt: "Vue mobile TR1 Agent avec prochaine visite et tournée du jour",
  },
  missions: {
    label: "Missions terrain",
    title: "Après l’ouverture, planifiez l’animation ou la formation et gardez la prochaine action.",
    image: "/marketing/missions-board.webp",
    alt: "Tableau TR1 des missions terrain à venir et terminées",
  },
} as const;

export function ProductProof() {
  const [active, setActive] = useState<keyof typeof views>("manager");
  const view = views[active];

  return <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#102944] shadow-[0_36px_100px_rgba(0,0,0,.38)]">
    <div className="flex flex-col gap-5 border-b border-white/10 bg-[#102944] px-4 py-4 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="font-mono text-[.62rem] font-bold uppercase tracking-[.16em] text-white/50">TR1 Pharma / Démonstration produit</div>
      <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Vues produit">
        {Object.entries(views).map(([key, item]) => <button aria-selected={active === key} className={`rounded-lg border px-4 py-3 text-left font-mono text-[.65rem] font-black uppercase tracking-[.08em] transition ${active === key ? "border-[#ef6a3a] bg-[#ef6a3a] text-white" : "border-white/15 bg-white/[.04] text-white/70 hover:border-white/30 hover:text-white"}`} key={key} onClick={() => { setActive(key as keyof typeof views); trackMarketingEvent("product_tab_view", { tab: key }); }} role="tab">{item.label}</button>)}
      </div>
    </div>
    <div className="grid min-h-[34rem] place-items-center bg-[#f7f1e7] p-3 sm:p-6 lg:p-10" role="tabpanel">
      <Image alt={view.alt} className={`max-h-[42rem] w-auto rounded-xl border border-[#0b1e32]/10 object-contain shadow-[0_22px_60px_rgba(7,20,33,.18)] ${active === "agent" ? "max-w-[18rem]" : "max-w-full"}`} height={active === "agent" ? 607 : 600} priority={active === "manager"} src={view.image} width={active === "agent" ? 275 : 716} />
    </div>
    <div className="flex flex-col gap-3 bg-[#0b1e32] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <strong className="max-w-3xl text-lg tracking-[-.025em]">{view.title}</strong>
      <span className="shrink-0 font-mono text-[.62rem] uppercase tracking-[.12em] text-[#ff9d78]">Ouverture · Suivi · Développement</span>
    </div>
  </div>;
}
