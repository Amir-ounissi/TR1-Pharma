"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import { Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import { sendPrivateCatalogueRequest } from "@/app/catalogue/actions";
import type { CatalogProduct } from "@/lib/private-catalogue";
import { euroHT, indicativeRange, isAllowedQuantity, tierForQuantity } from "@/lib/private-catalogue-format";

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

  const valid = selected.every((p) => isAllowedQuantity(quantities[p.id], p.min_quantity, p.quantity_step));
  const allContractual = selected.length > 0 && selected.every((p) =>
    p.pricing.mode === "contractual" && tierForQuantity(p.pricing.tiers, quantities[p.id]) !== null,
  );
  const totalCents = allContractual ? selected.reduce((sum, p) => {
    if (p.pricing.mode !== "contractual") return sum;
    return sum + Math.round((tierForQuantity(p.pricing.tiers, quantities[p.id])?.price_ht ?? 0) * 100) * quantities[p.id];
  }, 0) : null;
  const quantityTotal = selected.reduce((sum, p) => sum + quantities[p.id], 0);

  const setQuantity = (product: CatalogProduct, next: number) => {
    setQuantities((previous) => ({ ...previous, [product.id]: Math.max(0, Math.min(5000, next)) }));
  };
  const add = (p: CatalogProduct) => {
    const current = quantities[p.id] ?? 0;
    if (current === 0) setQuantity(p, p.min_quantity);
    else if (current + p.quantity_step <= 5000) setQuantity(p, current + p.quantity_step);
  };
  const subtract = (p: CatalogProduct) => {
    const current = quantities[p.id] ?? 0;
    setQuantity(p, current <= p.min_quantity ? 0 : current - p.quantity_step);
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-3 rounded-2xl border border-[#e2e8e5] bg-white p-4 sm:grid-cols-[1fr_190px]">
        <label className="flex items-center gap-3 rounded-xl border border-[#dfe5e2] bg-[#f9faf9] px-3">
          <Search size={18} className="shrink-0 text-[#809087]" aria-hidden="true" />
          <span className="sr-only">Rechercher un produit, EAN ou référence</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Produit, EAN, référence…" className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#8a9692]" />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-[#dfe5e2] bg-[#f9faf9] px-3">
          <SlidersHorizontal size={17} className="text-[#809087]" aria-hidden="true" />
          <span className="sr-only">Trier les produits</span>
          <select className="min-h-11 w-full bg-transparent text-xs font-bold outline-none"
            value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="name">Nom A–Z</option>
            <option value="sku">Référence</option>
          </select>
        </label>
      </div>

      <a href="#panier" className="flex items-center justify-between rounded-xl bg-[#173d3b] px-4 py-3 text-sm font-extrabold text-white lg:hidden">
        <span className="inline-flex items-center gap-2"><ShoppingBag size={17} aria-hidden="true" /> Voir mon panier</span>
        <span>{selected.length} référence{selected.length > 1 ? "s" : ""} · {quantityTotal} u.</span>
      </a>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#77877f]">
            <p className="font-semibold">{visible.length} produit{visible.length > 1 ? "s" : ""}</p>
            <p>Prix HT · Minimum et paliers par référence</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((p) => {
              const qty = quantities[p.id] ?? 0;
              const stepQty = qty || p.min_quantity;
              const indicativeTier = p.pricing.mode === "indicative" ? tierForQuantity(p.pricing.tiers, stepQty) : null;
              const contractualTier = p.pricing.mode === "contractual" ? tierForQuantity(p.pricing.tiers, stepQty) : null;
              const price = p.pricing.mode === "contractual"
                ? contractualTier ? euroHT(contractualTier.price_ht) : "Tarif sur demande"
                : indicativeRange(indicativeTier);
              const selectedInvalid = qty > 0 && !isAllowedQuantity(qty, p.min_quantity, p.quantity_step);

              return (
                <article key={p.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e0e7e2] bg-white transition hover:border-[#c5d5cb] hover:shadow-md">
                  <div className="relative flex h-47 items-center justify-center overflow-hidden bg-[#eef2ec] sm:h-52">
                    {p.image_url ? (
                      <Image src={p.image_url} width={440} height={440} unoptimized alt={p.name}
                        className="h-full w-full object-contain p-5" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-[#b3c1b6]">
                        <Package size={49} strokeWidth={1.1} aria-hidden="true" />
                        <span className="text-[11px] font-semibold">Visuel produit à venir</span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#456352]">
                      {p.pricing.mode === "contractual" ? "Votre tarif" : "Prix indicatif"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ab7049]">{brandName}</p>
                      <h3 className="mt-1 text-lg font-black leading-6 text-[#183b36]">{p.name}</h3>
                      <p className="mt-1.5 text-[11px] text-[#89958e]">{p.format || "Complément alimentaire"} · Réf. {p.sku}</p>
                    </div>
                    {p.description ? <p className="line-clamp-2 text-xs leading-5 text-[#687e74]">{p.description}</p> : null}
                    <div className="mt-auto border-t border-[#e9eeea] pt-3">
                      <p className="text-[11px] font-bold text-[#7e8d86]">
                        {p.pricing.mode === "contractual" ? "Votre prix unitaire" : "Fourchette HT / unité"}
                      </p>
                      <p className="mt-1 text-[19px] font-black tracking-tight text-[#183b36]">{price}</p>
                      <p className="mt-1 text-[11px] text-[#7d8d85]">
                        {p.pricing.mode === "contractual"
                          ? "Conditions convenues avec votre officine"
                          : "Le tarif définitif est confirmé sur devis"}
                      </p>
                    </div>

                    {p.pricing.tiers.length > 0 ? (
                      <details className="rounded-lg bg-[#f3f6f3] px-3 py-2.5">
                        <summary className="cursor-pointer text-xs font-extrabold text-[#356051]">Voir les paliers par volume</summary>
                        <div className="mt-3 space-y-2 border-t border-[#dfe8e1] pt-3">
                          {p.pricing.tiers.map((tier) => (
                            <div key={tier.min_quantity} className="flex items-start justify-between gap-2 text-[11px]">
                              <span>Dès {tier.min_quantity} u.</span>
                              <strong className="text-right">
                                {p.pricing.mode === "contractual"
                                  ? "price_ht" in tier ? euroHT(tier.price_ht) : "Sur demande"
                                  : indicativeRange("price_min_ht" in tier ? tier : null)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <p className="text-[11px] text-[#798b80]">Minimum {p.min_quantity} u. · Pas de {p.quantity_step} · TVA {p.vat_rate} %</p>
                    <div className="flex items-center gap-2">
                      {qty === 0 ? (
                        <button type="button" onClick={() => add(p)}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#173d3b] px-3 text-sm font-extrabold text-white hover:bg-[#2a5852]">
                          <Plus size={17} aria-hidden="true" /> Ajouter au panier
                        </button>
                      ) : (
                        <div className="flex min-h-11 w-full items-center justify-between overflow-hidden rounded-lg border border-[#c9d9cc]">
                          <button type="button" onClick={() => subtract(p)} aria-label={"Diminuer " + p.name}
                            className="flex h-11 w-11 items-center justify-center text-[#25483e] hover:bg-[#edf4ec]"><Minus size={17} /></button>
                          <span className="text-xs font-bold">{qty} u.</span>
                          <button type="button" onClick={() => add(p)} aria-label={"Augmenter " + p.name}
                            disabled={qty + p.quantity_step > 5000}
                            className="flex h-11 w-11 items-center justify-center text-[#25483e] hover:bg-[#edf4ec]"><Plus size={17} /></button>
                        </div>
                      )}
                    </div>
                    <label className="flex items-center justify-between gap-2 text-[11px] text-[#7b8880]">
                      <span>Quantité personnalisée</span>
                      <input type="number" inputMode="numeric" name={"quantity_" + p.id}
                        min={0} max={5000} step={1} value={qty}
                        onChange={(event) => setQuantity(p, event.target.value === "" ? 0 : Number(event.target.value))}
                        className="w-20 rounded-md border border-[#d1ded5] px-2 py-1.5 text-right text-xs font-bold text-[#1c3930]" />
                    </label>
                    {selectedInvalid ? <p role="alert" className="text-xs font-bold text-red-700">Respectez le minimum et le pas de commande.</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
          {!visible.length ? (
            <div className="rounded-2xl border border-dashed border-[#d1ddd4] bg-white px-5 py-12 text-center">
              <Package size={30} className="mx-auto text-[#a4b4a9]" aria-hidden="true" />
              <p className="mt-3 text-sm font-extrabold">Aucune référence trouvée.</p>
              <button type="button" onClick={() => setQuery("")} className="mt-3 text-xs font-semibold underline">Effacer la recherche</button>
            </div>
          ) : null}
          {!products.length ? <p className="rounded-xl bg-white p-6 text-sm">Aucune référence disponible pour le moment.</p> : null}
        </div>

        <aside id="panier" aria-label="Mon panier" className="scroll-mt-6 overflow-hidden rounded-2xl border border-[#dce6de] bg-white shadow-[0_16px_35px_-25px_rgba(20,52,40,.3)] lg:sticky lg:top-6">
          <div className="flex items-center gap-3 bg-[#173d3b] px-5 py-5 text-white">
            <ShoppingBag size={23} aria-hidden="true" />
            <div className="flex-1">
              <h2 className="text-lg font-black">Mon panier</h2>
              <p className="text-xs text-[#c9d9cf]">{selected.length} référence{selected.length > 1 ? "s" : ""} · {quantityTotal} unité{quantityTotal > 1 ? "s" : ""}</p>
            </div>
            {selected.length ? <button type="button" onClick={() => setQuantities({})}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Vider le panier"><Trash2 size={18} /></button> : null}
          </div>
          <div className="space-y-4 p-5">
            {selected.length ? (
              <div className="max-h-78 space-y-3 overflow-auto">
                {selected.map((p) => {
                  const tier = p.pricing.mode === "contractual" ? tierForQuantity(p.pricing.tiers, quantities[p.id]) : null;
                  return (
                    <div key={p.id} className="flex items-start justify-between gap-3 border-b border-[#e7ece8] pb-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-[#183b36]">{p.name}</p>
                        <p className="mt-1 text-[#8a968e]">{quantities[p.id]} unités</p>
                      </div>
                      <strong className="shrink-0 text-right">
                        {tier ? euroHT(Math.round(tier.price_ht * 100) * quantities[p.id] / 100) : "Sur devis"}
                      </strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <ShoppingCart size={31} strokeWidth={1.5} className="text-[#bac9bd]" aria-hidden="true" />
                <p className="text-sm font-bold text-[#667e70]">Votre panier est vide.</p>
                <p className="text-xs text-[#89998e]">Ajoutez des produits pour préparer votre demande.</p>
              </div>
            )}
            <div className="flex items-start justify-between gap-2 border-t border-[#e6ece8] pt-4">
              <div>
                <p className="text-xs text-[#7c8f82]">{allContractual ? "Total estimé HT" : "Montant à confirmer"}</p>
                <p className="mt-1 text-xl font-black text-[#183b36]">
                  {totalCents !== null ? euroHT(totalCents / 100) : "Sur devis"}
                </p>
              </div>
              <span className="rounded-full bg-[#e6f0e7] px-2.5 py-1 text-[10px] font-bold text-[#386347]">B2B</span>
            </div>
            {state.error ? <p role="alert" className="rounded-lg bg-[#fff0e4] p-3 text-xs font-semibold text-[#884c2b]">{state.error}</p> : null}
            <button type="submit" disabled={pending || !selected.length || !valid}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e9a773] px-4 text-sm font-black text-[#16342f] transition hover:bg-[#f4bb8c] disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "Envoi en cours…" : allContractual ? "Envoyer ma commande" : "Demander mon devis"}
              {!pending && <ShoppingBag size={17} aria-hidden="true" />}
            </button>
            <p className="text-[11px] leading-5 text-[#7b8a81]">
              {allContractual
                ? "Votre demande de commande sera vérifiée avant confirmation définitive."
                : "Vous recevrez vos conditions commerciales personnalisées après examen de la demande."}
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
