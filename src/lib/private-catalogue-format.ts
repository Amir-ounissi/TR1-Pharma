/** Helpers de presentation et controle, partageables avec les composants clients. */
export function euroHT(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

/** Pas de commande par défaut, modifiable par référence dans l'administration. */
export const DEFAULT_QUANTITY_STEP = 6;

/** Premier colisage autorisé : au moins le minimum, arrondi au multiple du pas. */
export function firstOrderQuantity(minimum: number, step = DEFAULT_QUANTITY_STEP) {
  if (!Number.isSafeInteger(minimum) || minimum < 1 ||
      !Number.isSafeInteger(step) || step < 1) return 0;
  const quantity = Math.ceil(minimum / step) * step;
  return quantity <= 5000 ? quantity : 0;
}

/** Chaque quantité commandée doit être un multiple entier du pas configuré. */
export function isAllowedQuantity(quantity: number, minimum: number, step = DEFAULT_QUANTITY_STEP) {
  return Number.isSafeInteger(quantity) && quantity >= minimum && quantity <= 5000
    && Number.isSafeInteger(minimum) && minimum > 0
    && Number.isSafeInteger(step) && step > 0
    && quantity % step === 0;
}

/** Un clic ajoute/retire le pas configuré, sans proposer un colisage invalide. */
export function steppedOrderQuantity(
  current: number,
  minimum: number,
  step: number,
  direction: 1 | -1,
) {
  const first = firstOrderQuantity(minimum, step);
  if (!first) return 0;
  if (current <= 0) return direction === 1 ? first : 0;
  // Valeur héritée d'un ancien panier ou saisie libre : revenir d'abord
  // au multiple autorisé le plus proche, dans le sens du bouton.
  if (current % step !== 0 || current < first) {
    if (direction === 1) {
      const next = Math.max(first, Math.ceil(current / step) * step);
      return next <= 5000 ? next : current;
    }
    const previous = Math.floor(current / step) * step;
    return previous >= first ? previous : 0;
  }
  if (direction === -1 && current <= first) return 0;
  const next = current + direction * step;
  if (direction === 1 && next > 5000) return current;
  return next < first ? 0 : next;
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

/**
 * Économie HT à quantité constante par rapport au premier palier de la
 * même référence. Un barème indicatif en fourchette ne permet pas
 * d'afficher une économie chiffrée fiable.
 * Retourne null si la comparaison n'est pas fiable.
 */
export function tierSavingsCents(
  tiers: readonly (IndicativeTier | ContractTier)[],
  applied: IndicativeTier | ContractTier | null,
  quantity: number,
): number | null {
  if (!applied || !Number.isSafeInteger(quantity) || quantity < 1 || tiers.length === 0) return null;

  const first = tiers.reduce<(IndicativeTier | ContractTier) | null>(
    (lowest, tier) => !lowest || tier.min_quantity < lowest.min_quantity ? tier : lowest,
    null,
  );
  if (!first) return null;

  const fixedPriceCents = (tier: IndicativeTier | ContractTier): number | null => {
    if ("price_ht" in tier) return Number.isFinite(Number(tier.price_ht)) ? Math.round(Number(tier.price_ht) * 100) : null;
    const min = Number(tier.price_min_ht);
    const max = Number(tier.price_max_ht);
    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.round(min * 100) !== Math.round(max * 100)) return null;
    return Math.round(min * 100);
  };
  const baseline = fixedPriceCents(first);
  const actual = fixedPriceCents(applied);
  if (baseline === null || actual === null || actual > baseline || baseline < 0 || actual < 0) return null;
  return (baseline - actual) * quantity;
}

/**
 * Gain sur le volume FUTUR à prix inchangé vs le tarif qui s'appliquerait
 * à ce même volume au prochain palier. N'intègre jamais les unités ajoutées
 * comme une économie, ni des fourchettes de prix non fiables.
 */
export function nextTierDiscountCents(
  lines: readonly {
    tiers: readonly (IndicativeTier | ContractTier)[];
    quantity: number;
    addedQuantity: number;
  }[],
  currentVolume: number,
  futureVolume: number,
): number | null {
  if (!Number.isSafeInteger(currentVolume) || currentVolume < 1
    || !Number.isSafeInteger(futureVolume) || futureVolume <= currentVolume
    || lines.length === 0) return null;

  const cents = (tier: IndicativeTier | ContractTier): number | null => {
    const min = "price_ht" in tier ? Number(tier.price_ht) : Number(tier.price_min_ht);
    const max = "price_ht" in tier ? Number(tier.price_ht) : Number(tier.price_max_ht);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0
      || Math.round(min * 100) !== Math.round(max * 100)) return null;
    return Math.round(min * 100);
  };
  let gain = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1
      || !Number.isSafeInteger(line.addedQuantity) || line.addedQuantity < 0) return null;
    const current = tierForQuantity(line.tiers, currentVolume);
    const future = tierForQuantity(line.tiers, futureVolume);
    if (!current || !future) return null;
    const currentCents = cents(current);
    const futureCents = cents(future);
    if (currentCents === null || futureCents === null || futureCents > currentCents) return null;
    gain += (currentCents - futureCents) * (line.quantity + line.addedQuantity);
  }
  return gain > 0 ? gain : null;
}

/**
 * Atteint le premier total collectif autorisé à partir d'un volume cible.
 * Le fournisseur peut imposer un multiple au TOTAL (ex : Biodance 4),
 * sans imposer ce même multiple à chaque référence.
 * Respecte tout de même le pas individuel de l'admin si celui-ci est configuré.
 */
export function collectiveTierTopUp(
  currentTotal: number,
  targetTotal: number,
  multiple: number,
  currentLine: number,
  lineMinimum: number,
  lineStep: number,
): { additional: number; total: number } | null {
  if (![currentTotal, targetTotal, multiple, currentLine, lineMinimum, lineStep]
    .every(Number.isSafeInteger)
    || currentTotal < 0 || targetTotal <= currentTotal
    || multiple < 1 || currentLine < 1 || lineMinimum < 1 || lineStep < 1) return null;
  const first = Math.ceil(Math.max(currentTotal + 1, targetTotal) / multiple) * multiple;
  for (let total = first; total - currentTotal + currentLine <= 5000; total += multiple) {
    const nextLine = currentLine + total - currentTotal;
    if (isAllowedQuantity(nextLine, lineMinimum, lineStep)) {
      return { additional: total - currentTotal, total };
    }
  }
  return null;
}
