"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, LockKeyhole, Search, SlidersHorizontal } from "lucide-react";
import { vkSwissMediaBySku } from "@/lib/catalogue-vk-swiss-media";
import { publicPreviewProducts, type PublicPreviewProduct } from "@/lib/catalogue-public-preview";

type DisplayProduct = PublicPreviewProduct & { sku?: string };
type BrandTheme = { bg: string; ink: string; border: string; short: string; detail: string };

const vkProducts: DisplayProduct[] = [
  { brand: "VK SWISS", name: "Ashwagandha KSM-66", sku: "6467333", ean: "7629999810969", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Bacopa", sku: "6467332", ean: "7629999601949", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Curcuma", sku: "6467334", ean: "7629999608559", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Shatavari", sku: "6467330", ean: "7629999637191", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Shilajit", sku: "6467328", ean: "7629999731837", format: "30 gélules", category: "Compléments alimentaires" },
  { brand: "VK SWISS", name: "Tribulus", sku: "6467329", ean: "7629999149366", format: "30 gélules", category: "Compléments alimentaires" },
];
const allProducts: DisplayProduct[] = [...publicPreviewProducts, ...vkProducts];
const brands = ["Toutes les marques", "Beauty of Joseon", "Dr. Althea", "Biodance", "VK SWISS"];

const themes: Record<string, BrandTheme> = {
  "Beauty of Joseon": { bg: "#eee9de", ink: "#5d4a36", border: "#c6b496", short: "BEAUTY OF JOSEON", detail: "Soins coréens inspirés des rituels traditionnels" },
  "Dr. Althea": { bg: "#e7eee9", ink: "#3d6757", border: "#b7cabc", short: "Dr. Althea", detail: "Soins visage, sérums et rituels apaisants" },
  "Biodance": { bg: "#f2e8ec", ink: "#8b5a6c", border: "#d9bfca", short: "BIODANCE", detail: "Masques hydrogel et soins du visage" },
  "VK SWISS": { bg: "#e9edf1", ink: "#263d56", border: "#c6d0db", short: "VK SWISS", detail: "Compléments alimentaires" },
};

const formatBrandCount = (brand: string) => allProducts.filter((p) => p.brand === brand).length;

