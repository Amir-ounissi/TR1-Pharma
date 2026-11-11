/** Pure, browser-safe display and validation helpers. */
export function euroHT(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

export function isAllowedQuantity(quantity: number, minimum: number, step: number) {
  return Number.isSafeInteger(quantity) && quantity >= minimum && quantity <= 5000
    && Number.isSafeInteger(minimum) && minimum > 0
    && Number.isSafeInteger(step) && step > 0
    && (quantity - minimum) % step === 0;
}

export function sumOrderCents(lines: { price_ht: number; quantity: number }[]) {
  return lines.reduce((sum, line) => sum + Math.round(line.price_ht * 100) * line.quantity, 0);
}
