"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarCheck2, GraduationCap } from "lucide-react";
import { trackMarketingEvent } from "@/lib/marketing/analytics";

type DemoMode = "commercial" | "animations" | "formations";
type MarkerTone = "healthy" | "watch" | "risk";

type ModeData = {
  tone: MarkerTone;
  status: string;
  intervention: string;
  result: string;
  nextAction: string;
};

type DemoPharmacy = {
  id: string;
  name: string;
  city: string;
  x: number;
  y: number;
  commercial: ModeData;
  animations: ModeData;
  formations: ModeData;
};

const modes = [
  { id: "commercial", label: "Commercial", icon: BriefcaseBusiness },
  { id: "animations", label: "Animations", icon: CalendarCheck2 },
  { id: "formations", label: "Formations", icon: GraduationCap },
] as const;

const pharmacies: DemoPharmacy[] = [
  {
    id: "arcades-lille",
    name: "Pharmacie des Arcades",
    city: "Lille",
    x: 55,
    y: 13,
    commercial: {
      tone: "risk",
      status: "Réassort attendu",
      intervention: "Dernier échange · 4 sept.",
      result: "Aucune commande depuis 71 jours",
      nextAction: "Relancer le titulaire cette semaine",
    },
    animations: {
      tone: "watch",
      status: "Compte rendu attendu",
      intervention: "Animation réalisée · 6 sept.",
      result: "Ventes déclarées · bilan à compléter",
      nextAction: "Récupérer le compte rendu",
    },
    formations: {
      tone: "healthy",
      status: "Équipe formée",
      intervention: "Module sommeil · 2 sept.",
      result: "5 participants · quiz 86 %",
      nextAction: "Programmer le module suivant",
    },
  },
  {
    id: "republique-paris",
    name: "Pharmacie République",
    city: "Paris",
    x: 52,
    y: 29,
    commercial: {
      tone: "healthy",
      status: "Compte actif",
      intervention: "Visite commerciale · 9 sept.",
      result: "Réassort régulier",
      nextAction: "Préparer la prochaine visite",
    },
    animations: {
      tone: "healthy",
      status: "Animation réalisée",
      intervention: "Animation · 5 sept.",
      result: "32 unités déclarées",
      nextAction: "Comparer l’avant / après",
    },
    formations: {
      tone: "watch",
      status: "Quiz à renforcer",
      intervention: "Module objections · 10 sept.",
      result: "7 participants · quiz 72 %",
      nextAction: "Revoir les deux notions faibles",
    },
  },
  {
    id: "graslin-nantes",
    name: "Pharmacie Graslin",
    city: "Nantes",
    x: 26,
    y: 43,
    commercial: {
      tone: "watch",
      status: "Compte sans prochaine action",
      intervention: "Visite commerciale · 29 août",
      result: "Dernier réassort il y a 44 jours",
      nextAction: "Planifier une visite",
    },
    animations: {
      tone: "risk",
      status: "Intervention à replanifier",
      intervention: "Animation annulée · 7 sept.",
      result: "Aucun résultat déclaré",
      nextAction: "Proposer une nouvelle date",
    },
    formations: {
      tone: "healthy",
      status: "Parcours en cours",
      intervention: "Module gamme · 8 sept.",
      result: "4 participants · 2 modules suivis",
      nextAction: "Terminer le parcours produit",
    },
  },
  {
    id: "bellecour-lyon",
    name: "Pharmacie Bellecour",
    city: "Lyon",
    x: 67,
    y: 55,
    commercial: {
      tone: "healthy",
      status: "Priorité maîtrisée",
      intervention: "Visite commerciale · 11 sept.",
      result: "Réassort confirmé",
      nextAction: "Suivre l’implantation",
    },
    animations: {
      tone: "watch",
      status: "Animation planifiée",
      intervention: "Prévue le 22 sept.",
      result: "En cours d’observation",
      nextAction: "Valider le brief intervenant",
    },
    formations: {
      tone: "watch",
      status: "Formation à programmer",
      intervention: "Dernière formation · 14 juin",
      result: "3 nouveaux équipiers non formés",
      nextAction: "Planifier un module équipe",
    },
  },
  {
    id: "comedie-montpellier",
    name: "Pharmacie Comédie",
    city: "Montpellier",
    x: 54,
    y: 78,
    commercial: {
      tone: "watch",
      status: "Réassort à surveiller",
      intervention: "Visite commerciale · 3 sept.",
      result: "Dernière commande il y a 36 jours",
      nextAction: "Contrôler le stock en rayon",
    },
    animations: {
      tone: "healthy",
      status: "Animation clôturée",
      intervention: "Animation · 31 août",
      result: "24 unités déclarées · CR disponible",
      nextAction: "Préparer le suivi commercial",
    },
    formations: {
      tone: "healthy",
      status: "Formation terminée",
      intervention: "Module produit · 4 sept.",
      result: "6 participants · quiz 91 %",
      nextAction: "Partager la synthèse à l’équipe",
    },
  },
  {
    id: "prado-marseille",
    name: "Pharmacie du Prado",
    city: "Marseille",
    x: 65,
    y: 88,
    commercial: {
      tone: "healthy",
      status: "Compte en progression",
      intervention: "Visite commerciale · 12 sept.",
      result: "Réassort enregistré",
      nextAction: "Suivre la rotation des références",
    },
    animations: {
      tone: "watch",
      status: "Bilan en cours",
      intervention: "Animation · 12 sept.",
      result: "En cours d’observation",
      nextAction: "Compléter la comparaison avant / après",
    },
    formations: {
      tone: "risk",
      status: "Acquis à renforcer",
      intervention: "Module conseil · 6 sept.",
      result: "5 participants · quiz 64 %",
      nextAction: "Rejouer le module ciblé",
    },
  },
];

