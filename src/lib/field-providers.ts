export const FIELD_PROVIDER_TYPES = [
  "animator",
  "trainer",
  "commercial_agent",
  "merchandiser",
  "auditor",
  "freelancer",
  "agency",
  "other",
] as const;

export const FIELD_PROVIDER_ACTIVITIES = [
  "animation",
  "training",
  "merchandising",
  "audit",
  "commercial",
  "other",
] as const;

export const PROVIDER_CONTRACT_STATUSES = ["pending", "active", "expired", "terminated"] as const;
export const BRAND_PROVIDER_STATUSES = ["active", "paused", "archived"] as const;

export type FieldProviderType = (typeof FIELD_PROVIDER_TYPES)[number];
export type FieldProviderActivity = (typeof FIELD_PROVIDER_ACTIVITIES)[number];
export type ProviderContractStatus = (typeof PROVIDER_CONTRACT_STATUSES)[number];
export type BrandProviderStatus = (typeof BRAND_PROVIDER_STATUSES)[number];

export type BrandProviderPortfolioRow = {
  relation_id: string;
  field_provider_id: string;
  display_name: string;
  email: string;
  phone: string | null;
  provider_type: FieldProviderType;
  relation_status: BrandProviderStatus;
  contract_status: ProviderContractStatus;
  activities: FieldProviderActivity[];
  preferred: boolean;
  priority: number;
  daily_rate_ht: number | null;
  half_day_rate_ht: number | null;
  travel_rate_type: string | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  missions_total: number;
  upcoming_missions: number;
  completed_90d: number;
  cost_90d: number;
  last_mission_at: string | null;
};

export function fieldProviderTypeLabel(type: FieldProviderType) {
  return ({
    animator: "Animateur",
    trainer: "Formateur",
    commercial_agent: "Commercial terrain",
    merchandiser: "Merchandiser",
    auditor: "Auditeur",
    freelancer: "Freelance",
    agency: "Agence",
    other: "Autre",
  } as const)[type];
}

export function fieldProviderActivityLabel(activity: FieldProviderActivity) {
  return ({
    animation: "Animation",
    training: "Formation",
    merchandising: "Merchandising",
    audit: "Audit",
    commercial: "Commercial",
    other: "Autre",
  } as const)[activity];
}

export function providerContractStatusLabel(status: ProviderContractStatus) {
  return ({ pending: "À contractualiser", active: "Actif", expired: "Expiré", terminated: "Terminé" } as const)[status];
}

export function brandProviderStatusLabel(status: BrandProviderStatus) {
  return ({ active: "Actif", paused: "En pause", archived: "Archivé" } as const)[status];
}

export function summarizeBrandProviderPortfolio(rows: BrandProviderPortfolioRow[]) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.relation_status === "active").length,
    preferred: rows.filter((row) => row.preferred && row.relation_status === "active").length,
    upcomingMissions: rows.reduce((sum, row) => sum + Number(row.upcoming_missions || 0), 0),
    completed90d: rows.reduce((sum, row) => sum + Number(row.completed_90d || 0), 0),
    cost90d: rows.reduce((sum, row) => sum + Number(row.cost_90d || 0), 0),
  };
}

export function providerContractIsCurrent(row: Pick<BrandProviderPortfolioRow, "contract_status" | "valid_from" | "valid_until">, today = new Date()) {
  if (row.contract_status !== "active") return false;
  const day = today.toISOString().slice(0, 10);
  if (row.valid_from && row.valid_from > day) return false;
  if (row.valid_until && row.valid_until < day) return false;
  return true;
}
