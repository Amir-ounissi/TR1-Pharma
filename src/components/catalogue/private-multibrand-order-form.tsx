"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import { Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import { sendMultiBrandCatalogueRequest } from "@/app/catalogue/actions";
import type { CatalogProduct } from "@/lib/private-catalogue";
import { euroHT, indicativeRange, isAllowedQuantity, tierForQuantity } from "@/lib/private-catalogue-format";

export type PrivateMultiBrandProduct = CatalogProduct & {
  brand_slug: string;
  brand_name: string;
};

type ProductTier = CatalogProduct["pricing"]["tiers"][number];

function priceRangeForTier(tier: ProductTier | null) {
  if (!tier) return null;
  if ("price_ht" in tier) return { min: Number(tier.price_ht), max: Number(tier.price_ht) };
  return { min: Number(tier.price_min_ht), max: Number(tier.price_max_ht) };
}

function formatPriceRange(min: number, max: number) {
  const low = euroHT(min);
  const high = euroHT(max);
  return low === high ? low : `${low} – ${high}`;
}

function nextTierForQuantity(tiers: readonly ProductTier[], quantity: number) {
  return [...tiers].filter((tier) => tier.min_quantity > quantity)
    .sort((a, b) => a.min_quantity - b.min_quantity)[0] ?? null;
}

