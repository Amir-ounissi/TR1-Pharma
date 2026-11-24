"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { setDemoCartItemAction } from "@/app/catalogue/demo/actions";
import { demoMoney, unitPriceForDemo, type DemoTier } from "@/lib/demo-display";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending}
    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#142941] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#243f5c] disabled:cursor-not-allowed disabled:bg-[#c5cbd1]">
    <ShoppingBag size={17} aria-hidden="true" />
    {pending ? "Ajout en cours…" : "Ajouter au panier test"}
  </button>;
}
export function DemoQuantityForm({
  productId, basePrice, tiers, minQty, qtyStep, variant = "card",
}: {
  productId: string; basePrice: number | string;
  tiers: DemoTier[]; minQty: number; qtyStep: number;
  variant?: "card" | "detail";
}) {
  const [raw, setRaw] = useState(String(minQty));
  const parsed = Number(raw);
  const valid = raw.trim() !== "" && Number.isInteger(parsed)
    && parsed >= minQty && parsed <= 500 && (parsed - minQty) % qtyStep === 0;
  const qty = valid ? parsed : minQty;
  const price = unitPriceForDemo(basePrice, tiers, qty);
  const increment = (direction: number) => {
    const current = valid ? parsed : minQty;
    setRaw(String(Math.min(500, Math.max(minQty, current + direction * qtyStep))));
  };
  return <form action={setDemoCartItemAction} className={variant === "detail" ? "space-y-5" : "space-y-3"}>
    <input type="hidden" name="product_id" value={productId} />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <label htmlFor={`qty-${productId}`} className="mb-1.5 block text-xs font-semibold text-[#4e5d6b]">
          Quantité · pas de {qtyStep}
        </label>
        <div className="flex items-stretch overflow-hidden rounded-lg border border-[#d5dce1] bg-white">
          <button type="button" aria-label="Diminuer la quantité" onClick={() => increment(-1)}
            disabled={qty <= minQty}
            className="flex h-10 w-10 items-center justify-center border-r text-[#142941] hover:bg-[#f0f3f4] disabled:text-[#aeb5bc]">
            <Minus size={15}/></button>
          <input id={`qty-${productId}`} name="quantity" type="number" required
            min={minQty} max={500} step={qtyStep} value={raw}
            onChange={e => setRaw(e.target.value)}
            className="h-10 w-14 [appearance:textfield] bg-white text-center text-sm font-bold text-[#142941] outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/>
          <button type="button" aria-label="Augmenter la quantité" onClick={() => increment(1)}
            disabled={qty + qtyStep > 500}
            className="flex h-10 w-10 items-center justify-center border-l text-[#142941] hover:bg-[#f0f3f4] disabled:text-[#aeb5bc]">
            <Plus size={15}/></button>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[11px] text-[#69717d]">Prix fictif / unité HT</p>
        <p className="text-lg font-bold tabular-nums text-[#142941]">{demoMoney(price)}</p>
      </div>
    </div>
    {variant === "detail" ? <div className="flex items-center justify-between rounded-lg bg-[#eff3f5] px-4 py-3">
      <span className="text-sm text-[#4e5d6b]">Total panier simulé HT</span>
      <strong className="text-xl tabular-nums text-[#142941]">{demoMoney(price * qty)}</strong>
    </div> : <p className="text-right text-xs font-medium tabular-nums text-[#64727e]">
      Sous-total : {demoMoney(price * qty)} HT
    </p>}
    {!valid && <p className="text-xs text-[#a0450a]" role="alert">
      Choisir {minQty} unités minimum, par multiples de {qtyStep}.
    </p>}
    <SubmitButton disabled={!valid} />
  </form>;
}
