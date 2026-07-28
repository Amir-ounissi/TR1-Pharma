import type { DraftStorage } from "./local-draft";

export const ACTIVE_VISIT_KEY = "tr1:agent:active-visit";

export type ActiveVisit = {
  brandId: string;
  brandPharmacyId: string;
  pharmacyId: string;
  pharmacyName: string;
  objective: string;
  contactName: string;
  contactPhone?: string | null;
  phone?: string | null;
  wazeUrl: string;
  mapsUrl: string;
  startedAt: string;
};

export function createActiveVisit(visit: Omit<ActiveVisit, "startedAt">, now = new Date()): ActiveVisit {
  return { ...visit, startedAt: now.toISOString() };
}

export function saveActiveVisit(storage: DraftStorage, visit: ActiveVisit) {
  storage.setItem(ACTIVE_VISIT_KEY, JSON.stringify(visit));
}

export function loadActiveVisit(storage: DraftStorage): ActiveVisit | null {
  const serialized = storage.getItem(ACTIVE_VISIT_KEY);
  if (!serialized) return null;
  try {
    const visit = JSON.parse(serialized) as ActiveVisit;
    if (!visit.brandPharmacyId || !visit.pharmacyId || !visit.pharmacyName || !visit.startedAt) throw new Error("invalid");
    return visit;
  } catch {
    storage.removeItem(ACTIVE_VISIT_KEY);
    return null;
  }
}

export function clearActiveVisit(storage: DraftStorage) {
  storage.removeItem(ACTIVE_VISIT_KEY);
}

export function formatVisitStart(startedAt: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(startedAt));
}
