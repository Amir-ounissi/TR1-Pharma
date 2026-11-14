import { ArrowUpRight, ScanBarcode, Sparkles } from "lucide-react";

type ExternalCompositionAnalysisProps = {
  ean: string;
};

export function ExternalCompositionAnalysis({ ean }: ExternalCompositionAnalysisProps) {
  const inciBeautyUrl = "https://incibeauty.com/produit/" + encodeURIComponent(ean);

  return (
    <section aria-labelledby="external-composition-title" className="rounded-2xl border border-[#e5e9eb] bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f4eee8] text-[#a8653d]">
          <Sparkles size={19} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#b56d3e]">Décryptage indépendant</p>
          <h2 id="external-composition-title" className="mt-1 text-xl font-black text-[#122a41] sm:text-2xl">
            Évaluations de la composition
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#647482]">
            Consultez les analyses réalisées par des applications indépendantes à partir du code-barres de cette référence.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href={inciBeautyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-32 items-start justify-between gap-3 rounded-xl border border-[#e4e9e8] bg-[#fafbf9] p-4 transition hover:border-[#b7c8be] hover:bg-[#f4f8f4]"
        >
          <div>
            <p className="text-sm font-black text-[#20394c]">INCI Beauty</p>
            <p className="mt-1 text-xs font-semibold text-[#647482]">Consulter la fiche et la note /20</p>
            <p className="mt-2 text-xs leading-5 text-[#7a8791]">
              Si la référence est répertoriée dans leur base.
            </p>
          </div>
          <ArrowUpRight size={17} className="mt-0.5 shrink-0 text-[#a8653d] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </a>

        <a
          href="https://app.yuka.io/scan"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-32 items-start justify-between gap-3 rounded-xl border border-[#e4e9e8] bg-[#fafbf9] p-4 transition hover:border-[#e6c4bd] hover:bg-[#fff8f6]"
        >
          <div>
            <p className="text-sm font-black text-[#20394c]">Yuka</p>
            <p className="mt-1 text-xs font-semibold text-[#647482]">Scanner ce produit</p>
            <p className="mt-2 text-xs leading-5 text-[#7a8791]">
              Ouvrir le scanner sur mobile et présenter le code-barres.
            </p>
          </div>
          <ScanBarcode size={18} className="mt-0.5 shrink-0 text-[#d45d54] transition group-hover:scale-105" aria-hidden="true" />
        </a>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-[#84909a]">
        Les notes sont établies par chaque application selon sa propre méthode. Elles ne constituent ni une certification TR1 PHARMA ni une mesure de l’efficacité du produit. Vérifiez toujours que la fiche consultée correspond au bon code-barres et à la bonne formule.
      </p>
    </section>
  );
}
