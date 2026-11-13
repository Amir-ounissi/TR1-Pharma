"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Grid2X2, List, Search, SlidersHorizontal } from "lucide-react";

export type ImportedProduct = {
  id: string;
  brand: string;
  sku: string;
  name: string;
  category: string;
  format: string;
  imageUrl: string | null;
  ean: string | null;
  sourceEAN: string | null;
  priceHT: number;
  vatRate: number | null;
  minQuantity: number;
  needsReview: boolean;
  active: boolean;
  sourceDocument: string;
  sourceRow: number | null;
  tiers: { number: number; quantity: string; price: number }[];
};

const tones: Record<string, { bg: string; ink: string; accent: string; name: string }> = {
  "Beauty of Joseon": { bg: "#efe8dd", ink: "#5d4b3a", accent: "#d1bfa5", name: "JOSEON" },
  "Dr. Althea": { bg: "#e8eee8", ink: "#3b5a4b", accent: "#bacfbf", name: "ALTHEA" },
  "Biodance": { bg: "#f4e9ed", ink: "#805a69", accent: "#dfc5cf", name: "BIODANCE" },
  "Laboratoires NYM": { bg: "#eee5df", ink: "#6b5149", accent: "#d5c3b7", name: "NYM" },
  "MS ONLINE": { bg: "#e8edef", ink: "#46616a", accent: "#c5d5db", name: "MS ONLINE" },
};
const neutral = { bg: "#edeae5", ink: "#344759", accent: "#d7d1c6", name: "TR1 PHARMA" };
const money = (value: number) => value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " €";

