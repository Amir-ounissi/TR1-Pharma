export const commercialStatuses = [
  "targeted", "qualified", "contacted", "appointment_scheduled", "offer_sent",
  "pending_order", "implanted", "active", "to_develop", "dormant", "lost",
] as const;

export const activityStatuses = ["never_ordered", "active", "watch", "at_risk", "dormant", "lost"] as const;
export const priorityLevels = ["low", "normal", "high", "strategic"] as const;
export const potentialLevels = ["unknown", "low", "medium", "high", "very_high"] as const;
export const pharmacySources = [
  "tr1_prospecting", "brand_existing_client", "agent", "referral", "groupement",
  "event", "inbound", "import", "other",
] as const;

export const labels = {
  commercialStatus: {
    targeted: "Ciblée", qualified: "Qualifiée", contacted: "Contactée",
    appointment_scheduled: "Rendez-vous planifié", offer_sent: "Offre envoyée",
    pending_order: "Commande attendue", implanted: "Implantée", active: "Active",
    to_develop: "À développer", dormant: "Dormante", lost: "Perdue",
  },
  activityStatus: {
    never_ordered: "Jamais commandé", active: "Active", watch: "À surveiller",
    at_risk: "À risque", dormant: "Dormante", lost: "Perdue",
  },
  priorityLevel: { low: "Basse", normal: "Normale", high: "Haute", strategic: "Stratégique" },
  potentialLevel: { unknown: "Inconnu", low: "Faible", medium: "Moyen", high: "Élevé", very_high: "Très élevé" },
} as const;

export type ImportEntity = "pharmacies" | "contacts" | "brand_pharmacies" | "products" | "orders";
export type ImportStrategy = "create_only" | "update_only" | "upsert" | "skip_duplicates";

export function formatCurrency(value: number | string | null, currency = "EUR") {
  if (value === null || value === "") return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(value));
}
