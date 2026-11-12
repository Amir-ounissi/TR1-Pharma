"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { sendPrivateCatalogueRequest } from "@/app/catalogue/actions";
import type { CatalogProduct } from "@/lib/private-catalogue";
import { euroHT, indicativeRange, isAllowedQuantity, tierForQuantity } from "@/lib/private-catalogue-format";

export function PrivateOrderForm({ slug, products }: { slug: string; products: CatalogProduct[] }) {
  const [state, action, pending] = useActionState(sendPrivateCatalogueRequest, { error: "" });
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const summary = useMemo(() => {
    const selected = products.filter((p) => (quantities[p.id] ?? 0) > 0);
    const valid = selected.every((p) => isAllowedQuantity(
      quantities[p.id], p.min_quantity, p.quantity_step,
    ));
    const exact = selected.length > 0 && selected.every((p) =>
      p.pricing.mode === "contractual" &&
      tierForQuantity(p.pricing.tiers, quantities[p.id]) !== null,
    );
    const total = exact
      ? selected.reduce((sum, p) => {
          if (p.pricing.mode !== "contractual") return sum;
          return sum + (tierForQuantity(p.pricing.tiers, quantities[p.id])?.price_ht ?? 0) * quantities[p.id];
        }, 0)
      : null;
    return { count: selected.length, valid, exact, total };
  }, [products, quantities]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((p) => {
          const qty = quantities[p.id] ?? 0;
          const indicativeTier = p.pricing.mode === "indicative"
            ? tierForQuantity(p.pricing.tiers, qty > 0 ? qty : p.min_quantity) : null;
          const contractualTier = p.pricing.mode === "contractual"
            ? tierForQuantity(p.pricing.tiers, qty > 0 ? qty : p.min_quantity) : null;

          return (
            <article key={p.id} className="flex flex-col justify-between gap-5 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
              <div className="space-y-3">
                <div className="flex h-44 items-center justify-center overflow-hidden rounded-lg bg-[#f3f4f5]">
                  {p.image_url ? (
                    <Image src={p.image_url} alt={p.name} width={560} height={320}
                      unoptimized className="h-full w-full object-contain p-3" />
                  ) : <Package size={42} className="text-[#b0bdc9]" aria-hidden="true" />}
                </div>
                <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-[#ea7015]">{p.sku}</p>
                <h3 className="text-xl font-extrabold tracking-tight">{p.name}</h3>
                {p.description ? <p className="text-sm leading-6 text-[#69717d]">{p.description}</p> : null}
                <p className="text-xs text-[#69717d]">{[p.format, p.ean ? "EAN " + p.ean : ""].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="space-y-3 border-t border-[#0e1d31]/10 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={p.pricing.mode === "contractual"
                    ? "rounded-full bg-[#e8f4ea] px-3 py-1 text-xs font-bold text-[#315a3c]"
                    : "rounded-full bg-[#fff1e5] px-3 py-1 text-xs font-bold text-[#965326]"}>
                    {p.pricing.mode === "contractual" ? "Votre accord pharmacie" : "Fourchette indicative"}
                  </span>
                  <p className="text-xs text-[#69717d]">HT / unité</p>
                </div>

                <p className="text-xl font-black">
                  {p.pricing.mode === "contractual"
                    ? contractualTier ? euroHT(contractualTier.price_ht) : "Tarif à confirmer"
                    : indicativeRange(indicativeTier)}
                </p>
                <p className="text-xs leading-5 text-[#69717d]">
                  {p.pricing.mode === "contractual"
                    ? "Prix exact selon votre accord et le volume sélectionné."
                    : "Estimation non contractuelle. Votre prix définitif sera confirmé par TR1 PHARMA."}
                </p>
                {p.pricing.tiers.length > 0 ? (
                  <div className="rounded-lg bg-[#f6f7f8] p-3">
                    <p className="mb-2 text-xs font-extrabold">Paliers selon les volumes</p>
                    <div className="space-y-1.5">
                      {p.pricing.tiers.map((tier) => (
                        <div key={tier.min_quantity} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-[#637287]">Dès {tier.min_quantity} unités</span>
                          <span className="font-semibold">
                            {p.pricing.mode === "contractual"
                              ? euroHT("price_ht" in tier ? tier.price_ht : 0) + " / u."
                              : indicativeRange("price_min_ht" in tier ? tier : null)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <p className="text-xs text-[#69717d]">Min. {p.min_quantity} · Pas de {p.quantity_step} · TVA {p.vat_rate} %</p>
                  <div>
                    <label htmlFor={"quantity_" + p.id} className="mb-1 block text-xs font-bold">Quantité</label>
                    <input type="number" inputMode="numeric" id={"quantity_" + p.id} name={"quantity_" + p.id}
                      min={0} max={5000} step={1} value={qty}
                      onChange={(event) => setQuantities((previous) => ({
                        ...previous, [p.id]: event.target.value === "" ? 0 : Number(event.target.value),
                      }))}
                      className="w-24 rounded-md border border-[#0e1d31]/20 px-3 py-2 text-right font-bold" />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-[#fff1e5] p-4 text-sm font-semibold text-[#803e0d]">{state.error}</p> : null}
      {products.length ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#0e1d31] p-5 text-white">
          <div className="max-w-lg space-y-1">
            <p className="font-extrabold">{summary.exact && summary.total !== null
              ? "Total estimé : " + euroHT(summary.total) + " HT"
              : "Conditions définitives sur demande"}</p>
            <p className="text-sm leading-6 text-white/75">{summary.exact
              ? "Les prix contractuels sont recalculés côté serveur. La commande sera vérifiée avant confirmation."
              : "TR1 PHARMA reviendra vers vous avec une proposition précise selon votre volume et vos accords."}</p>
          </div>
          <button type="submit" disabled={pending || summary.count === 0 || !summary.valid}
            className="rounded-md bg-[#ea7015] px-6 py-3 font-extrabold text-[#0e1d31] disabled:opacity-60">
            {pending ? "Transmission…" : summary.exact ? "Envoyer ma demande de commande" : "Demander mes conditions"}
          </button>
        </div>
      ) : <p className="rounded-xl bg-white p-6 text-sm">Aucune référence n’est actuellement disponible à la demande.</p>}
    </form>
  );
}