export function LandingPilotageMap() {
  const [mode, setMode] = useState<DemoMode>("commercial");
  const [selectedId, setSelectedId] = useState(pharmacies[0].id);
  const selected = useMemo(
    () => pharmacies.find((pharmacy) => pharmacy.id === selectedId) ?? pharmacies[0],
    [selectedId],
  );
  const selectedData = selected[mode];

  const selectMode = (nextMode: DemoMode) => {
    setMode(nextMode);
    trackMarketingEvent("map_filter_use", { filter: nextMode });
  };

  return (
    <div className="mx-auto w-full max-w-[43rem] rounded-[1.4rem] border border-[var(--tr1-line)] bg-white/55 p-3 shadow-[0_30px_90px_rgba(14,29,49,.1)] backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">Carte réseau</p>
          <p className="mt-1 text-sm font-bold text-[var(--tr1-navy)]">Données de démonstration</p>
        </div>
        <div aria-label="Choisir les informations affichées sur la carte" className="flex rounded-lg border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-1" role="tablist">
          {modes.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <button
                aria-selected={active}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] motion-reduce:transition-none sm:px-3 ${active ? "bg-[var(--tr1-navy)] text-white shadow-sm" : "text-[var(--tr1-muted)] hover:bg-white/70"}`}
                key={id}
                onClick={() => selectMode(id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" className="size-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--tr1-line)] bg-[radial-gradient(circle_at_58%_42%,rgba(182,211,230,.2),transparent_48%),#fffaf0] px-2 py-4 sm:px-5 sm:py-5">
        <div className="relative mx-auto aspect-[.95/1] w-full max-w-[31rem]" aria-label={`Carte de France de démonstration — filtre ${mode}`}>
          <svg aria-hidden="true" className="absolute inset-0 size-full drop-shadow-[0_18px_30px_rgba(14,29,49,.08)]" viewBox="0 0 600 620">
            <defs>
              <linearGradient id="landing-france-demo" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#fffdf8" />
                <stop offset="1" stopColor="#f1e5d3" />
              </linearGradient>
            </defs>
            <path
              d="M238 34 L351 52 L454 121 L477 214 L520 279 L490 356 L439 382 L418 476 L345 558 L269 543 L201 485 L108 475 L82 391 L119 318 L75 239 L117 176 L115 96 L182 66 Z"
              fill="url(#landing-france-demo)"
              stroke="#9eb7ca"
              strokeWidth="2"
            />
            <path d="M470 470 C486 482 488 514 474 544 C460 529 456 493 470 470 Z" fill="#f1e5d3" stroke="#9eb7ca" strokeWidth="2" />
            <g fill="none" stroke="#c8d4dc" strokeWidth="1.2" strokeOpacity=".7">
              <path d="M182 66 L214 160 L117 176" />
              <path d="M214 160 L330 135 L351 52" />
              <path d="M330 135 L454 121 L397 222" />
              <path d="M117 176 L205 254 L75 239" />
              <path d="M205 254 L330 135 L326 275" />
              <path d="M326 275 L397 222 L477 214" />
              <path d="M205 254 L119 318 L225 374" />
              <path d="M225 374 L326 275 L350 395" />
              <path d="M350 395 L477 214 L490 356" />
              <path d="M119 318 L108 475 L201 485 L225 374" />
              <path d="M225 374 L269 543 L345 558 L350 395" />
              <path d="M350 395 L418 476 L439 382 L490 356" />
            </g>
          </svg>

          {pharmacies.map((pharmacy) => {
            const data = pharmacy[mode];
            const isSelected = pharmacy.id === selected.id;
            return (
              <button
                aria-label={`${pharmacy.name}, ${pharmacy.city} — ${data.status}`}
                aria-pressed={isSelected}
                className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-[0_6px_18px_rgba(14,29,49,.2)] outline-none transition focus-visible:ring-4 focus-visible:ring-[var(--tr1-orange)]/35 motion-reduce:transition-none ${isSelected ? "size-10 scale-110 ring-4 ring-[var(--tr1-navy)]/12" : "size-8 hover:scale-110"} ${toneClass(data.tone)}`}
                key={pharmacy.id}
                onClick={() => setSelectedId(pharmacy.id)}
                style={{ left: `${pharmacy.x}%`, top: `${pharmacy.y}%` }}
                type="button"
              >
                <ModeGlyph mode={mode} />
              </button>
            );
          })}
        </div>
      </div>

      <div aria-live="polite" className="mt-4 rounded-xl border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-black text-[var(--tr1-navy)]">{selected.name}</p>
            <p className="text-sm text-[var(--tr1-muted)]">{selected.city}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[.68rem] font-black ${toneBadgeClass(selectedData.tone)}`}>{selectedData.status}</span>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[var(--tr1-muted)]">Dernière / prochaine intervention</dt><dd className="mt-1 font-semibold">{selectedData.intervention}</dd></div>
          <div><dt className="text-[var(--tr1-muted)]">Résultat</dt><dd className="mt-1 font-semibold">{selectedData.result}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--tr1-muted)]">Prochaine action</dt><dd className="mt-1 font-black text-[var(--tr1-navy)]">{selectedData.nextAction}</dd></div>
        </dl>
      </div>

      <div className="mt-4 grid gap-2 md:hidden" aria-label="Vue liste des pharmacies de démonstration">
        {pharmacies.map((pharmacy) => {
          const data = pharmacy[mode];
          return (
            <button
              className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] ${selected.id === pharmacy.id ? "border-[var(--tr1-navy)] bg-white" : "border-[var(--tr1-line)] bg-white/45"}`}
              key={pharmacy.id}
              onClick={() => setSelectedId(pharmacy.id)}
              type="button"
            >
              <span><strong className="block">{pharmacy.name}</strong><span className="text-xs text-[var(--tr1-muted)]">{pharmacy.city}</span></span>
              <span className={`size-2.5 shrink-0 rounded-full ${toneDotClass(data.tone)}`} />
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center font-mono text-[.64rem] font-black uppercase tracking-[.15em] text-[var(--tr1-muted)]">
        Une vision nationale. Un suivi pharmacie par pharmacie.
      </p>
    </div>
  );
}

function ModeGlyph({ mode }: { mode: DemoMode }) {
  const Icon = mode === "commercial" ? BriefcaseBusiness : mode === "animations" ? CalendarCheck2 : GraduationCap;
  return <Icon aria-hidden="true" className="size-4 text-white" strokeWidth={2.6} />;
}

function toneClass(tone: MarkerTone) {
  if (tone === "risk") return "bg-[#d94a44]";
  if (tone === "watch") return "bg-[var(--tr1-orange)]";
  return "bg-[#2f855a]";
}

function toneBadgeClass(tone: MarkerTone) {
  if (tone === "risk") return "bg-red-50 text-red-700";
  if (tone === "watch") return "bg-orange-50 text-[#b95613]";
  return "bg-emerald-50 text-emerald-700";
}

function toneDotClass(tone: MarkerTone) {
  if (tone === "risk") return "bg-[#d94a44]";
  if (tone === "watch") return "bg-[var(--tr1-orange)]";
  return "bg-[#2f855a]";
}
