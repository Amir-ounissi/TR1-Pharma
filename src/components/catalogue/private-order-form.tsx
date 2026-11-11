"use client";

import { useActionState } from "react";
import { sendPrivateCatalogueRequest } from "@/app/catalogue/actions";
import type { CatalogProduct } from "@/lib/private-catalogue";
import { euroHT } from "@/lib/private-catalogue-format";

export function PrivateOrderForm({ slug, products }: { slug: string; products: CatalogProduct[] }) {
  const [state, action, pending] = useActionState(sendPrivateCatalogueRequest, { error: "" });
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((p) => (
          <article key={p.id} className="flex flex-col justify-between gap-5 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#ea7015]">{p.sku}</p>
              <h3 className="text-xl font-extrabold tracking-tight">{p.name}</h3>
              {p.description ? <p className="text-sm leading-6 text-[#69717d]">{p.description}</p> : null}
              <p className="text-xs text-[#69717d]">{[p.format, p.ean ? "EAN " + p.ean : ""].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#0e1d31]/10 pt-4">
              <div>
                <p className="text-xl font-black">{euroHT(Number(p.price_ht))} <span className="text-xs font-semibold text-[#69717d]">HT / unité</span></p>
                <p className="mt-1 text-xs text-[#69717d]">Min. {p.min_quantity} · Pas de {p.quantity_step} · TVA {p.vat_rate} %</p>
              </div>
              <div>
                <label htmlFor={"quantity_" + p.id} className="mb-1 block text-xs font-bold">Quantité</label>
                <input type="number" inputMode="numeric" id={"quantity_" + p.id} name={"quantity_" + p.id}
                  min={0} max={5000} step={1} defaultValue={0}
                  className="w-24 rounded-md border border-[#0e1d31]/20 px-3 py-2 text-right font-bold" />
              </div>
            </div>
          </article>
        ))}
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-[#fff1e5] p-4 text-sm font-semibold text-[#803e0d]">{state.error}</p> : null}
      {products.length ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#0e1d31] p-5 text-white">
          <p className="max-w-md text-sm leading-6 text-white/80">Vous transmettez une demande, sans paiement immédiat. Les prix et conditions seront vérifiés avant confirmation.</p>
          <button type="submit" disabled={pending} className="rounded-md bg-[#ea7015] px-6 py-3 font-extrabold text-[#0e1d31] disabled:opacity-60">
            {pending ? "Transmission…" : "Envoyer ma demande"}
          </button>
        </div>
      ) : <p className="rounded-xl bg-white p-6 text-sm">Aucune référence n’est actuellement disponible à la demande.</p>}
    </form>
  );
}
