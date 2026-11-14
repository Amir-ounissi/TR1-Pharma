"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart, Plus, ShoppingCart } from "lucide-react";
import { addCatalogueProductToCart, setCatalogueFavorite } from "@/app/catalogue/actions";
import { isAllowedQuantity, firstOrderQuantity } from "@/lib/private-catalogue-format";

const PRESET_QUANTITIES = [6, 12, 18, 24, 48] as const;

/** Achat depuis la fiche sans retour forcé à la liste des produits. */
export function PharmacyProductActions({
  productId,
  name,
  minQuantity,
  quantityStep,
  collectiveMinimum,
  initialFavorite,
}: {
  productId: string;
  name: string;
  minQuantity: number;
  quantityStep: number;
  collectiveMinimum?: number | null;
  initialFavorite: boolean;
}) {
  const first = firstOrderQuantity(minQuantity, quantityStep);
  const [quantity, setQuantity] = useState(first);
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const valid = isAllowedQuantity(quantity, minQuantity, quantityStep);
  const presets = quantityStep === 6
    ? PRESET_QUANTITIES.filter((value) => value >= first)
    : [0, 1, 2, 3, 7].map((n) => first + n * quantityStep)
      .filter((value) => value >= first && value <= 5000);

  const addToCart = () => {
    if (!valid || busy) return;
    setFeedback("");
    startTransition(async () => {
      const result = await addCatalogueProductToCart(productId, quantity);
      setFeedback(result.ok
        ? `${quantity} unité(s) ajoutée(s) au panier sauvegardé.`
        : result.error ?? "Impossible d’ajouter cette référence.");
    });
  };

  const toggleFavorite = () => {
    if (busy) return;
    const next = !favorite;
    startTransition(async () => {
      const result = await setCatalogueFavorite(productId, next);
      if (result.ok) {
        setFavorite(next);
        setFeedback(next ? "Produit enregistré dans vos favoris." : "Produit retiré des favoris.");
      } else setFeedback(result.error ?? "Favori indisponible.");
    });
  };

  return (
    <div className="mt-5 space-y-3 border-t border-white/15 pt-4">
      <p className="text-xs font-extrabold text-white">Quantité à ajouter au panier · {first} unités pré-sélectionnées · pas de {quantityStep}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={"Quantités rapides pour " + name}>
        {presets.map((value) => (
          <button type="button" key={value} onClick={() => { setQuantity(value); setFeedback(""); }}
            aria-pressed={quantity === value}
            className={`min-h-9 min-w-11 rounded-md border px-2 text-xs font-bold transition ${quantity === value ? "border-[#e99055] bg-[#e99055] text-[#142941]" : "border-white/25 text-white hover:bg-white/15"}`}>
            {value}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-xs font-semibold text-[#c1cdd8]">
        Quantité personnalisée
        <input type="number" min={0} max={5000} step={quantityStep} inputMode="numeric"
          value={quantity} onChange={(event) => { setQuantity(Number(event.target.value)); setFeedback(""); }}
          className="min-h-11 w-24 rounded-md border border-white/25 bg-white px-3 text-center text-sm font-extrabold text-[#142941]"/>
      </label>
      {collectiveMinimum ? (
        <p className="text-[11px] text-[#c1cdd8]">
          Minimum {collectiveMinimum} unités sur toute la gamme concernée. Vous pouvez répartir les quantités entre références.
        </p>
      ) : null}
      {!valid ? <p role="alert" className="text-xs font-bold text-[#ffc1ad]">Minimum {minQuantity} unités, par multiples de {quantityStep} (maximum 5 000).</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addToCart} disabled={!valid || busy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#e99055] px-5 text-sm font-extrabold text-[#142941] hover:bg-[#f4a779] disabled:cursor-not-allowed disabled:opacity-50">
          <Plus size={17} aria-hidden="true"/> {busy ? "Enregistrement…" : "Ajouter au panier"}
        </button>
        <button type="button" onClick={toggleFavorite} disabled={busy}
          aria-pressed={favorite} title={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/25 px-3 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50">
          <Heart size={16} fill={favorite ? "currentColor" : "none"} aria-hidden="true"/>
          {favorite ? "Favori enregistré" : "Favoris"}
        </button>
      </div>
      {feedback ? (
        <p role="status" className="text-[11px] font-semibold text-[#c4ebd0]">{feedback}</p>
      ) : null}
      <Link href="/catalogue#panier" className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-white underline underline-offset-4">
        <ShoppingCart size={15} aria-hidden="true"/> Voir mon panier
      </Link>
    </div>
  );
}