export function ImportedProductsBrowser({ products }: { products: ImportedProduct[] }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [view, setView] = useState<"gallery" | "list">("gallery");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))]
    .map((name) => ({ name, count: products.filter((p) => p.brand === name).length }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr")), [products]);
  const categories = useMemo(() => [...new Set(products
    .filter((p) => brand === "all" || p.brand === brand)
    .map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [products, brand]);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return products.filter((p) =>
      (brand === "all" || p.brand === brand) &&
      (category === "all" || p.category === category) &&
      (!onlyIssues || p.needsReview || !p.ean || p.vatRate === null) &&
      [p.name, p.sku, p.brand, p.category, p.ean ?? "", p.sourceEAN ?? ""]
        .some((v) => v.toLocaleLowerCase("fr").includes(needle))
    ).sort((a, b) => sort === "price" ? a.priceHT - b.priceHT
      : sort === "brand" ? a.brand.localeCompare(b.brand, "fr") || a.name.localeCompare(b.name, "fr")
      : a.name.localeCompare(b.name, "fr"));
  }, [products, query, brand, category, onlyIssues, sort]);
  const perPage = view === "gallery" ? 18 : 30;
  const pages = Math.max(1, Math.ceil(matches.length / perPage));
  const currentPage = Math.min(page, pages);
  const shown = matches.slice((currentPage - 1) * perPage, currentPage * perPage);
  const changeBrand = (next: string) => { setBrand(next); setCategory("all"); setPage(1); };
  const control = "h-12 w-full rounded-xl border border-[#e4e8e8] bg-white px-3 text-sm text-[#26394c]";

  return (
    <section className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
      <aside>
        <div className="rounded-2xl border border-[#e4e8e8] bg-white p-4 lg:sticky lg:top-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#79838e]">Nos marques</p>
            <span className="text-xs font-semibold text-[#79838e]">{brands.length}</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col">
            <button type="button" onClick={() => changeBrand("all")}
              className={"flex min-h-11 shrink-0 items-center justify-between gap-4 rounded-xl px-3 text-left text-sm font-bold lg:w-full " + (brand === "all" ? "bg-[#142941] text-white" : "text-[#526273] hover:bg-[#f5f6f5]")}>
              Toutes les marques <span className="text-xs opacity-60">{products.length}</span>
            </button>
            {brands.map(({ name, count }) => (
              <button key={name} type="button" onClick={() => changeBrand(name)}
                className={"flex min-h-11 shrink-0 items-center justify-between gap-4 rounded-xl px-3 text-left text-sm font-semibold lg:w-full " + (brand === name ? "bg-[#142941] text-white" : "text-[#526273] hover:bg-[#f5f6f5]")}>
                <span className="whitespace-nowrap">{name}</span><span className="text-xs opacity-60">{count}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-4 hidden px-2 text-xs leading-5 text-[#76818b] lg:block">
          Bibliothèque de travail privée. Les prix d’achat ne sont jamais publiés aux officines.
        </p>
      </aside>

      <div className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-2xl border border-[#e4e8e8] bg-white">
          <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_180px_145px]">
            <label className="relative block">
              <span className="sr-only">Rechercher</span>
              <Search size={18} aria-hidden="true" className="absolute left-3.5 top-3.5 text-[#85909a]" />
              <input value={query} type="search" onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Nom, marque, code EAN…" className={control + " pl-11"} />
            </label>
            <label><span className="sr-only">Catégorie</span>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className={control}>
                <option value="all">Toutes catégories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label><span className="sr-only">Tri</span>
              <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={control}>
                <option value="name">Nom A–Z</option><option value="brand">Par marque</option><option value="price">Coût croissant</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eff0ef] px-4 py-3">
            <label className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-[#536172]">
              <input type="checkbox" checked={onlyIssues} onChange={(e) => { setOnlyIssues(e.target.checked); setPage(1); }} className="size-4 accent-[#142941]" /> À contrôler uniquement
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowCosts((v) => !v)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[#526173] hover:bg-[#f5f6f5]">
                {showCosts ? <EyeOff size={15}/> : <Eye size={15}/>}
                {showCosts ? "Masquer les coûts" : "Afficher les coûts internes"}
              </button>
              <div className="flex rounded-lg border border-[#e6e9e9] bg-[#f7f8f7] p-1">
                <button type="button" aria-label="Galerie" aria-pressed={view === "gallery"} onClick={() => { setView("gallery"); setPage(1); }}
                  className={"rounded-md p-2 " + (view === "gallery" ? "bg-white text-[#142941] shadow-sm" : "text-[#949ba1]")}><Grid2X2 size={16}/></button>
                <button type="button" aria-label="Liste" aria-pressed={view === "list"} onClick={() => { setView("list"); setPage(1); }}
                  className={"rounded-md p-2 " + (view === "list" ? "bg-white text-[#142941] shadow-sm" : "text-[#949ba1]")}><List size={16}/></button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ac653d]">Sélection fournisseur</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[#142941] sm:text-2xl">{brand === "all" ? "La collection" : brand}</h2></div>
          <span className="text-xs font-bold text-[#71808c]">{matches.length} références</span>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dce2e2] bg-white p-10 text-center">
            <p className="text-sm font-bold text-[#142941]">Aucun produit pour ces filtres.</p>
            <button type="button" onClick={() => { setQuery(""); setOnlyIssues(false); changeBrand("all"); }} className="mt-3 text-xs font-bold text-[#ac653d] underline">Réinitialiser</button>
          </div>
        ) : view === "gallery" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => {
              const tone = tones[p.brand] ?? neutral;
              return (
                <article key={p.id} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e4e8e8] bg-white transition hover:-translate-y-0.5 hover:border-[#bfcbd0] hover:shadow-[0_16px_32px_-22px_rgba(15,35,56,.3)]">
                  <div className="relative flex h-48 items-center justify-center overflow-hidden p-4" style={{ backgroundColor: tone.bg }}>
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt={p.name} width={400} height={400} unoptimized className="relative z-10 h-full w-full object-contain" />
                    ) : (
                      <>
                        <span aria-hidden="true" className="absolute -right-12 -top-12 size-48 rounded-full border-[35px] opacity-40" style={{ borderColor: tone.accent }}/>
                        <div className="relative z-10 text-center" style={{ color: tone.ink }}>
                          <p className="text-[10px] font-semibold uppercase tracking-[.29em] opacity-65">Collection</p>
                          <p className="mt-2 text-2xl font-black tracking-[-.04em]">{tone.name}</p>
                          <div className="mx-auto mt-3 h-px w-14 opacity-50" style={{ backgroundColor: tone.ink }}/>
                        </div>
                        <span className="absolute bottom-3 left-4 text-[9px] font-semibold uppercase tracking-[.08em] opacity-65" style={{ color: tone.ink }}>Photo à intégrer</span>
                      </>
                    )}
                    <span className="absolute right-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold text-[#435263]">
                      {p.active ? "Publié" : "Brouillon"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#ad693c]">{p.brand}</p>
                    <h3 className="mt-2 min-h-12 text-[15px] font-bold leading-6 text-[#142941]">{p.name}</h3>
                    <p className="mt-1 text-xs text-[#788591]">{p.category || "Soin"}{p.format ? " · " + p.format : ""}</p>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-[#eff0ef] pt-4">
                      <div><p className="text-[10px] text-[#85909a]">{showCosts ? "Achat fournisseur HT" : "Prix B2B"}</p>
                        <p className="mt-1 text-lg font-extrabold tabular-nums text-[#142941]">{showCosts ? money(p.priceHT) : "À définir"}</p></div>
                      <span className={"rounded-md px-2 py-1 text-[10px] font-bold " + (p.needsReview ? "bg-[#f8efe4] text-[#986032]" : "bg-[#eaf1eb] text-[#47734c]")}>
                        {p.needsReview ? "À contrôler" : <><Check size={11} className="inline" /> Validé</>}
                      </span>
                    </div>
                    <details className="mt-4 border-t border-[#eff0ef] pt-3 text-xs text-[#546273]">
                      <summary className="cursor-pointer font-bold text-[#344d60]">Détails, EAN & paliers</summary>
                      <div className="mt-3 space-y-2 rounded-xl bg-[#f7f8f6] p-3">
                        <p><strong>EAN :</strong> {p.ean || "Non renseigné"}</p><p><strong>SKU :</strong> {p.sku}</p>
                        <p><strong>TVA :</strong> {p.vatRate === null ? "À confirmer" : p.vatRate + " %"}</p>
                        <p><strong>Quantité minimum source :</strong> {p.minQuantity} (à confirmer)</p>
                        <p className="break-words"><strong>Source :</strong> {p.sourceDocument}{p.sourceRow ? ", " + (p.sourceDocument.endsWith(".pdf") ? "p. " : "ligne ") + p.sourceRow : ""}</p>
                        <div className="border-t border-[#e4e8e8] pt-2"><p className="mb-1 font-bold">Paliers achat HT (internes)</p>
                          {p.tiers.map((tier) => (
                            <div key={tier.number} className="flex justify-between gap-2 py-1"><span>Qté {tier.quantity}</span><strong>{showCosts ? money(tier.price) : "Masqué"}</strong></div>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e4e8e8] bg-white">
            <div className="hidden grid-cols-[1fr_135px_140px_90px] gap-3 border-b border-[#e4e8e8] bg-[#f7f8f6] px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-[#86909b] md:grid">
              <span>Référence</span><span>EAN</span><span>Achat HT</span><span>Statut</span>
            </div>
            {shown.map((p) => (
              <div key={p.id} className="grid gap-2 border-b border-[#eff0ef] p-4 last:border-0 md:grid-cols-[1fr_135px_140px_90px] md:items-center md:gap-3 md:px-5">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#ac653d]">{p.brand} · {p.category}</p><p className="mt-1 text-sm font-bold text-[#142941]">{p.name}</p><p className="mt-1 break-all text-xs text-[#89929a]">{p.sku}</p></div>
                <span className="text-xs text-[#566776]">{p.ean ?? "EAN absent"}</span>
                <strong className="text-sm text-[#142941]">{showCosts ? money(p.priceHT) : "Masqué"}</strong>
                <span className="text-xs font-bold text-[#9b683b]">{p.needsReview ? "À vérifier" : "Validé"}</span>
              </div>
            ))}
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#566677]">
            <span>Page {currentPage} / {pages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#e4e8e8] px-3 disabled:opacity-30"><ChevronLeft size={15}/>Précédent</button>
              <button type="button" disabled={currentPage >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#e4e8e8] px-3 disabled:opacity-30">Suivant<ChevronRight size={15}/></button>
            </div>
          </nav>
        )}
      </div>
    </section>
  );
}
