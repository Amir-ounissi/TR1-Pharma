/** Barème VK SWISS : implantation rétroactive + rémunération par boîte vendue. */
export const VK_SWISS_TERMS = {
  implantationBase: 300,
  implantationAt10: 400,
  implantationAt20: 500,
  boxesCommission: 2,
} as const;

export type VkSwissCommissionOrder = {
  id: string;
  orderDate: string;
  orderNumber: string | null;
  pharmacyId: string;
  pharmacyName: string;
  status: string;
  orderType: string;
  isInitial: boolean;
  isReorder: boolean;
  paidQuantity: number;
};

export type VkSwissCommissionLine = VkSwissCommissionOrder & {
  classification: "implantation" | "reassort";
  implantationCommission: number;
  boxesCommission: number;
  total: number;
  isInvoiced: boolean;
};

const approvedStatuses = new Set(["confirmed", "invoiced", "partially_delivered", "delivered"]);
const invoicedStatuses = new Set(["invoiced", "partially_delivered", "delivered"]);

export function vkSwissImplantationRate(count: number) {
  return count >= 20 ? VK_SWISS_TERMS.implantationAt20
    : count >= 10 ? VK_SWISS_TERMS.implantationAt10
      : VK_SWISS_TERMS.implantationBase;
}

function orderClassification(order: VkSwissCommissionOrder) {
  if (order.isInitial || order.orderType === "initial") return "implantation" as const;
  if (order.isReorder || order.orderType === "reorder") return "reassort" as const;
  return null;
}

/**
 * Les statuts pending/draft/rejected/cancelled/refunded et les commandes non qualifiées
 * ne produisent jamais de commission. Les UG ne sont pas des boîtes payantes.
 * Les paliers sont calculés sur les implantations uniques depuis le début des données.
 */
export function calculateVkSwissCommissions(
  orders: VkSwissCommissionOrder[],
  month: string,
) {
  const start = `${month}-01`;
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const end = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
  const chronological = [...orders]
    .filter((order) => order.orderDate.slice(0, 10) < end)
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.id.localeCompare(b.id));
  const approved = chronological.filter(
    (order) => approvedStatuses.has(order.status) && orderClassification(order) !== null,
  );

  const implantations = new Set<string>();
  const historicalImplantations = new Set<string>();
  const firstImplantationOrders = new Set<string>();
  for (const order of approved) {
    if (orderClassification(order) !== "implantation") continue;
    if (order.orderDate.slice(0, 10) < start) historicalImplantations.add(order.pharmacyId);
    if (!implantations.has(order.pharmacyId)) {
      implantations.add(order.pharmacyId);
      firstImplantationOrders.add(order.id);
    }
  }
  const rate = vkSwissImplantationRate(implantations.size);
  const previousRate = vkSwissImplantationRate(historicalImplantations.size);
  const lines: VkSwissCommissionLine[] = approved
    .filter((order) => order.orderDate.slice(0, 10) >= start)
    .map((order) => {
      const classification = orderClassification(order)!;
      const implantationCommission = firstImplantationOrders.has(order.id) ? rate : 0;
      const boxesCommission = Math.max(0, Math.trunc(order.paidQuantity)) * VK_SWISS_TERMS.boxesCommission;
      return {
        ...order, classification, implantationCommission, boxesCommission,
        total: implantationCommission + boxesCommission,
        isInvoiced: invoicedStatuses.has(order.status),
      };
    }).sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  // Ajustement rétroactif lié aux implantations réalisées les mois précédents.
  const retroactiveAdjustment = historicalImplantations.size * (rate - previousRate);
  const totalLines = lines.reduce((sum, line) => sum + line.total, 0);
  const facturedLines = lines.filter((line) => line.isInvoiced);
  const pendingQualification = chronological.filter((order) =>
    !approvedStatuses.has(order.status) || orderClassification(order) === null,
  ).filter((order) =>
    order.orderDate.slice(0, 10) >= start &&
    ["draft", "pending", "needs_correction", "confirmed"].includes(order.status),
  );

  return {
    lines,
    rate,
    previousRate,
    implantationsTotal: implantations.size,
    implantationsThisMonth: lines.filter((line) => line.implantationCommission > 0).length,
    boxesThisMonth: lines.reduce((sum, line) => sum + Math.max(0, Math.trunc(line.paidQuantity)), 0),
    retroactiveAdjustment,
    estimatedTotal: totalLines + retroactiveAdjustment,
    invoicedTotal: facturedLines.reduce((sum, line) => sum + line.total, 0),
    confirmedNotInvoicedTotal: lines.filter((line) => !line.isInvoiced).reduce((sum, line) => sum + line.total, 0),
    pendingQualification,
  };
}
