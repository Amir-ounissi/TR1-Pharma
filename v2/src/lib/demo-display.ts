/** Client-safe formatting and deterministic pricing for the closed Vitalora demo. */
export type DemoTier = { min_qty: number; price_ht: number | string };
export function demoMoney(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + " €";
}
export function unitPriceForDemo(
  basePrice: number | string, tiers: DemoTier[], qty: number,
) {
  const matching = tiers
    .filter(t => t.min_qty <= qty)
    .sort((a, b) => b.min_qty - a.min_qty)[0];
  return Number(matching?.price_ht ?? basePrice);
}
export function normalizedSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr").trim();
}
