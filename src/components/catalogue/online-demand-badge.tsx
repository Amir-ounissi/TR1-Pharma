import React from "react";

type OnlineDemandSignal = {
  soldLabel: string;
  sourceUrl: string;
  packageNote?: string;
};

const BOJ_SOURCE = "https://fr.iherb.com/c/beauty-of-joseon";
const BIODANCE_SOURCE = "https://fr.iherb.com/c/biodance";
const DR_ALTHEA_SOURCE = "https://fr.iherb.com/c/dr-althea";

// Compteurs publics affichés par iHerb France, relevés le 18/11/2026.
// Les valeurs sont des seuils ("X+") affichés par la plateforme, pas des ventes consolidées du marché.
const ONLINE_DEMAND_BY_EAN: Record<string, OnlineDemandSignal> = {
  // Beauty of Joseon
  "8809738316146": { soldLabel: "5 000+ vendus", sourceUrl: BOJ_SOURCE },
  "8809657114960": { soldLabel: "3 000+ vendus", sourceUrl: BOJ_SOURCE },
  "8809525249565": { soldLabel: "2 000+ vendus", sourceUrl: BOJ_SOURCE },
  "8809738314678": { soldLabel: "1 000+ vendus", sourceUrl: BOJ_SOURCE },
  "8809738312728": { soldLabel: "1 000+ vendus", sourceUrl: BOJ_SOURCE },
  "8809738316986": { soldLabel: "500+ vendus", sourceUrl: BOJ_SOURCE },
  "8809738312872": { soldLabel: "500+ vendus", sourceUrl: BOJ_SOURCE },
  "8809606851663": { soldLabel: "500+ vendus", sourceUrl: BOJ_SOURCE },
  "8809738316139": { soldLabel: "500+ vendus", sourceUrl: BOJ_SOURCE },
  "8809875906477": { soldLabel: "400+ vendus", sourceUrl: BOJ_SOURCE },
  "8809738310960": { soldLabel: "400+ vendus", sourceUrl: BOJ_SOURCE },
  "8809968130130": { soldLabel: "400+ vendus", sourceUrl: BOJ_SOURCE },
  "8809738316412": { soldLabel: "300+ vendus", sourceUrl: BOJ_SOURCE },
  "8809738316993": { soldLabel: "200+ vendus", sourceUrl: BOJ_SOURCE },

  // Biodance : iHerb affiche les ventes sur des lots de 4 masques pour ces références.
  "8809937361718": {
    soldLabel: "4 000+ packs vendus",
    sourceUrl: BIODANCE_SOURCE,
    packageNote: "Compteur iHerb sur le lot de 4 masques",
  },
  "8809937361725": {
    soldLabel: "500+ packs vendus",
    sourceUrl: BIODANCE_SOURCE,
    packageNote: "Compteur iHerb sur le lot de 4 masques",
  },
  "8809891184569": {
    soldLabel: "200+ packs vendus",
    sourceUrl: BIODANCE_SOURCE,
    packageNote: "Compteur iHerb sur le lot de 4 masques",
  },

  // Dr. Althea
  "8809447256221": { soldLabel: "7 500+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256115": { soldLabel: "3 000+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256412": { soldLabel: "750+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447255101": { soldLabel: "300+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256085": { soldLabel: "300+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447254609": { soldLabel: "200+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256658": { soldLabel: "200+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447255620": { soldLabel: "100+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256191": { soldLabel: "100+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256238": { soldLabel: "100+ vendus", sourceUrl: DR_ALTHEA_SOURCE },
};

const ONLINE_DEMAND_BY_PRODUCT_ID: Record<string, OnlineDemandSignal> = {
  // Biodance Collagen Gel Toner Pads, 60 pads — EAN absent du catalogue interne.
  "a208b8d4-bc96-44a9-9127-eb0fee2909d8": {
    soldLabel: "100+ pots vendus",
    sourceUrl: BIODANCE_SOURCE,
  },
};

export function OnlineDemandBadge({
  ean,
  productId,
  compact = false,
}: {
  ean: string | null;
  productId: string;
  compact?: boolean;
}) {
  const signal = (ean ? ONLINE_DEMAND_BY_EAN[ean] : undefined)
    ?? ONLINE_DEMAND_BY_PRODUCT_ID[productId];

  if (!signal) return null;

  return (
    <div
      className={`mt-2 w-fit max-w-full rounded-lg border border-[#d8e9dc] bg-[#f2f8f3] px-2.5 py-2 ${compact ? "max-w-[260px]" : ""}`}
      aria-label={`Top vente sur internet : ${signal.soldLabel}, sur les 30 derniers jours sur iHerb`}
    >
      <span className="inline-flex rounded-full bg-[#dcefe0] px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[.08em] text-[#356b43]">
        Top vente sur internet
      </span>
      <p className={`mt-1 font-extrabold leading-4 text-[#244c30] ${compact ? "text-[10px]" : "text-[11px]"}`}>
        {signal.soldLabel}
      </p>
      <p className="mt-0.5 text-[9px] leading-3 text-[#68786c]">
        {signal.packageNote ? <>{signal.packageNote} · </> : null}
        <a
          href={signal.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2"
        >
          iHerb
        </a>
        {" · 30 derniers jours · relevé le 18/11/2026"}
      </p>
    </div>
  );
}
