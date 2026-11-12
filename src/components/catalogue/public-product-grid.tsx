"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LockKeyhole, Package, Search, SlidersHorizontal } from "lucide-react";

type DisplayProduct = { name: string; sku: string; ean: string; brand: string };

// Références vérifiées dans le catalogue TR1, sans prix ni allégation produit.
// Toutes les photos et conditions commerciales sont à valider avant publication.
const products: DisplayProduct[] = [
  { name: "Ashwagandha KSM-66", sku: "6467333", ean: "7629999810969", brand: "VK SWISS" },
  { name: "Bacopa", sku: "6467332", ean: "7629999601949", brand: "VK SWISS" },
  { name: "Curcuma", sku: "6467334", ean: "7629999608559", brand: "VK SWISS" },
  { name: "Shatavari", sku: "6467330", ean: "7629999637191", brand: "VK SWISS" },
  { name: "Shilajit", sku: "6467328", ean: "7629999731837", brand: "VK SWISS" },
  { name: "Tribulus", sku: "6467329", ean: "7629999149366", brand: "VK SWISS" },
];

export function PublicProductGrid() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    const filtered = products.filter((p) =>
      [p.name, p.brand, p.sku, p.ean].some((field) => field.toLocaleLowerCase("fr").includes(normalized)),
    );
    return filtered.sort((a, b) => sort === "sku" ? a.sku.localeCompare(b.sku) : a.name.localeCompare(b.name, "fr"));
  }, [query, sort]);

  return (
    <section id="produits" aria-labelledby="public-products" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#b96b44]">Catalogue professionnel</p>
          <h2 id="public-products" className="mt-2 text-2xl font-black tracking-tight text-[#142a35] sm:text-3xl">
            Nos références
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[#71808a]">
            Retrouvez les références de nos marques partenaires. Les tarifs et la prise de commande sont réservés aux pharmacies disposant d&apos;un accès.
          </p>
        </div>
        <p className="rounded-full border border-[#e2e8e7] bg-white px-3 py-1.5 text-xs font-bold text-[#657780]">
          {visible.length} référence{visible.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#e3e7e5] bg-white p-4 sm:grid-cols-[1fr_220px]">
        <label className="flex items-center gap-3 rounded-lg border border-[#dce4e1] bg-[#f9faf9] px-3">
          <Search size={18} aria-hidden="true" className="shrink-0 text-[#687b83]" />
          <span className="sr-only">Rechercher un produit, un EAN ou une référence</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit, un EAN…" className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#84939a]" />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[#dce4e1] bg-[#f9faf9] px-3">
          <SlidersHorizontal size={17} aria-hidden="true" className="shrink-0 text-[#687b83]" />
          <span className="sr-only">Trier les produits</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-11 w-full bg-transparent text-sm font-semibold outline-none">
            <option value="name">Nom du produit (A–Z)</option>
            <option value="sku">Référence produit</option>
          </select>
        </label>
      </div>

      {visible.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {visible.map((product, index) => (
            <article key={product.sku} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e5e9e8] bg-white transition hover:border-[#c6d4d0] hover:shadow-[0_18px_45px_-24px_rgba(20,42,53,.25)]">
              <div className="relative flex h-40 items-center justify-center overflow-hidden bg-[linear-gradient(140deg,#e9f0eb,#f5f3ee)] sm:h-56">
                <div aria-hidden="true" className="absolute -right-12 -top-16 size-44 rounded-full border-[30px] border-white/30" />
                <div aria-hidden="true" className="flex h-25 w-18 translate-y-2 flex-col items-center justify-center rounded-[8px] border border-[#d7d7cc] bg-[linear-gradient(105deg,#e1e6da,#fffdf5_50%,#d9ddd1)] shadow-[11px_16px_25px_rgba(37,48,42,.14)] sm:h-32 sm:w-23">
                  <span className="text-[9px] font-black tracking-[.14em] text-[#5c7067]">VK SWISS</span>
                  <span className="mx-2 mt-2 max-w-full truncate text-[8px] font-bold text-[#7f8d84]">{product.name}</span>
                  <span className="mt-4 h-px w-9 bg-[#9ca89c]" />
                </div>
                <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold text-[#71817a]">
                  Visuel illustratif
                </span>
              </div>
              <div className="flex flex-1 flex-col p-3.5 sm:p-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#a76b49]">{product.brand}</p>
                <h3 className="mt-1.5 min-h-12 text-base font-black leading-6 text-[#192f36] sm:text-lg">{product.name}</h3>
                <p className="mt-1 text-[11px] text-[#849097]">Réf. {product.sku}</p>
                <div className="mt-auto border-t border-[#edf0ee] pt-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-[#445c63]">
                    <LockKeyhole size={13} aria-hidden="true" />
                    Tarifs professionnels sur connexion
                  </p>
                  <Link href="/catalogue/connexion"
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#173d3b] px-3 text-center text-xs font-extrabold text-white transition hover:bg-[#245750] sm:text-sm">
                    Voir mes conditions <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#cbd6d1] bg-white py-14 text-center">
          <Package size={29} aria-hidden="true" className="text-[#83958b]" />
          <p className="font-bold text-[#173d3b]">Aucun produit ne correspond à la recherche.</p>
          <button type="button" onClick={() => setQuery("")} className="text-sm font-semibold underline underline-offset-4">Effacer la recherche</button>
        </div>
      )}
    </section>
  );
}
