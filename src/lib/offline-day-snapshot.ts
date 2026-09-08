export type OfflineDayTask = {
  id: string;
  brand_pharmacy_id: string;
  title: string;
  task_type: string;
  priority: "low" | "normal" | "high" | "urgent";
  due_at: string | null;
  is_overdue: boolean;
  pharmacy_name: string;
  city: string;
};

export type OfflineDayMission = {
  id: string;
  brand_pharmacy_id: string;
  title: string;
  objective: string;
  scheduled_start_at: string;
  priority: string;
  pharmacy_name: string;
};

export type OfflineDayReport = {
  id: string;
  mission_id: string;
  title: string;
  brand_pharmacy_id: string;
  report_status: string;
};

export type OfflineDayFollowUp = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  last_interaction_at: string | null;
  priority: string;
};

export type OfflineDayData = {
  tasks: OfflineDayTask[];
  missions: OfflineDayMission[];
  reports: OfflineDayReport[];
  follow_ups: OfflineDayFollowUp[];
};

export type OfflineDayNextVisit = {
  brand_pharmacy_id: string;
  pharmacy_id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  priority: string;
  potential: string;
  scheduled_at: string | null;
  objective: string;
  last_interaction_at: string | null;
  last_order_at: string | null;
  next_action_type: string | null;
  next_action_at: string | null;
  primary_contact: { name: string; phone: string | null } | null;
};

export type OfflineDayVisit = {
  id: string;
  brandPharmacyId: string;
  pharmacyId: string;
  pharmacyName: string;
  city: string | null;
  startAt: string;
  endAt: string | null;
  status: string;
};

export type OfflineDayStockAlert = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  product_name: string;
  days_until_rupture: number;
  stock_current: number;
  monthly_average: number;
  last_updated: string;
};

export type OfflineDaySnapshot = {
  version: 1;
  userId: string;
  brandId: string;
  brandName: string;
  businessDate: string;
  dayLabel: string;
  savedAt: string;
  day: OfflineDayData;
  nextVisit: OfflineDayNextVisit | null;
  visits: OfflineDayVisit[];
  stockAlerts: OfflineDayStockAlert[];
};

export type OfflineScope = {
  userId: string;
  brandId: string;
};

const SNAPSHOT_KEY = "tr1:pwa:day-snapshot:v1";
const ACTIVE_SCOPE_KEY = "tr1:pwa:active-scope:v1";

function sameScope(left: OfflineScope, right: OfflineScope) {
  return left.userId === right.userId && left.brandId === right.brandId;
}

function parseScope(value: string | null): OfflineScope | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OfflineScope>;
    if (typeof parsed.userId !== "string" || typeof parsed.brandId !== "string") return null;
    return { userId: parsed.userId, brandId: parsed.brandId };
  } catch {
    return null;
  }
}

function parseSnapshot(value: string | null): OfflineDaySnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OfflineDaySnapshot>;
    if (
      parsed.version !== 1 ||
      typeof parsed.userId !== "string" ||
      typeof parsed.brandId !== "string" ||
      typeof parsed.brandName !== "string" ||
      typeof parsed.businessDate !== "string" ||
      typeof parsed.dayLabel !== "string" ||
      typeof parsed.savedAt !== "string" ||
      !parsed.day ||
      !Array.isArray(parsed.day.tasks) ||
      !Array.isArray(parsed.day.missions) ||
      !Array.isArray(parsed.day.reports) ||
      !Array.isArray(parsed.day.follow_ups) ||
      !Array.isArray(parsed.visits) ||
      !Array.isArray(parsed.stockAlerts)
    ) {
      return null;
    }
    return parsed as OfflineDaySnapshot;
  } catch {
    return null;
  }
}

export function setActiveOfflineScope(storage: Storage, scope: OfflineScope | null) {
  if (!scope) {
    clearOfflineDaySnapshot(storage);
    return;
  }

  const snapshot = parseSnapshot(storage.getItem(SNAPSHOT_KEY));
  if (snapshot && !sameScope(snapshot, scope)) {
    storage.removeItem(SNAPSHOT_KEY);
  }
  storage.setItem(ACTIVE_SCOPE_KEY, JSON.stringify(scope));
}

export function saveOfflineDaySnapshot(storage: Storage, snapshot: OfflineDaySnapshot) {
  try {
    storage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    storage.setItem(ACTIVE_SCOPE_KEY, JSON.stringify({ userId: snapshot.userId, brandId: snapshot.brandId }));
    return true;
  } catch {
    return false;
  }
}

export function loadActiveOfflineDaySnapshot(storage: Storage) {
  const scope = parseScope(storage.getItem(ACTIVE_SCOPE_KEY));
  const snapshot = parseSnapshot(storage.getItem(SNAPSHOT_KEY));
  if (!scope || !snapshot || !sameScope(scope, snapshot)) return null;
  return snapshot;
}

export function clearOfflineDaySnapshot(storage: Storage) {
  storage.removeItem(SNAPSHOT_KEY);
  storage.removeItem(ACTIVE_SCOPE_KEY);
}
