type OnlineDemandSignal = {
  countLabel: string;
  unitLabel: string;
  sourceUrl: string;
};

const BOJ_SOURCE = "https://fr.iherb.com/c/beauty-of-joseon/beauty";
const BIODANCE_SOURCE = "https://fr.iherb.com/c/biodance/beauty";
const DR_ALTHEA_SOURCE = "https://fr.iherb.com/c/dr-althea";
const DATA_CHECKED_ON = "18/11/2026";

// Seuils de ventes sur 30 jours affichés par iHerb France.
// Les compteurs sont arrondis par seuil et ne représentent pas les ventes totales du marché.
const ONLINE_DEMAND_BY_EAN: Record<string, OnlineDemandSignal> = {
  // Beauty of Joseon
  "8809738316146": { countLabel: "5 000+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809657114960": { countLabel: "3 000+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809525249565": { countLabel: "2 000+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809738314678": { countLabel: "1 000+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809738312728": { countLabel: "1 000+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809738316986": { countLabel: "500+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809738312872": { countLabel: "500+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809606851663": { countLabel: "500+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809738316139": { countLabel: "500+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809875906477": { countLabel: "400+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809738310960": { countLabel: "400+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809968130130": { countLabel: "400+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809738316412": { countLabel: "300+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },
  "8809738316993": { countLabel: "200+", unitLabel: "vendus", sourceUrl: BOJ_SOURCE },

  // Biodance : iHerb affiche ces références en lots de 4 masques.
  "8809937361718": { countLabel: "4 000+", unitLabel: "packs de 4 vendus", sourceUrl: BIODANCE_SOURCE },
  "8809937361725": { countLabel: "500+", unitLabel: "packs de 4 vendus", sourceUrl: BIODANCE_SOURCE },
  "8809891184606": { countLabel: "400+", unitLabel: "packs de 4 vendus", sourceUrl: BIODANCE_SOURCE },
  "8809891184569": { countLabel: "200+", unitLabel: "packs de 4 vendus", sourceUrl: BIODANCE_SOURCE },

  // Dr. Althea
  "8809447256221": { countLabel: "7 500+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256115": { countLabel: "3 000+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256412": { countLabel: "750+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447255101": { countLabel: "300+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256085": { countLabel: "300+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447254609": { countLabel: "200+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256658": { countLabel: "200+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447255620": { countLabel: "100+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256191": { countLabel: "100+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
  "8809447256238": { countLabel: "100+", unitLabel: "vendus", sourceUrl: DR_ALTHEA_SOURCE },
};

const ONLINE_DEMAND_BY_PRODUCT_ID: Record<string, OnlineDemandSignal> = {
  // Biodance Collagen Gel Toner Pads, 60 disques.
  "a208b8d4-bc96-44a9-9127-eb0fee2909d8": {
    countLabel: "100+",
    unitLabel: "vendus",
    sourceUrl: BIODANCE_SOURCE,
  },
};

export function OnlineDemandBadge({
  ean,
  productId,
  compact = false,
}: {
  ean: string | null;
  productId?: string;
  compact?: boolean;
}) {
  const signal = (ean ? ONLINE_DEMAND_BY_EAN[ean] : undefined)
    ?? (productId ? ONLINE_DEMAND_BY_PRODUCT_ID[productId] : undefined);

  if (!signal) return null;

  return (
    <div
      className={"mt-2 w-fit max-w-full rounded-lg border border-[#d8e9dc] bg-[#f2f8f3] px-2.5 py-2 " + (compact ? "max-w-[260px]" : "")}
      aria-label={"Top vente sur internet : " + signal.countLabel + " " + signal.unitLabel + " sur 30 jours, source iHerb France"}
    >
      <span className="inline-flex rounded-full bg-[#dcefe0] px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[.08em] text-[#356b43]">
        Top vente sur internet
      </span>
      <p className={"mt-1 font-extrabold leading-4 text-[#244c30] " + (compact ? "text-[10px]" : "text-[11px]")}>
        {signal.countLabel} {signal.unitLabel}
      </p>
      <p className="mt-0.5 text-[9px] leading-3 text-[#68786c]">
        30 derniers jours ·{" "}
        <a
          href={signal.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2"
        >
          iHerb France
        </a>
        {" · consulté le " + DATA_CHECKED_ON}
      </p>
    </div>
  );
}
