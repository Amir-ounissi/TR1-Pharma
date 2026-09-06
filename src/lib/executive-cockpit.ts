export type ExecutiveOverview = {
  revenue_ht: number;
  implantations: number;
  reorders: number;
  active_pharmacies: number;
  at_risk_accounts: number;
  dormant_accounts: number;
  without_next_action_count: number;
  strategic_without_action_count: number;
  first_reorder_rate: number;
  avg_distribution_rate: number;
  strategic_distribution_rate: number;
};

export type ExecutiveObjective = {
  objective_id: string;
  scope_type: "brand" | "territory" | "agent";
  metric_key: string;
  period_start: string;
  period_end: string;
  target_value: number;
  realized_value: number;
  attainment_percent: number | null;
  gap_value: number;
  projected_value: number | null;
};

export type ExecutiveAlertTone = "critical" | "warning" | "info";

export type ExecutiveAlert = {
  key: string;
  tone: ExecutiveAlertTone;
  title: string;
  detail: string;
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function getExecutivePeriods(referenceDate = new Date()) {
  const currentYear = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();
  const previousYear = currentYear - 1;
  const previousDay = Math.min(day, daysInUtcMonth(previousYear, month));

  return {
    current: {
      start: `${currentYear}-01-01`,
      end: isoDate(referenceDate),
      fullYearEnd: `${currentYear}-12-31`,
    },
    previous: {
      start: `${previousYear}-01-01`,
      end: isoDate(new Date(Date.UTC(previousYear, month, previousDay))),
    },
  };
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function runRateProjection(realized: number, periodStart: string, periodEnd: string, referenceDate: string) {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T00:00:00.000Z`);
  const reference = new Date(`${referenceDate}T00:00:00.000Z`);
  if ([start, end, reference].some((date) => Number.isNaN(date.getTime())) || end < start || reference < start) return null;

  const dayMs = 86_400_000;
  const effectiveReference = reference > end ? end : reference;
  const elapsedDays = Math.floor((effectiveReference.getTime() - start.getTime()) / dayMs) + 1;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
  if (elapsedDays <= 0 || totalDays <= 0) return null;
  return Math.round((realized / elapsedDays) * totalDays * 100) / 100;
}

export function pickExecutiveObjective(
  objectives: ExecutiveObjective[],
  metricKey: string,
  periodStart: string,
  periodEnd: string,
) {
  return objectives.find(
    (objective) => objective.scope_type === "brand"
      && objective.metric_key === metricKey
      && objective.period_start === periodStart
      && objective.period_end === periodEnd,
  ) ?? null;
}

export function buildExecutiveAlerts(input: {
  current: ExecutiveOverview;
  previousRevenue: number;
  projectedRevenue: number | null;
  targetRevenue: number | null;
}) {
  const alerts: ExecutiveAlert[] = [];
  const { current, previousRevenue, projectedRevenue, targetRevenue } = input;

  if (targetRevenue !== null && projectedRevenue !== null && projectedRevenue < targetRevenue) {
    const gap = Math.round(targetRevenue - projectedRevenue);
    alerts.push({
      key: "revenue-projection-gap",
      tone: "critical",
      title: "Atterrissage sous l’objectif",
      detail: `Le run-rate actuel projette un écart d’environ ${gap.toLocaleString("fr-FR")} € HT sous l’objectif annuel.`,
    });
  }

  if (current.strategic_without_action_count > 0) {
    alerts.push({
      key: "strategic-without-action",
      tone: "critical",
      title: "Comptes stratégiques sans prochaine action",
      detail: `${current.strategic_without_action_count} pharmacie(s) stratégique(s) n’ont aucune prochaine action planifiée.`,
    });
  }

  if (current.at_risk_accounts > 0) {
    alerts.push({
      key: "at-risk",
      tone: "warning",
      title: "Portefeuille à risque",
      detail: `${current.at_risk_accounts} compte(s) sont actuellement classés à risque.`,
    });
  }

  if (current.dormant_accounts > 0) {
    alerts.push({
      key: "dormant",
      tone: "warning",
      title: "Comptes dormants",
      detail: `${current.dormant_accounts} compte(s) nécessitent une réactivation.`,
    });
  }

  const revenueDelta = percentChange(current.revenue_ht, previousRevenue);
  if (revenueDelta !== null && revenueDelta < 0) {
    alerts.push({
      key: "revenue-n1",
      tone: "warning",
      title: "CA en retrait vs N-1",
      detail: `Le CA à date est inférieur de ${Math.abs(revenueDelta).toLocaleString("fr-FR")} % à la même période l’an dernier.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      key: "no-critical-alert",
      tone: "info",
      title: "Aucune alerte direction prioritaire",
      detail: "Les indicateurs suivis ne déclenchent pas d’alerte majeure à date.",
    });
  }

  return alerts.slice(0, 5);
}