export function PrivateMultiBrandOrderForm({
  products,
  initialBrandSlug,
  initialProductId,
}: {
  products: PrivateMultiBrandProduct[];
  initialBrandSlug?: string;
  initialProductId?: string;
}) {
  const [state, action, pending] = useActionState(sendMultiBrandCatalogueRequest, { error: "" });
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const target = products.find((product) => product.id === initialProductId);
    return target ? { [target.id]: target.min_quantity } : {};
  });
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState(initialBrandSlug ?? "all");
  const [sort, setSort] = useState("brand");

  const brandOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const product of products) unique.set(product.brand_slug, product.brand_name);
    return [...unique.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [products]);

  const selected = useMemo(
    () => products.filter((product) => (quantities[product.id] ?? 0) > 0),
    [products, quantities],
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return products
      .filter((product) => (
        (brandFilter === "all" || product.brand_slug === brandFilter) &&
        [
          product.brand_name, product.name, product.sku, product.ean ?? "",
          product.description, product.format,
        ].some((value) => value.toLocaleLowerCase("fr").includes(normalized))
      ))
      .sort((a, b) => sort === "name"
        ? a.name.localeCompare(b.name, "fr")
        : a.brand_name.localeCompare(b.brand_name, "fr") || a.name.localeCompare(b.name, "fr"));
  }, [products, query, brandFilter, sort]);

  const valid = selected.every((product) =>
    isAllowedQuantity(quantities[product.id], product.min_quantity),
  );
  const allContractual = selected.length > 0 && selected.every((product) => {
    const tier = tierForQuantity(product.pricing.tiers, quantities[product.id]);
    return product.pricing.mode === "contractual" && tier !== null && "price_ht" in tier;
  });

  const priceSummary = useMemo(() => {
    let minCents = 0;
    let maxCents = 0;
    let unpriced = 0;
    let priced = 0;
    for (const product of selected) {
      const quantity = quantities[product.id] ?? 0;
      const tier = tierForQuantity(product.pricing.tiers, quantity);
      const range = priceRangeForTier(tier);
      if (!range) {
        unpriced += 1;
        continue;
      }
      priced += 1;
      minCents += Math.round(range.min * 100) * quantity;
      maxCents += Math.round(range.max * 100) * quantity;
    }
    return { minCents, maxCents, unpriced, priced };
  }, [selected, quantities]);

  const selectedByBrand = useMemo(() => {
    const groups = new Map<string, { brandName: string; items: PrivateMultiBrandProduct[] }>();
    for (const product of selected) {
      const group = groups.get(product.brand_slug) ?? {
        brandName: product.brand_name,
        items: [],
      };
      group.items.push(product);
      groups.set(product.brand_slug, group);
    }
    return [...groups.entries()]
      .map(([slug, group]) => ({ slug, ...group }))
      .sort((a, b) => a.brandName.localeCompare(b.brandName, "fr"));
  }, [selected]);

  const quantityTotal = selected.reduce((sum, product) => sum + (quantities[product.id] ?? 0), 0);
  const maxReferencesReached = selected.length >= 40;
  const priceSummaryTitle = selected.length === 0
    ? "Total estimé HT"
    : allContractual ? "Total HT" : "Estimation HT";
  const priceSummaryValue = selected.length === 0
    ? "—"
    : priceSummary.priced > 0
      ? `${formatPriceRange(priceSummary.minCents / 100, priceSummary.maxCents / 100)} HT${priceSummary.unpriced > 0 ? ` + ${priceSummary.unpriced} référence(s) à chiffrer` : ""}`
      : "À chiffrer";

  const setQuantity = (product: PrivateMultiBrandProduct, next: number) => {
    const safeNext = Number.isFinite(next) ? Math.max(0, Math.min(5000, next)) : 0;
    setQuantities((previous) => ({ ...previous, [product.id]: safeNext }));
  };

  const add = (product: PrivateMultiBrandProduct) => {
    const current = quantities[product.id] ?? 0;
    if (current === 0 && selected.length >= 40) return;
    setQuantity(product, current === 0 ? product.min_quantity : current + 1);
  };

  const subtract = (product: PrivateMultiBrandProduct) => {
    const current = quantities[product.id] ?? 0;
    setQuantity(product, current <= product.min_quantity ? 0 : current - 1);
  };

  return (
    <form action={action} className="space-y-5 pb-24 lg:pb-0">
      <div className="grid gap-3 rounded-xl border border-[#e2e7ec] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px_150px] sm:p-4">
        <label className="flex items-center gap-3 rounded-lg border border-[#e2e7ec] bg-[#faf9f6] px-3">
          <Search size={18} className="shrink-0 text-[#69717d]" aria-hidden="true" />
          <span className="sr-only">Rechercher un produit, EAN ou référence</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Produit, marque, EAN, référence…"
            className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#69717d]" />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[#e2e7ec] bg-[#faf9f6] px-3">
          <span className="sr-only">Filtrer par marque</span>
          <select className="min-h-11 w-full bg-transparent text-xs font-bold outline-none"
            value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
            <option value="all">Toutes les marques</option>
            {brandOptions.map((brand) => <option key={brand.slug} value={brand.slug}>{brand.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[#e2e7ec] bg-[#faf9f6] px-3">
          <SlidersHorizontal size={16} className="shrink-0 text-[#69717d]" aria-hidden="true" />
          <span className="sr-only">Trier les produits</span>
          <select className="min-h-11 w-full bg-transparent text-xs font-bold outline-none"
            value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="brand">Par marque</option>
            <option value="name">Nom A–Z</option>
          </select>
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-[#e7c8b4] bg-[#fff5ee] p-3 text-xs font-semibold text-[#884c2b]">{state.error}</p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#69717d]">
            <p className="font-semibold">{visible.length} références affichées · {selected.length} sélectionnées · 40 maximum</p>
            <p>Tarifs HT · Minimum par référence</p>
          </div>

          <div id="liste-produits" className="space-y-2">
            {visible.map((product) => {
              const quantity = quantities[product.id] ?? 0;
              const referenceQuantity = quantity || product.min_quantity;
              const tier = tierForQuantity(product.pricing.tiers, referenceQuantity);
              const nextTier = nextTierForQuantity(product.pricing.tiers, referenceQuantity);
              const nextRange = priceRangeForTier(nextTier);
              const price = product.pricing.mode === "contractual" && tier && "price_ht" in tier
                ? euroHT(tier.price_ht) + " HT / unité"
                : indicativeRange(tier && "price_min_ht" in tier ? tier : null);
              const invalid = quantity > 0 && !isAllowedQuantity(quantity, product.min_quantity);

              return (
                <article key={product.id}
                  className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-xl border border-[#e2e7ec] bg-white p-3 transition hover:border-[#cbd5d6] sm:grid-cols-[minmax(0,1fr)_165px_145px] sm:items-center sm:gap-4 sm:p-4">
                  <div className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f4f0e7]">
                      {product.image_url ? (
                        <Image src={product.image_url} width={112} height={112} unoptimized alt={product.name}
                          className="h-full w-full object-contain p-1.5" />
                      ) : <Package size={25} strokeWidth={1.2} className="text-[#a9b0b3]" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#ad4b08]">{product.brand_name}</p>
                      <h3 className="mt-0.5 text-sm font-extrabold leading-5 text-[#0e1d31]">{product.name}</h3>
                      <p className="mt-1 text-[11px] leading-4 text-[#69717d]">{product.format || "Format non renseigné"} · Réf. {product.sku}</p>
                      <p className="text-[10px] text-[#89939b]">
                        {product.ean ? "EAN " + product.ean + " · " : ""}Minimum {product.min_quantity} u. · TVA {product.vat_rate} %
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 self-center">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a8790]">
                      {product.pricing.mode === "contractual" ? "Votre tarif HT" : "Prix indicatif HT"}
                    </p>
                    <p className="mt-1 text-sm font-black leading-5 text-[#0e1d31]">{price}</p>
                    {tier ? (
                      <p className="mt-0.5 text-[10px] text-[#69717d]">Palier dès {tier.min_quantity} unité{tier.min_quantity > 1 ? "s" : ""}</p>
                    ) : <p className="mt-0.5 text-[10px] text-[#69717d]">Tarif à confirmer</p>}
                    {quantity > 0 && nextTier ? (
                      <p className="mt-1 text-[10px] font-semibold text-[#ad4b08]">
                        Encore {nextTier.min_quantity - quantity} u. pour le palier {nextTier.min_quantity}
                        {nextRange ? " · " + formatPriceRange(nextRange.min, nextRange.max) + " HT/u." : ""}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    {quantity === 0 ? (
                      <button type="button" onClick={() => add(product)} disabled={maxReferencesReached}
                        className="shop-primary-action inline-flex min-h-10 w-full items-center justify-center gap-2 px-3 text-xs sm:w-auto sm:min-w-[124px] disabled:cursor-not-allowed disabled:opacity-40">
                        <Plus size={15} aria-hidden="true" /> {maxReferencesReached ? "Limite atteinte" : "Ajouter"}
                        {!maxReferencesReached && <span className="font-medium opacity-80">· {product.min_quantity} u.</span>}
                      </button>
                    ) : (
                      <div className="flex min-h-10 items-center overflow-hidden rounded-lg border border-[#dce3ea]">
                        <button type="button" onClick={() => subtract(product)} aria-label={"Diminuer " + product.name}
                          className="flex h-10 w-9 items-center justify-center text-[#162a45] hover:bg-[#fff1e6]"><Minus size={16} /></button>
                        <input type="number" inputMode="numeric" name={"quantity_" + product.id}
                          min={0} max={5000} step={1} value={quantity}
                          aria-label={"Quantité pour " + product.name}
                          onChange={(event) => setQuantity(product, event.target.value === "" ? 0 : Number(event.target.value))}
                          className="h-10 w-14 border-x border-[#e8ecee] text-center text-sm font-extrabold text-[#0e1d31] outline-none" />
                        <button type="button" onClick={() => add(product)} aria-label={"Augmenter " + product.name}
                          disabled={quantity >= 5000}
                          className="flex h-10 w-9 items-center justify-center text-[#162a45] hover:bg-[#fff1e6] disabled:opacity-30"><Plus size={16} /></button>
                      </div>
                    )}
                    {quantity === 0 ? <input type="hidden" name={"quantity_" + product.id} value="0" /> : null}
                  </div>

                  {invalid ? (
                    <p role="alert" className="col-span-2 text-[11px] font-bold text-red-700 sm:col-span-3">
                      {!Number.isSafeInteger(quantity)
                        ? "Saisissez un nombre entier."
                        : quantity < product.min_quantity
                          ? `Minimum de commande : ${product.min_quantity} unités.`
                          : "Maximum : 5 000 unités par référence."}
                    </p>
                  ) : null}
                </article>
              );
            })}

            {selected.filter((product) => !visible.some((item) => item.id === product.id)).map((product) => (
              <input key={product.id} type="hidden" name={"quantity_" + product.id} value={quantities[product.id]} />
            ))}
          </div>

          {!visible.length ? (
            <div className="rounded-xl border border-dashed border-[#dce3ea] bg-white px-5 py-12 text-center">
              <Package size={30} className="mx-auto text-[#b4b8b7]" aria-hidden="true" />
              <p className="mt-3 text-sm font-extrabold">Aucune référence trouvée.</p>
              <button type="button" onClick={() => { setQuery(""); setBrandFilter("all"); }}
                className="mt-3 text-xs font-semibold underline">Afficher toutes les références</button>
            </div>
          ) : null}

          {!products.length ? <p className="rounded-lg bg-white p-6 text-sm">Aucune référence disponible pour le moment.</p> : null}
        </div>

        <aside id="panier" aria-label="Panier multimarque" className="scroll-mt-6 overflow-hidden rounded-xl border border-[#e2e7ec] bg-white shadow-[0_16px_35px_-25px_rgba(20,52,40,.3)] lg:sticky lg:top-6">
          <div className="flex items-center gap-3 bg-[#0e1d31] px-5 py-5 text-white">
            <ShoppingBag size={23} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black">Mon panier</h2>
              <p className="text-xs text-[#d5dde7]">{selected.length} référence{selected.length > 1 ? "s" : ""} · {quantityTotal} unité{quantityTotal > 1 ? "s" : ""} · {selectedByBrand.length} marque{selectedByBrand.length > 1 ? "s" : ""}</p>
            </div>
            {selected.length ? (
              <button type="button" onClick={() => setQuantities({})}
                className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Vider le panier">
                <Trash2 size={18} />
              </button>
            ) : null}
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {selected.length ? (
              <div className="max-h-[55vh] space-y-4 overflow-auto">
                {selectedByBrand.map((group) => {
                  const firm = group.items.every((product) => {
                    const tier = tierForQuantity(product.pricing.tiers, quantities[product.id]);
                    return product.pricing.mode === "contractual" && tier !== null && "price_ht" in tier;
                  });
                  return (
                    <section key={group.slug} className="space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-[#e2e7ec] pb-2">
                        <h3 className="text-xs font-extrabold text-[#0e1d31]">{group.brandName}</h3>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-[#ad4b08]">
                          {firm ? "Commande à confirmer" : "Conditions à confirmer"}
                        </span>
                      </div>
                      {group.items.map((product) => {
                        const quantity = quantities[product.id];
                        const tier = tierForQuantity(product.pricing.tiers, quantity);
                        const range = priceRangeForTier(tier);
                        return (
                          <div key={product.id} className="border-b border-[#f0f1f1] pb-2 text-xs last:border-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-[#0e1d31]">{product.name}</p>
                                <p className="mt-1 text-[#69717d]">{quantity} unité{quantity > 1 ? "s" : ""} · Réf. {product.sku}</p>
                                <p className="mt-1 text-[10px] text-[#69717d]">
                                  {range ? formatPriceRange(range.min, range.max) + " HT / unité" : "Tarif à confirmer"}
                                </p>
                              </div>
                              <strong className="shrink-0 text-right">
                                {range ? formatPriceRange(range.min * quantity, range.max * quantity) + " HT" : "Sur devis"}
                              </strong>
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <ShoppingCart size={31} strokeWidth={1.5} className="text-[#b4b8b7]" aria-hidden="true" />
                <p className="text-sm font-bold text-[#69717d]">Votre panier est vide.</p>
                <p className="text-xs text-[#69717d]">Ajoutez des références de plusieurs marques sans quitter cette page.</p>
              </div>
            )}

            <div className="flex items-start justify-between gap-2 border-t border-[#e2e7ec] pt-4">
              <div>
                <p className="text-xs text-[#69717d]">{priceSummaryTitle}</p>
                <p className="mt-1 text-xl font-black text-[#0e1d31]" aria-live="polite">{priceSummaryValue}</p>
              </div>
              <span className="rounded-full bg-[#fff1e6] px-2.5 py-1 text-[10px] font-bold text-[#162a45]">B2B</span>
            </div>

            <button type="submit" disabled={pending || !selected.length || !valid}
              className="shop-primary-action inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm">
              {pending ? "Transmission en cours…" : "Transmettre mes demandes"}
              {!pending && <ShoppingBag size={17} aria-hidden="true" />}
            </button>
            <p className="text-[11px] leading-5 text-[#69717d]">
              Une demande distincte sera créée pour chaque marque. Les prix indicatifs et disponibilités seront confirmés avant validation définitive.
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dce3ea] bg-white/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-20px_rgba(14,29,49,.35)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-extrabold text-[#0e1d31]">
              {selected.length} réf. · {quantityTotal} unité{quantityTotal > 1 ? "s" : ""}
            </p>
            <p className="truncate text-[11px] text-[#69717d]">{priceSummaryValue}</p>
          </div>
          <a href="#panier" className="shrink-0 px-2 py-2 text-xs font-bold text-[#0e1d31] underline underline-offset-4">Panier</a>
          <button type="submit" disabled={pending || !selected.length || !valid}
            aria-label="Transmettre mes demandes"
            className="shop-primary-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-xs">
            {pending ? "Envoi…" : "Transmettre"}
            {!pending && <ShoppingBag size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </form>
  );
}
