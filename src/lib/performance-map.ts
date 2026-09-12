import type { NextBestActionType } from "@/lib/next-best-action";

export type PerformanceMapFilterOption = {
  value: string;
  label: string;
};

export type PerformanceMapNextAction = {
  type: NextBestActionType;
  label: string;
  dueAt: string;
};

export type PerformanceMapPharmacy = {
  id: string;
  pharmacyId: string;
  name: string;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  locationPrecision: "exact" | "department" | "missing";
  territoryId: string | null;
  territoryName: string | null;
  agentUserId: string | null;
  agentName: string | null;
  groupName: string | null;
  commercialStatus: string;
  commercialStatusLabel: string;
  priorityLevel: string;
  priorityLevelLabel: string;
  potentialLevel: string;
  potentialLevelLabel: string;
  healthStatus: string;
  healthStatusLabel: string;
  priorityScore: number;
  recommendation: string;
  revenueHt: number;
  implantations: number;
  reorders: number;
  distributionRate: number | null;
  strategicDistributionRate: number | null;
  missionsCompleted: number;
  animationsCompleted: number;
  trainingsCompleted: number;
  sellOutUnits: number;
  openAlerts: number;
  overdueAlerts: number;
  nextBestAction: PerformanceMapNextAction | null;
};

export type PerformanceMapTerritory = {
  id: string;
  name: string;
  departmentCodes: string[];
  objectiveAttainment: number | null;
  objectiveMetricLabel: string | null;
  revenueHt: number;
  pharmacyCount: number;
  activePharmacies: number;
  atRiskAccounts: number;
  openAlerts: number;
};

export type PerformanceMapMetrics = {
  revenueHt: number;
  objectiveAttainment: number | null;
  objectiveComparable: boolean;
  activePharmacies: number;
  implantations: number;
  reorderRate: number | null;
  atRiskAccounts: number;
};

export type PerformanceMapDataset = {
  brandId: string;
  brandName: string;
  from: string;
  to: string;
  lastUpdatedAt: string | null;
  productScopeLabel: string | null;
  metrics: PerformanceMapMetrics;
  pharmacies: PerformanceMapPharmacy[];
  territories: PerformanceMapTerritory[];
};

export type PerformanceMapFilters = {
  territory: string | null;
  agent: string | null;
  group: string | null;
  product: string | null;
  status: string | null;
  potential: string | null;
  priority: string | null;
  q: string;
};

export type PerformanceMapFilterOptions = {
  territories: PerformanceMapFilterOption[];
  agents: PerformanceMapFilterOption[];
  groups: PerformanceMapFilterOption[];
  products: PerformanceMapFilterOption[];
  families: PerformanceMapFilterOption[];
  statuses: PerformanceMapFilterOption[];
  potentials: PerformanceMapFilterOption[];
  priorities: PerformanceMapFilterOption[];
};
