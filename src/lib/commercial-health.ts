export type CommercialHealthStatus =
  | "newly_implanted"
  | "awaiting_first_reorder"
  | "reorder_expected"
  | "reorder_due_soon"
  | "reorder_overdue"
  | "healthy"
  | "at_risk"
  | "dormant"
  | "insufficient_history";

export type RevenueTrend =
  | "strong_growth"
  | "growth"
  | "stable"
  | "decline"
  | "strong_decline"
  | "insufficient_data";

export type CommercialHealthRow = {
  brand_pharmacy_id: string;
  brand_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  city: string;
  territory_name: string | null;
  agent_name: string | null;
  commercial_status: string;
  priority_level: string;
  potential_level: string;
  first_order_at: string | null;
  last_order_at: string | null;
  first_reorder_at: string | null;
  orders_count: number;
  reorder_count: number;
  days_to_first_reorder: number | null;
  days_since_last_order: number | null;
  average_reorder_interval_days: number | null;
  median_reorder_interval_days: number | null;
  expected_interval_days: number;
  expected_reorder_at: string | null;
  expected_reorder_delay_days: number | null;
  revenue_last_90d: number;
  revenue_previous_90d: number;
  revenue_trend: RevenueTrend;
  revenue_trend_percent: number | null;
  has_next_action: boolean;
  next_action_at: string | null;
  last_interaction_at: string | null;
  last_mission_at: string | null;
  health_status: CommercialHealthStatus;
  priority_score: number;
  priority_reasons: string[];
  recommendation: string;
};

export type CommercialHealthRules = {
  defaultReorderIntervalDays: number;
  firstReorderTargetDays: number;
  reorderDueSoonDays: number;
  atRiskMultiplier: number;
  dormantMultiplier: number;
};

export const defaultCommercialHealthRules: CommercialHealthRules = {
  defaultReorderIntervalDays: 60,
  firstReorderTargetDays: 60,
  reorderDueSoonDays: 7,
  atRiskMultiplier: 1.35,
  dormantMultiplier: 2,
};

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function representativeReorderInterval(intervals: number[], fallbackDays: number) {
  const valid = intervals.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return { days: fallbackDays, source: "brand_fallback" as const };
  if (valid.length >= 3) return { days: Math.round(median(valid)), source: "median" as const };
  return {
    days: Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length),
    source: "average" as const,
  };
}

export function resolveCommercialHealthStatus(input: {
  ordersCount: number;
  daysSinceFirstOrder: number | null;
  daysSinceLastOrder: number | null;
  expectedIntervalDays: number;
  rules?: CommercialHealthRules;
}) {
  const rules = input.rules ?? defaultCommercialHealthRules;
  if (input.ordersCount === 0 || input.daysSinceLastOrder === null) return "insufficient_history" as const;
  if (input.ordersCount === 1) {
    const elapsed = input.daysSinceFirstOrder ?? 0;
    if (elapsed <= rules.reorderDueSoonDays) return "newly_implanted" as const;
    if (elapsed < rules.firstReorderTargetDays - rules.reorderDueSoonDays) return "awaiting_first_reorder" as const;
    if (elapsed <= rules.firstReorderTargetDays) return "reorder_due_soon" as const;
    if (elapsed > rules.firstReorderTargetDays * rules.dormantMultiplier) return "dormant" as const;
    if (elapsed > rules.firstReorderTargetDays * rules.atRiskMultiplier) return "at_risk" as const;
    return "reorder_overdue" as const;
  }
  if (input.daysSinceLastOrder > input.expectedIntervalDays * rules.dormantMultiplier) return "dormant" as const;
  if (input.daysSinceLastOrder > input.expectedIntervalDays * rules.atRiskMultiplier) return "at_risk" as const;
  if (input.daysSinceLastOrder > input.expectedIntervalDays) return "reorder_overdue" as const;
  if (input.daysSinceLastOrder >= input.expectedIntervalDays - rules.reorderDueSoonDays) return "reorder_due_soon" as const;
  return input.ordersCount >= 4 ? "healthy" as const : "reorder_expected" as const;
}

export function revenueTrend(current: number, previous: number): { status: RevenueTrend; changePercent: number | null } {
  if (previous <= 0) {
    return current > 0
      ? { status: "insufficient_data", changePercent: null }
      : { status: "insufficient_data", changePercent: null };
  }
  const changePercent = Math.round(((current - previous) / previous) * 1000) / 10;
  if (changePercent > 20) return { status: "strong_growth", changePercent };
  if (changePercent > 5) return { status: "growth", changePercent };
  if (changePercent >= -5) return { status: "stable", changePercent };
  if (changePercent >= -20) return { status: "decline", changePercent };
  return { status: "strong_decline", changePercent };
}

export function commercialPriority(input: {
  status: CommercialHealthStatus;
  hasNextAction: boolean;
  priorityLevel: string;
  potentialLevel: string;
  revenueTrend: RevenueTrend;
  recentMissionWithoutFollowUp?: boolean;
  expectedDelayDays?: number;
}) {
  const reasons: string[] = [];
  let score = 0;
  if (input.status === "dormant") {
    score += 40;
    reasons.push("Compte dormant à réactiver");
  } else if (input.status === "at_risk") {
    score += 35;
    reasons.push("Fréquence de commande fortement dégradée");
  } else if (input.status === "reorder_overdue") {
    score += 30;
    reasons.push(`Réassort en retard${input.expectedDelayDays ? ` de ${input.expectedDelayDays} jours` : ""}`);
  } else if (input.status === "awaiting_first_reorder" || input.status === "reorder_due_soon") {
    score += 25;
    reasons.push(input.status === "awaiting_first_reorder" ? "Premier réassort à sécuriser" : "Réassort bientôt attendu");
  }
  if (!input.hasNextAction) {
    score += 20;
    reasons.push("Aucun suivi programmé");
  }
  if (input.priorityLevel === "strategic") {
    score += 15;
    reasons.push("Compte stratégique");
  }
  if (input.potentialLevel === "high" || input.potentialLevel === "very_high") {
    score += 15;
    reasons.push("Fort potentiel commercial");
  }
  if (input.revenueTrend === "decline" || input.revenueTrend === "strong_decline") {
    score += 10;
    reasons.push("Chiffre d’affaires en baisse");
  }
  if (input.recentMissionWithoutFollowUp) {
    score += 10;
    reasons.push("Mission récente sans suivi commercial");
  }
  return { score: Math.min(100, score), reasons };
}

export function commercialRecommendation(status: CommercialHealthStatus, hasNextAction: boolean) {
  if (status === "dormant") return "Évaluer une réactivation";
  if (status === "at_risk" || status === "reorder_overdue") return "Contacter la pharmacie";
  if (status === "awaiting_first_reorder" || status === "newly_implanted") return "Sécuriser le premier réassort";
  if (status === "reorder_due_soon" || status === "reorder_expected") return "Préparer une relance";
  if (!hasNextAction) return "Programmer une prochaine action";
  return "Maintenir le suivi";
}

export function buildReorderFollowUp(input: {
  pharmacyName: string;
  recommendation: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + 1);
  dueAt.setHours(9, 0, 0, 0);
  return {
    taskType: "call" as const,
    priority: "high" as const,
    title: `Relance réassort — ${input.pharmacyName}`,
    description: input.recommendation,
    dueAt: dueAt.toISOString(),
  };
}
