"use client";

import { useActionState, useMemo, useState } from "react";
import { CataloguePackshot } from "@/components/catalogue/catalogue-packshot";
import { Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import { sendPrivateCatalogueRequest } from "@/app/catalogue/actions";
import type { CatalogProduct } from "@/lib/private-catalogue";
import { euroHT, indicativeRange, isAllowedQuantity, tierForQuantity, firstOrderQuantity, steppedOrderQuantity, catalogueQuantityPricingLabel } from "@/lib/private-catalogue-format";

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
    return target ? { [target.id]: firstOrderQuantity(target.min_quantity, target.quantity_step) } : {};
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

  const valid = selected.every((p) => isAllowedQuantity(quantities[p.id], p.min_quantity, p.quantity_step));
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
  const maxReferencesReached = selected.length >= 40;
  const priceSummaryTitle = allContractual ? "Total HT" : priceSummary.minCents > 0 ? "Estimation HT" : "Montant à confirmer";
  const priceSummaryValue = selected.length === 0
    ? "—"
    : priceSummary.minCents > 0 || priceSummary.maxCents > 0
      ? `${formatPriceRange(priceSummary.minCents / 100, priceSummary.maxCents / 100)} HT${priceSummary.unpriced > 0 ? ` + ${priceSummary.unpriced} référence(s) à chiffrer` : ""}`
      : "Sur devis";

  const setQuantity = (product: CatalogProduct, next: number) => {
    const safeNext = Number.isFinite(next) ? Math.max(0, Math.min(5000, next)) : 0;
    setQuantities((previous) => ({ ...previous, [product.id]: safeNext }));
  };
  const add = (p: CatalogProduct) => {
    const current = quantities[p.id] ?? 0;
    if (current === 0 && selected.length >= 40) return;
    setQuantity(p, steppedOrderQuantity(current, p.min_quantity, p.quantity_step, 1));
  };
  const subtract = (p: CatalogProduct) => {
    const current = quantities[p.id] ?? 0;
    setQuantity(p, steppedOrderQuantity(current, p.min_quantity, p.quantity_step, -1));
  };

  return (
    <form action={action} className="space-y-5 pb-24 lg:pb-0">
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

      {state.error ? <p role="alert" className="rounded-lg border border-[#e7c8b4] bg-[#fff5ee] p-3 text-xs font-semibold text-[#884c2b]">{state.error}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#69717d]">
            <p className="font-semibold">{visible.length} produit{visible.length > 1 ? "s" : ""} · 40 références maximum par demande</p>
            <p>Tarifs HT · Minimums et paliers par référence</p>
          </div>
          <div id="liste-produits" className="space-y-2">
            {visible.map((p) => {
              const qty = quantities[p.id] ?? 0;
              const stepQty = qty || firstOrderQuantity(p.min_quantity, p.quantity_step);
              const activeTier = findTierForQuantity(p.pricing.tiers, stepQty);
              const nextTier = nextTierForQuantity(p.pricing.tiers, stepQty);
              const nextTierPrice = priceRangeForTier(nextTier);
              const price = p.pricing.mode === "contractual"
                ? activeTier && "price_ht" in activeTier ? euroHT(activeTier.price_ht) + " HT / unité" : "Tarif sur demande"
                : indicativeRange(activeTier && "price_min_ht" in activeTier ? activeTier : null);
              const selectedInvalid = qty > 0 && !isAllowedQuantity(qty, p.min_quantity, p.quantity_step);
              const quantityPricingLabel = catalogueQuantityPricingLabel(
                p.min_quantity, p.quantity_step, activeTier?.min_quantity ?? null,
              );

              return (
                <article key={p.id}
                  className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-xl border border-[#e2e7ec] bg-white p-3 transition hover:border-[#cbd5d6] sm:grid-cols-[minmax(0,1fr)_170px_150px] sm:items-center sm:gap-4 sm:p-4">
                  <div className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                    <CataloguePackshot src={p.image_url} alt={brandName + " " + p.name} variant="list" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#ad4b08]">{brandName}</p>
                      <h3 className="mt-0.5 text-sm font-extrabold leading-5 text-[#0e1d31] sm:text-[15px]">{p.name}</h3>
                      <p className="mt-1 text-[11px] leading-4 text-[#69717d]">
                        {p.format || "Format non renseigné"} · Réf. {p.sku}
                      </p>
                      <p className="text-[10px] text-[#89939b]">
                        {p.ean ? "EAN " + p.ean + " · " : ""}TVA {p.vat_rate} %
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 self-center">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a8790]">
                      {p.pricing.mode === "contractual" ? "Votre tarif HT" : "Prix indicatif HT"}
                    </p>
                    <p className="mt-1 text-sm font-black leading-5 text-[#0e1d31]">{price}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#69717d]">{quantityPricingLabel}</p>
                    {qty > 0 && nextTier ? (
                      <p className="mt-1 text-[10px] font-semibold text-[#ad4b08]">
                        {nextTier.min_quantity - qty > 0
                          ? `Encore ${nextTier.min_quantity - qty} u. pour le palier ${nextTier.min_quantity}${nextTierPrice ? " · " + formatPriceRange(nextTierPrice.min, nextTierPrice.max) + " HT/u." : ""}`
                          : `Palier ${nextTier.min_quantity}`}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    {qty === 0 ? (
                      <button type="button" onClick={() => add(p)} disabled={maxReferencesReached}
                        className="shop-primary-action inline-flex min-h-10 w-full items-center justify-center gap-2 px-3 text-xs sm:w-auto sm:min-w-[128px] disabled:cursor-not-allowed disabled:opacity-40">
                        <Plus size={15} aria-hidden="true" /> {maxReferencesReached ? "Limite atteinte" : "Ajouter"}
                        {!maxReferencesReached && <span className="font-medium opacity-80">· {firstOrderQuantity(p.min_quantity, p.quantity_step)} u.</span>}
                      </button>
                    ) : (
                      <div className="flex min-h-10 items-center overflow-hidden rounded-lg border border-[#dce3ea]">
                        <button type="button" onClick={() => subtract(p)} aria-label={"Diminuer " + p.name}
                          className="flex h-10 w-9 items-center justify-center text-[#162a45] hover:bg-[#fff1e6]"><Minus size={16} /></button>
                        <input type="number" inputMode="numeric" name={"quantity_" + p.id}
                          min={0} max={5000} step={p.quantity_step} value={qty}
                          aria-label={"Quantité pour " + p.name}
                          onChange={(event) => setQuantity(p, event.target.value === "" ? 0 : Number(event.target.value))}
                          className="h-10 w-14 border-x border-[#e8ecee] text-center text-sm font-extrabold text-[#0e1d31] outline-none" />
                        <button type="button" onClick={() => add(p)} aria-label={"Augmenter " + p.name}
                          disabled={qty + p.quantity_step > 5000}
                          className="flex h-10 w-9 items-center justify-center text-[#162a45] hover:bg-[#fff1e6] disabled:opacity-30"><Plus size={16} /></button>
                      </div>
                    )}
                    {qty === 0 ? <input type="hidden" name={"quantity_" + p.id} value="0" /> : null}
                  </div>
                  {selectedInvalid ? (
                    <p role="alert" className="col-span-2 text-[11px] font-bold text-red-700 sm:col-span-3">
                      {!Number.isSafeInteger(qty)
                        ? "Saisissez un nombre entier."
                        : qty < p.min_quantity
                          ? `Minimum de commande : ${p.min_quantity} unités par référence.`
                          : qty > 5000 ? "Maximum : 5 000 unités par référence."
                          : `Quantité par multiples de ${p.quantity_step} unités.`}
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
                <p className="text-xs text-[#69717d]">{priceSummaryTitle}</p>
                <p className="mt-1 text-xl font-black text-[#0e1d31]">{priceSummaryValue}</p>
              </div>
              <span className="rounded-full bg-[#fff1e6] px-2.5 py-1 text-[10px] font-bold text-[#162a45]">B2B</span>
            </div>
            <button type="submit" disabled={pending || !selected.length || !valid}
              className="shop-primary-action inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm">
              {pending ? "Envoi en cours…" : allContractual ? "Envoyer ma demande de commande" : "Demander un devis"}
              {!pending && <ShoppingBag size={17} aria-hidden="true" />}
            </button>
            <p className="text-[11px] leading-5 text-[#69717d]">
              {allContractual
                ? "Votre demande est transmise à TR1 PHARMA. La commande devient définitive après confirmation."
                : "Les prix sont indicatifs. TR1 PHARMA vous confirme les tarifs et la disponibilité avant validation."}
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
            aria-label={allContractual ? "Envoyer ma demande de commande" : "Demander un devis"}
            className="shop-primary-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-xs">
            {pending ? "Envoi…" : allContractual ? "Envoyer" : "Devis"}
            {!pending && <ShoppingBag size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </form>
  );
}
