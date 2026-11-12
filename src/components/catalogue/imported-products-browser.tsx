"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, LockKeyhole } from "lucide-react";

export type ImportedProduct = {
  id: string;
  brand: string;
  sku: string;
  name: string;
  category: string;
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

export function ImportedProductsBrowser({ products }: { products: ImportedProduct[] }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [page, setPage] = useState(1);
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const categories = useMemo(() => [...new Set(products.filter((p) => brand === "all" || p.brand === brand).map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [products, brand]);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return products.filter((p) =>
      (brand === "all" || p.brand === brand) &&
      (category === "all" || p.category === category) &&
      (!onlyIssues || p.needsReview || !p.ean || p.vatRate === null) &&
      [p.name, p.sku, p.category, p.ean ?? "", p.sourceEAN ?? ""].some((v) => v.toLocaleLowerCase("fr").includes(needle)),
    );
  }, [products, query, brand, category, onlyIssues]);
  const pages = Math.max(1, Math.ceil(matches.length / 24));
  const shown = matches.slice((Math.min(page, pages) - 1) * 24, Math.min(page, pages) * 24);
  const changeBrand = (next: string) => { setBrand(next); setCategory("all"); setPage(1); };
  const formatPrice = (value: number) =>
    value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " € HT";
  const baseClass = "min-h-11 w-full rounded-md border border-[#dce3ea] bg-white px-3 text-sm text-[#0e1d31]";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-lg border border-[#e2e7ec] bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative block">
          <span className="sr-only">Rechercher une référence</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-[#69717d]" aria-hidden="true" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            className={baseClass + " pl-9"} type="search" placeholder="Produit, SKU ou EAN…" />
        </label>
        <label className="block">
          <span className="sr-only">Filtrer par marque</span>
          <select className={baseClass} value={brand} onChange={(event) => changeBrand(event.target.value)}>
            <option value="all">Toutes les marques</option>
            {brands.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Filtrer par catégorie</span>
          <select className={baseClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
            <option value="all">Toutes les catégories</option>
            {categories.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-[#dce3ea] bg-white px-3 text-sm font-semibold">
          <input type="checkbox" checked={onlyIssues} onChange={(event) => { setOnlyIssues(event.target.checked); setPage(1); }}
            className="size-4 accent-[#ea7015]" />
          À vérifier seulement
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#515d6b]">
          <SlidersHorizontal size={16} aria-hidden="true" /> {matches.length} références affichées
        </p>
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[#515d6b]">
          <LockKeyhole size={15} aria-hidden="true" /> Tarifs confidentiels · Administrateur uniquement
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#e2e7ec] bg-white">
        {shown.map((product) => (
          <details key={product.id} className="group border-b border-[#e2e7ec] last:border-b-0">
            <summary className="grid cursor-pointer list-none items-center gap-3 px-4 py-4 hover:bg-[#faf9f6] sm:grid-cols-[1.6fr_1fr_120px] sm:px-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#ad4b08]">{product.brand} · {product.sku}</p>
                <p className="mt-1 text-sm font-extrabold text-[#0e1d31]">{product.name}</p>
                <p className="mt-1 text-xs text-[#69717d]">{product.category || "Sans catégorie"}</p>
              </div>
              <div className="text-xs text-[#515d6b]">
                <p>EAN : {product.ean ?? "À contrôler"}</p>
                <p className="mt-1">TVA : {product.vatRate === null ? "À renseigner" : product.vatRate + " %"}</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <span className="rounded-md bg-[#fff1e6] px-2 py-1 text-[11px] font-bold text-[#ad4b08]">
                  {product.needsReview ? "À vérifier" : product.active ? "Actif" : "Brouillon"}
                </span>
              </div>
            </summary>
            <div className="grid gap-4 border-t border-[#e2e7ec] bg-[#faf9f6] px-5 py-4 text-xs text-[#515d6b] md:grid-cols-2">
              <div className="space-y-2">
                <p><strong>EAN source :</strong> {product.sourceEAN || "non renseigné"}</p>
                <p><strong>Minimum source :</strong> {product.minQuantity} unité(s) — conditionnement à vérifier</p>
                <p><strong>Prix d'achat initial :</strong> {formatPrice(product.priceHT)} (confidentiel)</p>
                <p><strong>Document :</strong> {product.sourceDocument}, {product.sourceDocument.endsWith(".pdf") ? "page" : "ligne"} {product.sourceRow ?? "?"}</p>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-[#0e1d31]">Paliers du fournisseur (non publiés)</p>
                {product.tiers.map((tier) => (
                  <div key={tier.number} className="flex justify-between gap-4 border-b border-[#e2e7ec] py-1 last:border-b-0">
                    <span>{tier.quantity} unité(s)</span>
                    <strong>{formatPrice(tier.price)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </details>
        ))}
        {!shown.length && <p className="p-8 text-sm text-[#69717d]">Aucune référence ne correspond à ces filtres.</p>}
      </div>

      {pages > 1 && (
        <nav aria-label="Pages du catalogue importé" className="flex items-center justify-center gap-4">
          <button type="button" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}
            className="rounded-md border border-[#dce3ea] px-4 py-2 text-sm font-bold disabled:opacity-40">Précédent</button>
          <span className="text-xs font-bold text-[#515d6b]">Page {Math.min(page, pages)} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((v) => Math.min(pages, v + 1))}
            className="rounded-md border border-[#dce3ea] px-4 py-2 text-sm font-bold disabled:opacity-40">Suivant</button>
        </nav>
      )}
    </div>
  );
}