export function PublicProductGrid() {
  const [selectedBrand, setSelectedBrand] = useState("Toutes les marques");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => [...new Set(allProducts.filter((p) => selectedBrand === "Toutes les marques" || p.brand === selectedBrand)
      .map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [selectedBrand],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    const matches = allProducts.filter((p) => (
      (selectedBrand === "Toutes les marques" || p.brand === selectedBrand) &&
      (category === "all" || p.category === category) &&
      [p.brand, p.name, p.category, p.format, p.ean, p.sku ?? ""]
        .some((value) => value.toLocaleLowerCase("fr").includes(needle))
    ));
    return matches.sort((a, b) => sort === "brand"
      ? a.brand.localeCompare(b.brand, "fr") || a.name.localeCompare(b.name, "fr")
      : a.name.localeCompare(b.name, "fr"));
  }, [selectedBrand, query, category, sort]);
  const pageSize = 12;
  const maxPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const shown = visible.slice((Math.min(page, maxPage) - 1) * pageSize, Math.min(page, maxPage) * pageSize);
  const chooseBrand = (name: string) => { setSelectedBrand(name); setCategory("all"); setPage(1); };
  const theme = (name: string) => themes[name] ?? themes["VK SWISS"];

  return (
    <section id="produits" aria-labelledby="public-products" className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#b3683e]">Les collections TR1</p>
          <h2 id="public-products" className="mt-2 text-3xl font-black tracking-[-.045em] text-[#0e1d31] sm:text-[38px]">Explorez les marques.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66717d]">
            Découvrez les gammes en cours de référencement. Les conditions commerciales seront accessibles aux pharmacies autorisées après validation.
          </p>
        </div>
        <span className="rounded-full border border-[#e2e7ec] bg-white px-3.5 py-2 text-xs font-bold text-[#5d6b77]">{allProducts.length} références · {brands.length - 1} marques</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {brands.slice(1).map((brand) => {
          const look = theme(brand);
          return (
            <button type="button" key={brand} onClick={() => chooseBrand(brand)}
              aria-pressed={selectedBrand === brand}
              className={"group relative min-h-44 overflow-hidden rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg " +
                (selectedBrand === brand ? "ring-2 ring-[#de8e5e] ring-offset-2 " : "")}
              style={{ backgroundColor: look.bg, borderColor: look.border }}>
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full border-[24px] opacity-30" style={{ borderColor: look.border }} />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <p className="max-w-[180px] text-[17px] font-black leading-5 tracking-[-.035em] sm:text-lg" style={{ color: look.ink }}>{look.short}</p>
                  <ArrowUpRight size={16} aria-hidden="true" style={{ color: look.ink }} />
                </div>
                <div>
                  <p className="max-w-[200px] text-[11px] leading-5" style={{ color: look.ink }}>{look.detail}</p>
                  <p className="mt-3 text-xs font-bold" style={{ color: look.ink }}>{formatBrandCount(brand)} références</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-4 rounded-2xl border border-[#e4e8e8] bg-white p-3 sm:p-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {brands.map((b) => (
            <button type="button" key={b} onClick={() => chooseBrand(b)} aria-pressed={selectedBrand === b}
              className={"min-h-10 shrink-0 rounded-full px-4 text-xs font-bold transition " +
                (selectedBrand === b ? "bg-[#142941] text-white" : "bg-[#f7f7f5] text-[#5b6875] hover:bg-[#eff1f1]")}>
              {b}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_195px_145px]">
          <label className="relative block">
            <span className="sr-only">Recherche produit</span>
            <Search size={18} aria-hidden="true" className="absolute left-3.5 top-3 text-[#8c959d]" />
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Rechercher une référence ou un EAN…"
              className="h-11 w-full rounded-xl border border-[#e4e8e8] bg-[#fafaf8] pl-11 pr-3 text-sm outline-none focus:border-[#c6b7a7]" />
          </label>
          <label className="relative">
            <span className="sr-only">Catégorie</span>
            <SlidersHorizontal size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-[#8c959d]" />
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="h-11 w-full rounded-xl border border-[#e4e8e8] bg-[#fafaf8] pl-9 pr-3 text-sm">
              <option value="all">Toutes catégories</option>
              {categories.map((c) => <option value={c} key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Trier</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="h-11 w-full rounded-xl border border-[#e4e8e8] bg-[#fafaf8] px-3 text-sm">
              <option value="name">Nom A–Z</option><option value="brand">Par marque</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#ad693c]">Aperçu du catalogue</p>
          <h3 className="mt-1 text-xl font-black text-[#142941]">{selectedBrand === "Toutes les marques" ? "Toutes les références" : selectedBrand}</h3></div>
        <p className="text-xs font-semibold text-[#7b8791]">{visible.length} produits</p>
      </div>

      {shown.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((product) => {
            const look = theme(product.brand);
            const isVk = product.brand === "VK SWISS" && !!product.sku;
            return (
              <article key={product.brand + product.name + product.ean}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e5e9e9] bg-white transition hover:border-[#cbd5d6] hover:shadow-[0_18px_38px_-25px_rgba(18,38,57,.25)]">
                <div className="relative flex h-40 items-center justify-center overflow-hidden sm:h-48"
                  style={{ backgroundColor: look.bg }}>
                  {isVk && product.sku && vkSwissMediaBySku[product.sku] ? (
                    <Image src={vkSwissMediaBySku[product.sku].url} alt={product.name} width={440} height={440}
                      unoptimized className="h-full w-full object-contain p-4" />
                  ) : (
                    <div className="relative flex h-full w-full flex-col items-center justify-center p-4 text-center" style={{ color: look.ink }}>
                      <span className="absolute -right-10 top-0 size-36 rounded-full border-[26px] opacity-25" style={{ borderColor: look.border }} aria-hidden="true"/>
                      <span className="relative text-[10px] font-semibold uppercase tracking-[.18em] opacity-65">Soin & beauté</span>
                      <span className="relative mt-3 max-w-[190px] text-lg font-black leading-6 tracking-[-.04em]">{look.short}</span>
                      <span className="relative mt-4 h-px w-10 opacity-40" style={{ backgroundColor: look.ink }}/>
                      <span className="absolute bottom-2 left-3 text-[9px] font-semibold uppercase opacity-60">Visuel à venir</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#b36a3d]">{product.brand}</p>
                  <h4 className="mt-2 min-h-12 text-sm font-extrabold leading-5 text-[#142941] sm:text-[15px]">{product.name}</h4>
                  <p className="mt-1.5 text-xs leading-5 text-[#7b8690]">{product.category}{product.format ? " · " + product.format : ""}</p>
                  <div className="mt-auto border-t border-[#eef0f0] pt-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64717e]">
                      <LockKeyhole size={13} aria-hidden="true" /> Tarifs professionnels non publics
                    </p>
                    <p className="mt-2 text-[11px] text-[#8a9299]">{product.ean ? "EAN " + product.ean : "Référence en cours de vérification"}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d8dfe1] bg-white p-10 text-center">
          <p className="font-bold text-[#142941]">Aucun produit ne correspond à cette recherche.</p>
          <button type="button" onClick={() => { setQuery(""); setCategory("all"); chooseBrand("Toutes les marques"); }} className="mt-3 text-xs font-semibold underline">Effacer les filtres</button>
        </div>
      )}

      {maxPage > 1 && (
        <nav aria-label="Pagination des références" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#5b6772]">
          <span>Page {Math.min(page,maxPage)} / {maxPage}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((v) => Math.max(1, v - 1))}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#e2e7ec] px-3 disabled:opacity-30">
              <ChevronLeft size={16}/> Précédent
            </button>
            <button type="button" disabled={page >= maxPage} onClick={() => setPage((v) => Math.min(maxPage, v + 1))}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#e2e7ec] px-3 disabled:opacity-30">
              Suivant <ChevronRight size={16}/>
            </button>
          </div>
        </nav>
      )}
      <div className="rounded-xl border border-[#e9e2d6] bg-[#f7f4ee] px-5 py-4 text-xs leading-6 text-[#6d6a64]">
        <p><Check size={15} aria-hidden="true" className="mr-2 inline" />
          Aperçu non contractuel. Références, EAN, photos et conditions de distribution soumis à validation avant publication commerciale.</p>
        <p className="mt-1">Les prix et remises ne sont jamais affichés dans ce catalogue public.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#142941] p-6 text-white sm:p-8">
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#e3a474]">Vous êtes pharmacien ?</p>
          <h3 className="mt-2 text-xl font-black sm:text-2xl">Les conditions sont réservées aux officines.</h3>
          <p className="mt-2 max-w-xl text-xs leading-5 text-[#bdcbd7]">Une fois votre compte professionnel autorisé, retrouvez votre sélection et les tarifs validés par TR1 PHARMA.</p>
        </div>
        <Link href="/catalogue/connexion" className="shop-primary-action inline-flex min-h-11 items-center gap-2 px-4 text-sm">
          Connexion pro <ArrowUpRight size={16}/>
        </Link>
      </div>
    </section>
  );
}
