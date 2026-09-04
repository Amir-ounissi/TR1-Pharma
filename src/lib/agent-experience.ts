export type NavigablePharmacy = {
  latitude?: number | null;
  longitude?: number | null;
  address_line_1?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
};

export type TodayItem = {
  id: string;
  dueAt?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  distanceKm?: number | null;
};

export type NextActionInput = {
  interactionType: string;
  outcome: string;
  commercialStatus: string;
  lastOrderAt?: string | null;
  nextMissionAt?: string | null;
};

const priorityRank = { low: 1, normal: 2, high: 3, urgent: 4 };

function destination(pharmacy: NavigablePharmacy) {
  if (pharmacy.latitude != null && pharmacy.longitude != null) {
    return `${pharmacy.latitude},${pharmacy.longitude}`;
  }
  return [
    pharmacy.address_line_1,
    pharmacy.postal_code,
    pharmacy.city,
    pharmacy.country_code ?? "FR",
  ].filter(Boolean).join(", ");
}

export function buildWazeUrl(pharmacy: NavigablePharmacy) {
  return `https://www.waze.com/ul?ll=${encodeURIComponent(destination(pharmacy))}&navigate=yes`;
}

export function buildGoogleMapsUrl(pharmacy: NavigablePharmacy) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination(pharmacy))}`;
}

export function suggestNextAction(input: NextActionInput) {
  if (input.nextMissionAt) return { type: "visit", delayDays: 0, label: "Préparer la mission planifiée" };
  if (input.outcome === "no_answer" || input.outcome === "callback_requested") {
    return { type: "call", delayDays: 2, label: "Rappeler la pharmacie" };
  }
  if (input.outcome === "offer_requested" || input.outcome === "offer_sent") {
    return { type: "follow_up", delayDays: 3, label: "Relancer l’offre" };
  }
  if (input.outcome === "order_expected") {
    return { type: "request_order", delayDays: 5, label: "Récupérer la commande" };
  }
  if (input.commercialStatus === "dormant") {
    return { type: "visit", delayDays: 7, label: "Planifier une visite de réactivation" };
  }
  if (!input.lastOrderAt && input.interactionType === "visit") {
    return { type: "follow_up", delayDays: 3, label: "Relancer après la visite" };
  }
  return { type: "follow_up", delayDays: 7, label: "Planifier le prochain suivi" };
}

export function sortTodayItems<T extends TodayItem>(items: T[], now = new Date()) {
  return [...items].sort((left, right) => {
    const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const overdueDifference = Number(rightTime < now.getTime()) - Number(leftTime < now.getTime());
    if (overdueDifference) return overdueDifference;
    if (leftTime !== rightTime) return leftTime - rightTime;
    const priorityDifference = priorityRank[right.priority ?? "normal"] - priorityRank[left.priority ?? "normal"];
    if (priorityDifference) return priorityDifference;
    if (left.distanceKm != null && right.distanceKm != null) return left.distanceKm - right.distanceKm;
    return 0;
  });
}

export function hasValidNoNextActionReason(noNextAction: boolean, reason: string) {
  return !noNextAction || reason.trim().length >= 10;
}
