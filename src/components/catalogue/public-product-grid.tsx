"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, LockKeyhole, Search, SlidersHorizontal } from "lucide-react";
import { publicCatalogueProducts, publicProductImage, publicProductHref, publicProductKey, type PublicCatalogueProduct } from "@/lib/catalogue-products";
import { euroHT } from "@/lib/private-catalogue-format";
import { OnlineDemandBadge } from "@/components/catalogue/online-demand-badge";

type DisplayProduct = PublicCatalogueProduct;
type BrandTheme = { bg: string; ink: string; border: string; short: string; detail: string };
type PrivateDisplayProduct = {
  id: string;
  brandSlug: string;
  name: string;
  ean: string | null;
  min_quantity: number;
  vat_rate: number;
  pricing:
    | { mode: "indicative"; tiers: { min_quantity: number; price_min_ht: number; price_max_ht: number }[] }
    | { mode: "contractual"; tiers: { min_quantity: number; price_ht: number }[] };
};
const brandSlugs: Record<string, string> = {
  "Beauty of Joseon": "beauty-of-joseon",
  "Dr. Althea": "dr-althea",
  "Biodance": "biodance",
};
const normalizeProductName = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();
function privateTierForQuantity(product: PrivateDisplayProduct, quantity: number) {
  let selected: PrivateDisplayProduct["pricing"]["tiers"][number] | null = null;
  for (const tier of product.pricing.tiers) {
    if (tier.min_quantity <= quantity && (!selected || tier.min_quantity > selected.min_quantity)) {
      selected = tier;
    }
  }
  return selected;
}
function privateTierPrice(
  pricing: PrivateDisplayProduct["pricing"],
  tier: PrivateDisplayProduct["pricing"]["tiers"][number] | null,
) {
  if (!tier) return "Tarif sur demande";
  if (pricing.mode === "contractual" && "price_ht" in tier) return euroHT(tier.price_ht);
  if (pricing.mode === "indicative" && "price_min_ht" in tier) {
    return tier.price_min_ht === tier.price_max_ht
      ? euroHT(tier.price_min_ht)
      : euroHT(tier.price_min_ht) + " – " + euroHT(tier.price_max_ht);
  }
  return "Tarif sur demande";
}

const allProducts: DisplayProduct[] = publicCatalogueProducts;
const brands = ["Toutes les marques", "Beauty of Joseon", "Dr. Althea", "Biodance", "Vitalora"];

// Logos de marques en haute définition : source, proportion et transparence préservées.
// Pas de zoom ni de recadrage. Autorisations d'utilisation commerciale à confirmer.
const brandLogos: Record<string, { src: string }> = {
  "Beauty of Joseon": { src: "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-marque-logo-hd-beauty-of-joseon.png?v=1795246073" },
  "Dr. Althea": { src: "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-marque-logo-hd-dr-althea.png?v=1795245963" },
  "Biodance": { src: "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-marque-logo-hd-biodance.png?v=1795245907" },
  "Vitalora": { src: "https://cdn.shopify.com/s/files/1/1120/5050/4019/files/tr1-marque-logo-hd-vitalora.png?v=1795246078" },
};

const themes: Record<string, BrandTheme> = {
  "Beauty of Joseon": { bg: "#eee9de", ink: "#5d4a36", border: "#c6b496", short: "BEAUTY OF JOSEON", detail: "Soins coréens inspirés des rituels traditionnels" },
  "Dr. Althea": { bg: "#e7eee9", ink: "#3d6757", border: "#b7cabc", short: "Dr. Althea", detail: "Soins visage, sérums et rituels apaisants" },
  "Biodance": { bg: "#f2e8ec", ink: "#8b5a6c", border: "#d9bfca", short: "BIODANCE", detail: "Masques hydrogel et soins du visage" },
  "VK SWISS": { bg: "#e9edf1", ink: "#263d56", border: "#c6d0db", short: "VK SWISS", detail: "Compléments alimentaires" },
  "Vitalora": { bg: "#e9ede5", ink: "#375443", border: "#c5d6c8", short: "VITALORA", detail: "Micronutrition, vitamines et actifs sélectionnés" },
};

