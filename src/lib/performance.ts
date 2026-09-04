import { presentationLabel } from "@/lib/presentation";

export const performanceMetricLabels = {
  revenue_ht: "CA facturé HT",
  booked_revenue_ht: "CA commandé HT",
  implantations: "Implantations",
  reorders: "Réassorts",
  first_reorder_rate: "Taux de premier réassort",
  active_pharmacies: "Pharmacies actives",
  avg_distribution_rate: "Assortiment moyen",
  strategic_distribution_rate: "Assortiment stratégique",
  missions: "Missions",
  animations: "Animations",
  trainings: "Formations",
} as const;

export const performanceViewLabels = {
  overview: "Vue d’ensemble",
  network: "Réseau / Pharmacies",
  missions: "Missions",
  team: "Équipe",
} as const;

export const missionTypeLabels: Record<string, string> = {
  animation: "Animation",
  training: "Formation",
  merchandising: "Merchandising",
  commercial_visit: "Visite commerciale",
  prospecting_visit: "Visite de prospection",
  relationship_visit: "Visite relationnelle",
  reactivation: "Réactivation",
  pharmacy_audit: "Audit officinal",
  product_launch: "Lancement produit",
  stock_check: "Contrôle stock",
  other: "Autre mission",
};

export function formatPerformanceMetric(metric?: string | null) {
  if (!metric) return "Indicateur";
  return performanceMetricLabels[metric as keyof typeof performanceMetricLabels] ?? presentationLabel(metric);
}

export function formatMissionType(type?: string | null) {
  if (!type) return "Mission";
  return missionTypeLabels[type] ?? presentationLabel(type);
}

export function formatCompactPercent(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function formatCompactNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "0";
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function formatCompactCurrency(value?: number | string | null) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function formatPerformanceValue(metric: string, value?: number | string | null) {
  if (metric === "revenue_ht" || metric === "booked_revenue_ht") return formatCompactCurrency(value);
  if (metric.includes("rate") || metric.includes("distribution")) return formatCompactPercent(value);
  return formatCompactNumber(value);
}

export function objectiveTone(attainment?: number | null) {
  if (attainment == null) return "text-foreground";
  if (attainment >= 100) return "text-emerald-700";
  if (attainment >= 80) return "text-[var(--tr1-navy)]";
  return "text-[var(--tr1-orange)]";
}
