export type CommercialOrderTerms = {
  discountRate: number | null;
  freeUnitsRule: { paidQuantity: number; freeQuantity: number; label: string } | null;
};

export function resolveCommercialOrderLine(quantity: number, terms: CommercialOrderTerms) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantité achetée invalide.");
  if (terms.discountRate === null || !Number.isFinite(terms.discountRate) || terms.discountRate < 0 || terms.discountRate > 100) {
    throw new Error("Remise commerciale introuvable ou invalide.");
  }
  const rule = terms.freeUnitsRule;
  if (rule && (!Number.isInteger(rule.paidQuantity) || rule.paidQuantity <= 0 || !Number.isInteger(rule.freeQuantity) || rule.freeQuantity < 0)) {
    throw new Error("Règle d’unités gratuites invalide.");
  }
  return {
    discountRate: terms.discountRate,
    freeQuantity: rule ? Math.floor(quantity / rule.paidQuantity) * rule.freeQuantity : 0,
  };
}
