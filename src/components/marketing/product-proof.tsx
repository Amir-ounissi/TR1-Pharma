"use client";

import { useState } from "react";
import { trackMarketingEvent } from "@/lib/marketing/analytics";

const views = {
  manager: { label: "Pilotage Manager", eyebrow: "Priorité détectée", title: "Pharmacie République", detail: "Premier réassort attendu", metrics: ["Score 82", "CA 90 j · 2 480 €", "Action · visite terrain"] },
  agent: { label: "Expérience Agent", eyebrow: "Prochaine visite", title: "Pharmacie République", detail: "Brief prêt · Claire Durand", metrics: ["11:00", "Dermacalm", "Objectif · réassort"] },
  missions: { label: "Missions terrain", eyebrow: "Rapport validé", title: "Formation Dermacalm", detail: "Nora Petit · Paris Centre", metrics: ["12 participants", "8 ventes", "Relance créée"] },
} as const;

export function ProductProof() {
  const [active, setActive] = useState<keyof typeof views>("manager");
  const view = views[active];
  return <div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
    <div className="grid content-start gap-2" role="tablist" aria-label="Vues produit">
      {Object.entries(views).map(([key, item]) => <button aria-selected={active === key} className={`rounded-lg border px-4 py-4 text-left font-mono text-xs font-black uppercase tracking-[.08em] transition ${active === key ? "border-[#0f2740] bg-[#0f2740] text-white" : "border-[#d8d0c2] bg-[#fffaf0] text-[#0f2740] hover:border-[#c9562d]"}`} key={key} onClick={() => { setActive(key as keyof typeof views); trackMarketingEvent("product_tab_view", { tab: key }); }} role="tab">{item.label}</button>)}
    </div>
    <div className="rounded-[1.25rem] border border-[#cfc6b7] bg-[#fffaf0] p-5 shadow-[0_28px_80px_rgba(15,39,64,.1)] sm:p-8" role="tabpanel">
      <div className="flex items-start justify-between gap-4 border-b border-[#d8d0c2] pb-5"><div><p className="font-mono text-[.62rem] font-bold uppercase tracking-[.18em] text-[#c9562d]">{view.eyebrow}</p><h3 className="mt-2 font-mono text-2xl font-black uppercase tracking-[-.05em] text-[#0f2740]">{view.title}</h3><p className="mt-2 text-sm text-[#66717d]">{view.detail}</p></div><span className="rounded-full border border-[#c9562d] px-3 py-1 font-mono text-[.6rem] uppercase text-[#c9562d]">Dermavita Labs</span></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">{view.metrics.map((metric) => <div className="min-h-24 rounded-lg border border-[#d8d0c2] p-4 font-mono text-xs font-bold uppercase tracking-[.04em] text-[#0f2740]" key={metric}>{metric}</div>)}</div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e9e1d4]"><div className="h-full w-[72%] bg-[#c9562d]" /></div>
    </div>
  </div>;
}
