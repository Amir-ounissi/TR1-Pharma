export type NextBestActionType =
  | "reactivate_account"
  | "recover_at_risk"
  | "secure_first_reorder"
  | "recover_reorder"
  | "prepare_reorder"
  | "follow_up_mission"
  | "schedule_follow_up";

export type NextBestActionConfidence = "high" | "medium" | "low";

export type NextBestActionRow = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  city: string | null;
  territory_name: string | null;
  agent_name: string | null;
  action_type: NextBestActionType;
  action_label: string;
  action_score: number;
  confidence: NextBestActionConfidence;
  suggested_due_at: string;
  rationale: string[];
  evidence: Record<string, unknown>;
  has_next_action: boolean;
};

export function nextBestActionConfidenceLabel(value: NextBestActionConfidence) {
  if (value === "high") return "Confiance élevée";
  if (value === "medium") return "Confiance moyenne";
  return "Confiance prudente";
}

export function nextBestActionConfidenceDetail(value: NextBestActionConfidence) {
  if (value === "high") return "Signal directement observable ou cadence suffisamment établie.";
  if (value === "medium") return "Recommandation fondée sur un historique partiel ou une règle marque.";
  return "Recommandation fondée principalement sur une règle marque faute d’historique suffisant.";
}

export function summarizeNextBestActions(rows: NextBestActionRow[], referenceDate = new Date()) {
  const today = referenceDate.toISOString().slice(0, 10);
  return {
    total: rows.length,
    dueNow: rows.filter((row) => row.suggested_due_at <= today).length,
    firstReorders: rows.filter((row) => row.action_type === "secure_first_reorder").length,
    withoutExistingAction: rows.filter((row) => !row.has_next_action).length,
  };
}
