const presentationLabels = {
  strategic: "Stratégique",
  high: "Élevée",
  urgent: "Urgente",
  normal: "Normale",
  low: "Faible",
  active: "Active",
  targeted: "Ciblée",
  qualified: "Qualifiée",
  contacted: "Contactée",
  appointment_scheduled: "Rendez-vous planifié",
  offer_sent: "Offre envoyée",
  pending_order: "Commande attendue",
  implanted: "Implantée",
  to_develop: "À développer",
  dormant: "Dormante",
  lost: "Perdue",
  very_high: "Très fort potentiel",
  medium: "Potentiel moyen",
  unknown: "Potentiel à qualifier",
  call: "Appel",
  email: "E-mail",
  visit: "Visite",
  appointment: "Rendez-vous",
  send_offer: "Envoi d’offre",
  follow_up: "Relance",
  qualify: "Qualification",
  update_contact: "Mise à jour contact",
  check_stock: "Contrôle du stock",
  request_order: "Demande de commande",
  internal_review: "Revue interne",
  commercial_visit: "Visite commerciale",
  prospecting_visit: "Visite de prospection",
  relationship_visit: "Visite relationnelle",
  report_pending: "Compte rendu attendu",
  needs_correction: "Correction demandée",
  draft: "Brouillon",
  completed: "Terminée",
  interested: "Intéressée",
  no_answer: "Sans réponse",
  callback_requested: "Rappel demandé",
  information_sent: "Informations envoyées",
  appointment_booked: "Rendez-vous pris",
  offer_requested: "Offre demandée",
  order_expected: "Commande attendue",
  decision_pending: "Décision en attente",
  not_interested: "Non intéressée",
  other: "Autre",
  interaction: "Interaction",
  task: "Tâche",
  interaction_with_next_action: "Interaction avec prochaine action",
  newly_implanted: "Nouvellement implantée",
  awaiting_first_reorder: "Premier réassort attendu",
  reorder_expected: "Réassort à venir",
  reorder_due_soon: "Réassort bientôt attendu",
  reorder_overdue: "Réassort en retard",
  healthy: "Suivi sain",
  at_risk: "À risque",
  insufficient_history: "Historique insuffisant",
  strong_growth: "Forte croissance",
  growth: "Croissance",
  stable: "Stable",
  decline: "Baisse",
  strong_decline: "Forte baisse",
  insufficient_data: "Données insuffisantes",
} as const;

export type PresentationValue = keyof typeof presentationLabels;

export function presentationLabel(value?: string | null) {
  if (!value) return "Non renseigné";
  return presentationLabels[value as PresentationValue] ?? value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function presentationText(value: string) {
  return value
    .replace(/Suite\s*:\s*Compte rendu visit/gi, "Suite — compte rendu de visite")
    .replace(/\bvisit\b/gi, "visite")
    .replaceAll("_", " ");
}

export type ActionTiming = {
  kind: "today" | "tomorrow" | "future" | "overdue" | "unscheduled";
  label: string;
  dateLabel: string | null;
  dayDelta: number | null;
};

function calendarDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function formatActionTiming(value?: string | Date | null, now = new Date()): ActionTiming {
  if (!value) return { kind: "unscheduled", label: "Date à définir", dateLabel: null, dayDelta: null };
  const target = value instanceof Date ? value : new Date(value);
  const dateLabel = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(target);
  const dayDelta = Math.round((calendarDay(target) - calendarDay(now)) / 86_400_000);
  if (dayDelta === 0) return { kind: "today", label: "Aujourd’hui", dateLabel, dayDelta };
  if (dayDelta === 1) return { kind: "tomorrow", label: "Demain", dateLabel, dayDelta };
  if (dayDelta > 1) return { kind: "future", label: `Dans ${dayDelta} jours`, dateLabel, dayDelta };
  const overdueDays = Math.abs(dayDelta);
  return { kind: "overdue", label: `En retard de ${overdueDays} jour${overdueDays > 1 ? "s" : ""}`, dateLabel, dayDelta };
}

export function formatActionSummary(actionType?: string | null, value?: string | Date | null, now = new Date()) {
  const timing = formatActionTiming(value, now);
  return `${presentationLabel(actionType)} · ${timing.label}`;
}
