export type AgentPortfolioBrand = { id: string; name: string };

export type AgentBookedOrder = {
  brand_id: string;
  order_id: string;
  net_amount_ht: number | string | null;
};

export type AgentBrandSales = AgentPortfolioBrand & {
  bookedRevenueHt: number;
  bookedOrders: number;
};

/** Summarize only authorized brand contexts. Never use a global count as an agent's income. */
export function summarizeAgentBrandSales(
  brands: readonly AgentPortfolioBrand[],
  orders: readonly AgentBookedOrder[],
): AgentBrandSales[] {
  const summaries = new Map<string, { bookedRevenueHt: number; ids: Set<string> }>();
  for (const brand of brands) {
    summaries.set(brand.id, { bookedRevenueHt: 0, ids: new Set() });
  }
  for (const order of orders) {
    const summary = summaries.get(order.brand_id);
    if (!summary || summary.ids.has(order.order_id)) continue;
    const amount = Number(order.net_amount_ht ?? 0);
    if (!Number.isFinite(amount)) continue;
    summary.bookedRevenueHt += amount;
    summary.ids.add(order.order_id);
  }
  return brands.map((brand) => {
    const summary = summaries.get(brand.id);
    return {
      ...brand,
      bookedRevenueHt: summary?.bookedRevenueHt ?? 0,
      bookedOrders: summary?.ids.size ?? 0,
    };
  });
}
