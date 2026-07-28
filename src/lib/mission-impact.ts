export type MissionObservationMaturity = "early" | "30d_complete" | "60d_complete" | "mature";
export type MissionEffectivenessStatus =
  | "strong_positive"
  | "positive"
  | "neutral"
  | "weak"
  | "no_observable_result"
  | "insufficient_data";
export type MissionImpactDataQuality = "complete" | "partial" | "insufficient";

export type MissionEffectivenessInput = {
  daysObserved: number;
  revenueBefore: number;
  revenueAfter30: number;
  ordersAfter30: number;
  ordersAfter60: number;
  reorderAfter30: boolean;
  reorderAfter60: boolean;
};

export const missionEffectivenessLabels: Record<MissionEffectivenessStatus, string> = {
  strong_positive: "Signal positif fort",
  positive: "Signal positif",
  neutral: "Stable",
  weak: "Signal faible",
  no_observable_result: "Aucun résultat observé",
  insufficient_data: "Données encore insuffisantes",
};

export const missionMaturityLabels: Record<MissionObservationMaturity, string> = {
  early: "Résultat provisoire",
  "30d_complete": "Fenêtre J+30 complète",
  "60d_complete": "Fenêtre J+60 complète",
  mature: "Fenêtre J+90 complète",
};

export const missionDataQualityLabels: Record<MissionImpactDataQuality, string> = {
  complete: "Données complètes",
  partial: "Données partielles",
  insufficient: "Données insuffisantes",
};

export function observationMaturity(daysObserved: number): MissionObservationMaturity {
  if (daysObserved < 30) return "early";
  if (daysObserved < 60) return "30d_complete";
  if (daysObserved < 90) return "60d_complete";
  return "mature";
}

export function missionEffectiveness(input: MissionEffectivenessInput): MissionEffectivenessStatus {
  if (input.daysObserved < 30) return "insufficient_data";
  const revenueChange = input.revenueBefore > 0
    ? (input.revenueAfter30 - input.revenueBefore) / input.revenueBefore
    : null;
  if (input.reorderAfter30 || (revenueChange !== null && revenueChange > 0.2)) return "strong_positive";
  if (input.reorderAfter60 || input.ordersAfter60 > 0 || (revenueChange !== null && revenueChange > 0.05)) {
    return "positive";
  }
  if (revenueChange !== null && Math.abs(revenueChange) <= 0.05) return "neutral";
  if (input.daysObserved >= 60 && input.ordersAfter60 === 0 && input.revenueAfter30 === 0) {
    return "no_observable_result";
  }
  return "weak";
}

export function safeRatio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

export function observedRevenueChange(revenueBefore: number, revenueAfter: number, daysObserved: number) {
  if (daysObserved < 30 || revenueBefore <= 0) return null;
  return (revenueAfter - revenueBefore) / revenueBefore;
}

export function classifyFirstOrder(ordersBefore: number, firstOrderAfter: string | null) {
  if (!firstOrderAfter) return "none" as const;
  return ordersBefore === 0 ? "first_order" as const : "reorder" as const;
}

export function missionImpactQuality(input: {
  totalCost: number;
  hasReport: boolean;
  missionType: string;
  unitsSold: number | null;
  overlappingMissions: boolean;
}) {
  if (input.totalCost <= 0 && !input.hasReport && input.unitsSold === null) return "insufficient" as const;
  if (
    input.totalCost <= 0
    || !input.hasReport
    || (input.missionType === "animation" && input.unitsSold === null)
    || input.overlappingMissions
  ) return "partial" as const;
  return "complete" as const;
}

export function shouldRecommendFollowup(daysObserved: number, followupDays: number, hasLaterInteraction: boolean) {
  return daysObserved > followupDays && !hasLaterInteraction;
}