export function PublicProductGrid({ privateProducts }: { privateProducts?: PrivateDisplayProduct[] } = {}) {
  const privateMode = privateProducts !== undefined;
  const privateProductMap = useMemo(() => {
    const map = new Map<string, PrivateDisplayProduct>();
    for (const product of privateProducts ?? []) {
      if (product.ean) map.set("ean:" + product.ean, product);
      map.set("name:" + product.brandSlug + ":" + normalizeProductName(product.name), product);
    }
    return map;
  }, [privateProducts]);
  const lookupPrivateProduct = (product: DisplayProduct) => {
    const slug = brandSlugs[product.brand];
    if (!slug) return undefined;
    return (product.ean ? privateProductMap.get("ean:" + product.ean) : undefined)
      ?? privateProductMap.get("name:" + slug + ":" + normalizeProductName(product.name));
  };
  const catalogueProducts = useMemo(() => {
    if (!privateMode) return allProducts;
    return allProducts.filter((product) => {
      const slug = brandSlugs[product.brand];
      if (!slug) return false;
      return Boolean(
        (product.ean ? privateProductMap.get("ean:" + product.ean) : undefined)
        ?? privateProductMap.get("name:" + slug + ":" + normalizeProductName(product.name)),
      );
    });
  }, [privateMode, privateProductMap]);
  const availableBrands = brands.filter((brand, index) =>
    index === 0 || catalogueProducts.some((product) => product.brand === brand),
  );
  const formatBrandCount = (brand: string) => catalogueProducts.filter((product) => product.brand === brand).length;
  const [selectedBrand, setSelectedBrand] = useState("Toutes les marques");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("photos");
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => [...new Set(catalogueProducts.filter((p) => selectedBrand === "Toutes les marques" || p.brand === selectedBrand)
      .map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [catalogueProducts, selectedBrand],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    const matches = catalogueProducts.filter((p) => (
      (selectedBrand === "Toutes les marques" || p.brand === selectedBrand) &&
      (category === "all" || p.category === category) &&
      [p.brand, p.name, p.category, p.format, p.ean, p.sku ?? ""]
        .some((value) => value.toLocaleLowerCase("fr").includes(needle))
    ));
    return matches.sort((a, b) => sort === "photos"
      ? Number(Boolean(publicProductImage(b))) - Number(Boolean(publicProductImage(a))) || a.name.localeCompare(b.name, "fr")
      : sort === "brand"
      ? a.brand.localeCompare(b.brand, "fr") || a.name.localeCompare(b.name, "fr")
      : a.name.localeCompare(b.name, "fr"));
  }, [catalogueProducts, selectedBrand, query, category, sort]);
  const pageSize = 12;
  const maxPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const shown = visible.slice((Math.min(page, maxPage) - 1) * pageSize, Math.min(page, maxPage) * pageSize);
  const chooseBrand = (name: string) => { setSelectedBrand(name); setCategory("all"); setPage(1); };
  const theme = (name: string) => themes[name] ?? themes["VK SWISS"];
  const resetFilters = () => { setSelectedBrand("Toutes les marques"); setCategory("all"); setQuery(""); setPage(1); };
  const activeFilterCount = Number(selectedBrand !== "Toutes les marques") + Number(category !== "all") + Number(Boolean(query.trim()));
  const selectedBrandCount = (name: string) => name === "Toutes les marques" ? catalogueProducts.length : formatBrandCount(name);
  const categoryCount = (name: string) => catalogueProducts.filter(
    (p) => (selectedBrand === "Toutes les marques" || p.brand === selectedBrand) && p.category === name,
  ).length;

  const filterControls = (includeSearch: boolean) => (
    <div className="space-y-5">
      {includeSearch ? (
        <label className="block">
          <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.12em] text-[#526272]">Nom, référence ou EAN</span>
          <span className="relative block">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-[#83919a]" />
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Rechercher un produit…"
              className="h-11 w-full rounded-lg border border-[#dce3e5] bg-[#fafaf8] pl-9 pr-3 text-sm text-[#142941] outline-none focus:border-[#bb855c]" />
          </span>
        </label>
      ) : null}
      <div>
        <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#526272]">Marques</h3>
        <div className="space-y-1">
          {availableBrands.map((brand) => {
            const logo = brandLogos[brand];
            const selected = selectedBrand === brand;
            return (
              <button type="button" key={brand} onClick={() => chooseBrand(brand)} aria-pressed={selected}
                className={"flex min-h-10 w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[12px] font-bold transition " +
                  (selected ? "border-[#cad7e5] bg-[#142941] text-white" : "border-transparent text-[#384b5d] hover:border-[#e0e6e6] hover:bg-[#f5f7f6]")}>
                {logo ? (
                  <span className="flex h-7 w-14 shrink-0 items-center justify-center rounded bg-white p-1">
                    <Image src={logo.src} alt="" width={112} height={56} unoptimized className="h-full w-full object-contain" />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 leading-4">{brand === "Toutes les marques" ? "Toutes les marques" : brand}</span>
                <span className={"shrink-0 text-[11px] tabular-nums " + (selected ? "text-white/75" : "text-[#8d999f]")}>{selectedBrandCount(brand)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#526272]">Catégories</h3>
        <div className="max-h-[250px] space-y-0.5 overflow-y-auto pr-1">
          <button type="button" onClick={() => { setCategory("all"); setPage(1); }} aria-pressed={category === "all"}
            className={"flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold " +
              (category === "all" ? "bg-[#eaf0ec] text-[#254c3a]" : "text-[#536677] hover:bg-[#f5f7f6]")}>
            <span>Toutes les catégories</span>
            <span className="text-[11px] tabular-nums opacity-70">{selectedBrandCount(selectedBrand)}</span>
          </button>
          {categories.map((name) => (
            <button type="button" key={name} onClick={() => { setCategory(name); setPage(1); }} aria-pressed={category === name}
              className={"flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold " +
                (category === name ? "bg-[#eaf0ec] text-[#254c3a]" : "text-[#536677] hover:bg-[#f5f7f6]")}>
              <span className="min-w-0 leading-4">{name}</span>
              <span className="shrink-0 text-[11px] tabular-nums opacity-70">{categoryCount(name)}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.12em] text-[#526272]">Trier les produits</span>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="h-10 w-full rounded-lg border border-[#dce3e5] bg-[#fafaf8] px-3 text-xs font-semibold text-[#142941]">
          <option value="photos">Photos d’abord</option>
          <option value="name">Nom A–Z</option>
          <option value="brand">Par marque</option>
        </select>
      </label>
      {activeFilterCount > 0 ? (
        <button type="button" onClick={resetFilters} className="w-full rounded-lg border border-[#e1e7e7] px-3 py-2.5 text-xs font-bold text-[#596a79] hover:bg-[#f5f7f6]">
          Réinitialiser les filtres
        </button>
      ) : null}
    </div>
  );

  return (
    <section id="produits" aria-labelledby="public-products" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#b3683e]">{privateMode ? "Espace pharmacie" : "Sélection TR1 PHARMA"}</p>
          <h2 id="public-products" className="mt-1 text-2xl font-black tracking-[-.035em] text-[#0e1d31] sm:text-3xl">
            {privateMode ? "Vos références" : "Tous les produits"}
          </h2>
        </div>
        <span className="rounded-full border border-[#e2e7ec] bg-white px-3 py-1.5 text-xs font-bold text-[#5d6b77]">
          {catalogueProducts.length} références · {catalogueProducts.filter((p) => Boolean(publicProductImage(p))).length} photos
        </span>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[252px_minmax(0,1fr)]">
        <aside aria-label="Filtres du catalogue" className="hidden rounded-xl border border-[#e2e7ec] bg-white p-4 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-black text-[#142941]">Filtrer</h3>
            {activeFilterCount > 0 ? <span className="rounded-full bg-[#eaf0ec] px-2 py-1 text-[10px] font-bold text-[#254c3a]">{activeFilterCount} actif(s)</span> : null}
          </div>
          {filterControls(true)}
        </aside>
        <div className="min-w-0 space-y-4">
          <div className="space-y-2 lg:hidden">
            <label className="relative block">
              <span className="sr-only">Rechercher un produit par nom, référence ou EAN</span>
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 text-[#83919a]" />
              <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Nom, référence ou EAN…"
                className="h-11 w-full rounded-lg border border-[#dce3e5] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#bb855c]" />
            </label>
            <details className="group rounded-xl border border-[#e2e7ec] bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-bold text-[#142941] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><SlidersHorizontal size={16} aria-hidden="true" /> Marques et catégories</span>
                <span className="text-xs font-semibold text-[#6e7e8c]">{activeFilterCount ? activeFilterCount + " filtre(s)" : "Afficher les filtres"}</span>
              </summary>
              <div className="border-t border-[#e8ecec] px-4 py-4">{filterControls(false)}</div>
            </details>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h3 className="text-base font-black text-[#142941] sm:text-lg">{selectedBrand === "Toutes les marques" ? "Toutes les références" : selectedBrand}</h3>
              <p className="text-xs text-[#788591]">{visible.length} produit{visible.length > 1 ? "s" : ""}{category !== "all" ? " · " + category : ""}</p>
            </div>
            {activeFilterCount > 0 ? <button type="button" onClick={resetFilters} className="text-xs font-bold text-[#a25e34] underline underline-offset-4">Effacer les filtres</button> : null}
          </div>
      {shown.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((product) => {
            const look = theme(product.brand);
            const photo = publicProductImage(product);
            const privateProduct = privateMode ? lookupPrivateProduct(product) : null;
            const selectedTier = privateProduct
              ? privateTierForQuantity(privateProduct, privateProduct.min_quantity)
              : null;
            const selectedPrice = privateProduct
              ? privateTierPrice(privateProduct.pricing, selectedTier)
              : null;
            return (
              <article key={product.brand + product.name + product.ean}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e5e9e9] bg-white transition hover:border-[#cbd5d6] hover:shadow-[0_18px_38px_-25px_rgba(18,38,57,.25)]">
                <div className="relative flex h-40 items-center justify-center overflow-hidden sm:h-48"
                  style={{ backgroundColor: look.bg }}>
                  {photo ? (
                    <Image src={photo.url} alt={product.brand + " " + product.name + " — " + product.format} width={700} height={700}
                      unoptimized className="h-full w-full object-contain p-4" />
                  ) : (
                    <div className="relative flex h-full w-full flex-col items-center justify-center p-4 text-center" style={{ color: look.ink }}>
                      <span className="absolute -right-10 top-0 size-36 rounded-full border-[26px] opacity-25" style={{ borderColor: look.border }} aria-hidden="true"/>
                      <span className="relative text-[10px] font-semibold uppercase tracking-[.18em] opacity-65">{product.brand === "Vitalora" ? "Micronutrition" : "Soin & beauté"}</span>
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
                  {product.brand !== "Vitalora" ? <OnlineDemandBadge ean={product.ean} productId={privateProduct?.id} compact /> : null}
                  {product.brand === "Vitalora" ? <p className="mt-1 text-[11px] font-semibold text-[#617c67]">Vitrine · Commandes non ouvertes</p> : null}
                  <div className="mt-auto border-t border-[#eef0f0] pt-3">
                    {privateMode && privateProduct ? (
                      <>
                        <p className="text-[11px] font-semibold text-[#64717e]">
                          {privateProduct.pricing.mode === "contractual" ? "Votre tarif HT / unité" : "Tarif professionnel HT / unité"}
                        </p>
                        <p className="mt-1 text-lg font-black tracking-tight text-[#142941]">{selectedPrice}</p>
                        <p className="mt-1 text-[10px] text-[#7b8690]">
                          Minimum {privateProduct.min_quantity} u. · TVA {privateProduct.vat_rate} %
                        </p>
                        {privateProduct.pricing.tiers.length > 1 ? (
                          <details className="mt-2 rounded-lg bg-[#f7f7f5] px-3 py-2">
                            <summary className="cursor-pointer text-[11px] font-bold text-[#31475a]">Voir les paliers fournisseurs</summary>
                            <div className="mt-2 space-y-1.5 border-t border-[#e5e9e9] pt-2">
                              {privateProduct.pricing.tiers.map((tier) => (
                                <div key={tier.min_quantity} className="flex items-center justify-between gap-2 text-[11px] text-[#64717e]">
                                  <span>Dès {tier.min_quantity} unités</span>
                                  <strong className="text-[#142941]">{privateTierPrice(privateProduct.pricing, tier)} HT</strong>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                        <p className="mt-2 text-[11px] text-[#8a9299]">{product.ean ? "EAN " + product.ean : ""}</p>
                        <div className="mt-3 grid gap-2">
                          <Link href={"/catalogue/marques/" + privateProduct.brandSlug + "/fiche/" + publicProductKey(product)}
                            className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#dce3e5] bg-white px-3 text-center text-[11px] font-extrabold text-[#142941] hover:bg-[#f7f8f6]">
                            Fiche produit <ArrowUpRight size={13} aria-hidden="true"/>
                          </Link>
                          <Link href={"/catalogue/marques/" + privateProduct.brandSlug + "?produit=" + privateProduct.id + "#produits"}
                            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#142941] px-3 text-center text-xs font-extrabold text-white hover:bg-[#1e405f]">
                            Préparer ma commande <ArrowUpRight size={14} aria-hidden="true"/>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64717e]">
                          <LockKeyhole size={13} aria-hidden="true" /> Tarifs professionnels non publics
                        </p>
                        <p className="mt-2 text-[11px] text-[#8a9299]">{product.ean ? "EAN " + product.ean : ""}</p>
                        <Link href={publicProductHref(product)}
                          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#142941] px-3 text-center text-xs font-extrabold text-white hover:bg-[#1e405f]">
                          Fiche produit <ArrowUpRight size={14} aria-hidden="true"/>
                        </Link>
                      </>
                    )}
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
        </div>
      </div>

      {privateMode ? (
        <>
          <div className="rounded-xl border border-[#e9e2d6] bg-[#f7f4ee] px-5 py-4 text-xs leading-6 text-[#6d6a64]">
            <p><Check size={15} aria-hidden="true" className="mr-2 inline" />
              Tarifs professionnels indicatifs HT. Les paliers et minimums de commande sont indiqués par référence ; le tarif définitif est confirmé sur devis.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#142941] p-6 text-white sm:p-8">
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#e3a474]">Votre espace pharmacie</p>
              <h3 className="mt-2 text-xl font-black sm:text-2xl">Retrouvez le suivi de vos demandes.</h3>
              <p className="mt-2 max-w-xl text-xs leading-5 text-[#bdcbd7]">Vos tarifs sont réservés à votre officine et restent invisibles depuis le catalogue public.</p>
            </div>
            <Link href="/catalogue/mes-demandes" className="shop-primary-action inline-flex min-h-11 items-center gap-2 px-4 text-sm">
              Mes demandes <ArrowUpRight size={16}/>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-[#e9e2d6] bg-[#f7f4ee] px-5 py-4 text-xs leading-6 text-[#6d6a64]">
            <p><Check size={15} aria-hidden="true" className="mr-2 inline" />
              Les prix et remises ne sont jamais affichés dans ce catalogue public.</p>
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
        </>
      )}
    </section>
  );
}
