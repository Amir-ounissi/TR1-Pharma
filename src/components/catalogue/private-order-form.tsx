"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import { Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import { sendPrivateCatalogueRequest } from "@/app/catalogue/actions";
import type { CatalogProduct } from "@/lib/private-catalogue";
import { euroHT, indicativeRange, isAllowedQuantity, tierForQuantity } from "@/lib/private-catalogue-format";

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
function findTierForQuantity(tiers: readonly ProductTier[], quantity: number): ProductTier | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
  return tiers.reduce<ProductTier | null>(
    (selected, tier) =>
      tier.min_quantity <= quantity && (!selected || tier.min_quantity > selected.min_quantity)
        ? tier : selected,
    null,
  );
}
function nextTierForQuantity(tiers: readonly ProductTier[], quantity: number) {
  return [...tiers].filter((tier) => tier.min_quantity > quantity)
    .sort((a, b) => a.min_quantity - b.min_quantity)[0] ?? null;
}

export function PrivateOrderForm({
  slug, brandName, products, initialProductId,
}: {
  slug: string;
  brandName: string;
  products: CatalogProduct[];
  initialProductId?: string;
}) {
  const [state, action, pending] = useActionState(sendPrivateCatalogueRequest, { error: "" });
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const target = products.find((product) => product.id === initialProductId);
    return target ? { [target.id]: target.min_quantity } : {};
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");

  const selected = useMemo(() => products.filter((p) => (quantities[p.id] ?? 0) > 0), [products, quantities]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return products
      .filter((p) => [p.name, p.sku, p.ean ?? "", p.description].some((v) => v.toLocaleLowerCase("fr").includes(normalized)))
      .sort((a, b) => sort === "sku" ? a.sku.localeCompare(b.sku) : a.name.localeCompare(b.name, "fr"));
  }, [products, query, sort]);

  const valid = selected.every((p) => isAllowedQuantity(quantities[p.id], p.min_quantity));
  const allContractual = selected.length > 0 && selected.every((p) =>
    p.pricing.mode === "contractual" && tierForQuantity(p.pricing.tiers, quantities[p.id]) !== null,
  );
  const priceSummary = useMemo(() => {
    let minCents = 0;
    let maxCents = 0;
    let unpriced = 0;
    for (const product of selected) {
      const quantity = quantities[product.id] ?? 0;
      const tier = findTierForQuantity(product.pricing.tiers, quantity);
      const range = priceRangeForTier(tier);
      if (!range) {
        unpriced += 1;
        continue;
      }
      minCents += Math.round(range.min * 100) * quantity;
      maxCents += Math.round(range.max * 100) * quantity;
    }
    return { minCents, maxCents, unpriced };
  }, [selected, quantities]);
  const quantityTotal = selected.reduce((sum, p) => sum + quantities[p.id], 0);

  const setQuantity = (product: CatalogProduct, next: number) => {
    setQuantities((previous) => ({ ...previous, [product.id]: Math.max(0, Math.min(5000, next)) }));
  };
  const add = (p: CatalogProduct) => {
    const current = quantities[p.id] ?? 0;
    setQuantity(p, current === 0 ? p.min_quantity : current + 1);
  };
  const subtract = (p: CatalogProduct) => {
    const current = quantities[p.id] ?? 0;
    setQuantity(p, current <= p.min_quantity ? 0 : current - 1);
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-3 rounded-lg border border-[#e2e7ec] bg-white p-4 sm:grid-cols-[1fr_190px]">
        <label className="flex items-center gap-3 rounded-md border border-[#e2e7ec] bg-[#faf9f6] px-3">
          <Search size={18} className="shrink-0 text-[#69717d]" aria-hidden="true" />
          <span className="sr-only">Rechercher un produit, EAN ou référence</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Produit, EAN, référence…" className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#69717d]" />
        </label>
        <label className="flex items-center gap-2 rounded-md border border-[#e2e7ec] bg-[#faf9f6] px-3">
          <SlidersHorizontal size={17} className="text-[#69717d]" aria-hidden="true" />
          <span className="sr-only">Trier les produits</span>
          <select className="min-h-11 w-full bg-transparent text-xs font-bold outline-none"
            value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="name">Nom A–Z</option>
            <option value="sku">Référence</option>
          </select>
        </label>
      </div>

      <a href="#panier" className="flex items-center justify-between rounded-md bg-[#0e1d31] px-4 py-3 text-sm font-extrabold text-white lg:hidden">
        <span className="inline-flex items-center gap-2"><ShoppingBag size={17} aria-hidden="true" /> Voir mon panier</span>
        <span>{selected.length} référence{selected.length > 1 ? "s" : ""} · {quantityTotal} u.</span>
      </a>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#69717d]">
            <p className="font-semibold">{visible.length} produit{visible.length > 1 ? "s" : ""}</p>
            <p>Prix HT indicatifs · Paliers dégressifs appliqués automatiquement</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((p) => {
              const qty = quantities[p.id] ?? 0;
              const stepQty = qty || p.min_quantity;
              const indicativeTier = p.pricing.mode === "indicative" ? tierForQuantity(p.pricing.tiers, stepQty) : null;
              const contractualTier = p.pricing.mode === "contractual" ? tierForQuantity(p.pricing.tiers, stepQty) : null;
              const activeTier = p.pricing.mode === "contractual" ? contractualTier : indicativeTier;
              const nextTier = nextTierForQuantity(p.pricing.tiers, stepQty);
              const nextTierPrice = priceRangeForTier(nextTier);
              const price = p.pricing.mode === "contractual"
                ? contractualTier ? euroHT(contractualTier.price_ht) : "Tarif sur demande"
                : indicativeRange(indicativeTier);
              const selectedInvalid = qty > 0 && !isAllowedQuantity(qty, p.min_quantity);

              return (
                <article key={p.id} className="shop-card flex min-w-0 flex-col overflow-hidden transition hover:border-[#dce3ea] hover:shadow-md">
                  <div className="relative flex h-47 items-center justify-center overflow-hidden bg-[#f4f0e7] sm:h-52">
                    {p.image_url ? (
                      <Image src={p.image_url} width={440} height={440} unoptimized alt={p.name}
                        className="h-full w-full object-contain p-5" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-[#b4b8b7]">
                        <Package size={49} strokeWidth={1.1} aria-hidden="true" />
                        <span className="text-[11px] font-semibold">Visuel produit à venir</span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#162a45]">
                      {p.pricing.mode === "contractual" ? "Votre tarif" : "Prix indicatif"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ad4b08]">{brandName}</p>
                      <h3 className="mt-1 text-lg font-black leading-6 text-[#0e1d31]">{p.name}</h3>
                      <p className="mt-1.5 text-[11px] text-[#69717d]">{p.format || "Complément alimentaire"} · Réf. {p.sku}</p>
                    </div>
                    {p.description ? <p className="line-clamp-2 text-xs leading-5 text-[#69717d]">{p.description}</p> : null}
                    <div className="mt-auto border-t border-[#e2e7ec] pt-3">
                      <p className="text-[11px] font-bold text-[#69717d]">
                        {p.pricing.mode === "contractual" ? "Votre prix unitaire" : "Tarif indicatif HT / unité"}
                      </p>
                      <p className="mt-1 text-[19px] font-black tracking-tight text-[#0e1d31]">{price}</p>
                      <p className="mt-1 text-[11px] text-[#69717d]">
                        {p.pricing.mode === "contractual"
                          ? "Conditions convenues avec votre officine"
                          : "Le tarif définitif est confirmé sur devis"}
                      </p>
                    </div>

                    {p.pricing.tiers.length > 0 ? (
                      <details className="rounded-lg bg-[#faf9f6] px-3 py-2.5">
                        <summary className="cursor-pointer text-xs font-extrabold text-[#162a45]">Voir les paliers par volume</summary>
                        <div className="mt-3 space-y-2 border-t border-[#e2e7ec] pt-3">
                          {p.pricing.tiers.map((tier) => {
                            const active = activeTier?.min_quantity === tier.min_quantity;
                            return (
                              <div key={tier.min_quantity}
                                className={`flex items-start justify-between gap-2 rounded-md text-[11px] ${active ? "bg-[#fff1e6] px-2 py-1.5 text-[#162a45]" : ""}`}>
                                <span>
                                  Dès {tier.min_quantity} u.
                                  {active ? <span className="ml-1 font-extrabold text-[#ad4b08]">· Appliqué</span> : null}
                                </span>
                                <strong className="text-right">
                                  {p.pricing.mode === "contractual"
                                    ? "price_ht" in tier ? euroHT(tier.price_ht) : "Sur demande"
                                    : indicativeRange("price_min_ht" in tier ? tier : null)}
                                </strong>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ) : null}

                    <p className="text-[11px] text-[#69717d]">
                      {p.min_quantity > 1 ? `Minimum ${p.min_quantity} unités par référence` : "Commande possible à l'unité"}
                      {p.vat_rate !== null ? ` · TVA ${p.vat_rate} %` : ""}
                    </p>
                    {qty > 0 && !selectedInvalid && nextTier && nextTierPrice ? (
                      <p className="text-[11px] font-semibold text-[#ad4b08]">
                        Encore {nextTier.min_quantity - qty} unité{nextTier.min_quantity - qty > 1 ? "s" : ""} pour atteindre le palier {nextTier.min_quantity} u. ({formatPriceRange(nextTierPrice.min, nextTierPrice.max)} HT / unité).
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      {qty === 0 ? (
                        <button type="button" onClick={() => add(p)}
                          className="shop-primary-action inline-flex min-h-11 flex-1 items-center justify-center gap-2 px-3 text-sm">
                          <Plus size={17} aria-hidden="true" /> Ajouter au panier
                        </button>
                      ) : (
                        <div className="flex min-h-11 w-full items-center justify-between overflow-hidden rounded-lg border border-[#dce3ea]">
                          <button type="button" onClick={() => subtract(p)} aria-label={"Diminuer " + p.name}
                            className="flex h-11 w-11 items-center justify-center text-[#162a45] hover:bg-[#fff1e6]"><Minus size={17} /></button>
                          <span className="text-xs font-bold">{qty} u.</span>
                          <button type="button" onClick={() => add(p)} aria-label={"Augmenter " + p.name}
                            disabled={qty >= 5000}
                            className="flex h-11 w-11 items-center justify-center text-[#162a45] hover:bg-[#fff1e6]"><Plus size={17} /></button>
                        </div>
                      )}
                    </div>
                    <label className="flex items-center justify-between gap-2 text-[11px] text-[#69717d]">
                      <span>Quantité personnalisée</span>
                      <input type="number" inputMode="numeric" name={"quantity_" + p.id}
                        min={0} max={5000} step={1} value={qty}
                        onChange={(event) => setQuantity(p, event.target.value === "" ? 0 : Number(event.target.value))}
                        className="w-20 rounded-md border border-[#dce3ea] px-2 py-1.5 text-right text-xs font-bold text-[#0e1d31]" />
                    </label>
                    {selectedInvalid ? (
                      <p role="alert" className="text-xs font-bold text-red-700">
                        {!Number.isSafeInteger(qty)
                          ? "Saisissez un nombre entier."
                          : qty < p.min_quantity
                            ? `Minimum de commande : ${p.min_quantity} unités par référence.`
                            : "Maximum : 5 000 unités par référence."}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          {!visible.length ? (
            <div className="rounded-lg border border-dashed border-[#dce3ea] bg-white px-5 py-12 text-center">
              <Package size={30} className="mx-auto text-[#b4b8b7]" aria-hidden="true" />
              <p className="mt-3 text-sm font-extrabold">Aucune référence trouvée.</p>
              <button type="button" onClick={() => setQuery("")} className="mt-3 text-xs font-semibold underline">Effacer la recherche</button>
            </div>
          ) : null}
          {!products.length ? <p className="rounded-md bg-white p-6 text-sm">Aucune référence disponible pour le moment.</p> : null}
        </div>

        <aside id="panier" aria-label="Mon panier" className="scroll-mt-6 overflow-hidden rounded-lg border border-[#e2e7ec] bg-white shadow-[0_16px_35px_-25px_rgba(20,52,40,.3)] lg:sticky lg:top-6">
          <div className="flex items-center gap-3 bg-[#0e1d31] px-5 py-5 text-white">
            <ShoppingBag size={23} aria-hidden="true" />
            <div className="flex-1">
              <h2 className="text-lg font-black">Mon panier</h2>
              <p className="text-xs text-[#d5dde7]">{selected.length} référence{selected.length > 1 ? "s" : ""} · {quantityTotal} unité{quantityTotal > 1 ? "s" : ""}</p>
            </div>
            {selected.length ? <button type="button" onClick={() => setQuantities({})}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Vider le panier"><Trash2 size={18} /></button> : null}
          </div>
          <div className="space-y-4 p-5">
            {selected.length ? (
              <div className="max-h-78 space-y-3 overflow-auto">
                {selected.map((p) => {
                  const quantity = quantities[p.id];
                  const tier = findTierForQuantity(p.pricing.tiers, quantity);
                  const range = priceRangeForTier(tier);
                  const nextTier = nextTierForQuantity(p.pricing.tiers, quantity);
                  return (
                    <div key={p.id} className="border-b border-[#e2e7ec] pb-3 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-[#0e1d31]">{p.name}</p>
                          <p className="mt-1 text-[#69717d]">{quantity} unité{quantity > 1 ? "s" : ""}</p>
                          {tier ? <p className="mt-1 text-[10px] font-semibold text-[#ad4b08]">Palier appliqué dès {tier.min_quantity} unités</p> : null}
                          <p className="mt-1 text-[10px] text-[#69717d]">
                            {range ? `${formatPriceRange(range.min, range.max)} HT / unité` : "Tarif à confirmer"}
                          </p>
                        </div>
                        <strong className="shrink-0 text-right">
                          {range ? `${formatPriceRange(range.min * quantity, range.max * quantity)} HT` : "Sur devis"}
                        </strong>
                      </div>
                      {nextTier ? (
                        <p className="mt-2 text-[10px] text-[#69717d]">
                          Prochain palier : {nextTier.min_quantity} unités
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <ShoppingCart size={31} strokeWidth={1.5} className="text-[#b4b8b7]" aria-hidden="true" />
                <p className="text-sm font-bold text-[#69717d]">Votre panier est vide.</p>
                <p className="text-xs text-[#69717d]">Ajoutez des produits pour préparer votre demande.</p>
              </div>
            )}
            <div className="flex items-start justify-between gap-2 border-t border-[#e2e7ec] pt-4">
              <div>
                <p className="text-xs text-[#69717d]">
                  {allContractual
                    ? "Total HT"
                    : priceSummary.minCents > 0
                      ? priceSummary.unpriced > 0 ? "Sous-total indicatif HT" : "Estimation indicative HT"
                      : "Montant à confirmer"}
                </p>
                <p className="mt-1 text-xl font-black text-[#0e1d31]">
                  {selected.length === 0
                    ? "—"
                    : priceSummary.minCents > 0 || priceSummary.maxCents > 0
                      ? `${formatPriceRange(priceSummary.minCents / 100, priceSummary.maxCents / 100)} HT${priceSummary.unpriced > 0 ? ` + ${priceSummary.unpriced} référence(s) à chiffrer` : ""}`
                      : "Sur devis"}
                </p>
              </div>
              <span className="rounded-full bg-[#fff1e6] px-2.5 py-1 text-[10px] font-bold text-[#162a45]">B2B</span>
            </div>
            {state.error ? <p role="alert" className="rounded-lg bg-[#fff0e4] p-3 text-xs font-semibold text-[#884c2b]">{state.error}</p> : null}
            <button type="submit" disabled={pending || !selected.length || !valid}
              className="shop-primary-action inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm">
              {pending ? "Envoi en cours…" : allContractual ? "Envoyer ma commande" : "Demander mon devis"}
              {!pending && <ShoppingBag size={17} aria-hidden="true" />}
            </button>
            <p className="text-[11px] leading-5 text-[#69717d]">
              {allContractual
                ? "Votre demande de commande sera vérifiée avant confirmation définitive."
                : "Les prix et paliers affichés sont indicatifs. Les références sans tarif public et le montant définitif seront confirmés avant validation."}
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
