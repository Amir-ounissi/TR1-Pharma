/** Helpers de presentation et controle, partageables avec les composants clients. */
export function euroHT(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

export function isAllowedQuantity(quantity: number, minimum: number, _legacyStep?: number) {
  // Les quantités sont commandables à l'unité après le minimum fournisseur.
  // L'ancien pas de conditionnement reste accepté en argument pour compatibilité,
  // mais ne bloque plus une commande entre deux multiples.
  return Number.isSafeInteger(quantity) && quantity >= minimum && quantity <= 5000
    && Number.isSafeInteger(minimum) && minimum > 0;
}

export function sumOrderCents(lines: { price_ht: number; quantity: number }[]) {
  return lines.reduce((sum, line) => sum + Math.round(line.price_ht * 100) * line.quantity, 0);
}

export type IndicativeTier = { min_quantity: number; price_min_ht: number; price_max_ht: number };
export type ContractTier = { min_quantity: number; price_ht: number };

export function tierForQuantity<T extends { min_quantity: number }>(
  tiers: readonly T[],
  quantity: number,
): T | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
  return tiers.reduce<T | null>(
    (selected, tier) =>
      tier.min_quantity <= quantity && (!selected || tier.min_quantity > selected.min_quantity)
        ? tier : selected,
    null,
  );
}

export function indicativeRange(tier: IndicativeTier | null) {
  if (!tier) return "Tarif sur demande";
  const low = euroHT(Number(tier.price_min_ht));
  const high = euroHT(Number(tier.price_max_ht));
  return low === high ? low + " HT / unité" : low + " – " + high + " HT / unité";
}
