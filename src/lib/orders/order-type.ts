export const COUNTED_ORDER_STATUSES = [
  "pending",
  "needs_correction",
  "confirmed",
  "invoiced",
  "partially_delivered",
  "delivered",
] as const;

export function automaticOrderType(hasPriorOrder: boolean): "initial" | "reorder" {
  return hasPriorOrder ? "reorder" : "initial";
}
