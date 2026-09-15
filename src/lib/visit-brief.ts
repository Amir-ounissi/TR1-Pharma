export type VisitBriefFact = {
  label: string;
  value: string;
  detail?: string | null;
};

export type VisitBriefSignal = {
  title: string;
  detail?: string | null;
  source?: string | null;
};

export type VisitBriefInput = {
  lastInteraction?: VisitBriefFact | null;
  lastOrder?: VisitBriefFact | null;
  reorder?: VisitBriefFact | null;
  distribution?: VisitBriefFact | null;
  overdueTasks?: number;
  healthReasons?: string[] | null;
  missingProducts?: string[] | null;
  nextBestAction?: {
    label: string;
    rationale?: string[] | null;
    dueAt?: string | null;
  } | null;
  recentMission?: {
    title: string;
    detail?: string | null;
    source?: string | null;
  } | null;
  sellOut?: {
    title: string;
    detail?: string | null;
    source?: string | null;
  } | null;
  fallbackObjective?: string | null;
};

export type VisitBrief = {
  objective: string;
  atAGlance: VisitBriefFact[];
  alerts: VisitBriefSignal[];
  opportunities: VisitBriefSignal[];
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildVisitBrief(input: VisitBriefInput): VisitBrief {
  const atAGlance = [
    input.lastInteraction,
    input.lastOrder,
    input.reorder,
    input.distribution,
  ].filter((item): item is VisitBriefFact => Boolean(item?.value));

  const alerts: VisitBriefSignal[] = [];
  const opportunities: VisitBriefSignal[] = [];

  if ((input.overdueTasks ?? 0) > 0) {
    alerts.push({
      title: `${input.overdueTasks} action${input.overdueTasks === 1 ? "" : "s"} en retard`,
      detail: "À traiter ou replanifier pendant la visite.",
      source: "Tâches TR1",
    });
  }

  for (const reason of unique(input.healthReasons ?? []).slice(0, 3)) {
    alerts.push({ title: reason, source: "Santé commerciale TR1" });
  }

  const missingProducts = unique(input.missingProducts ?? []);
  if (missingProducts.length) {
    opportunities.push({
      title: `${missingProducts.length} référence${missingProducts.length === 1 ? "" : "s"} stratégique${missingProducts.length === 1 ? "" : "s"} manquante${missingProducts.length === 1 ? "" : "s"}`,
      detail: missingProducts.slice(0, 4).join(" · "),
      source: "Distribution TR1",
    });
  }

  if (input.nextBestAction) {
    opportunities.unshift({
      title: input.nextBestAction.label,
      detail: unique(input.nextBestAction.rationale ?? []).slice(0, 2).join(" · ") || null,
      source: input.nextBestAction.dueAt
        ? `Prochaine action recommandée · ${input.nextBestAction.dueAt}`
        : "Prochaine action recommandée",
    });
  }

  if (input.recentMission) opportunities.push(input.recentMission);
  if (input.sellOut) opportunities.push(input.sellOut);

  const objective =
    input.nextBestAction?.label ||
    opportunities[0]?.title ||
    alerts[0]?.title ||
    input.fallbackObjective ||
    "Faire le point et définir la prochaine action utile";

  return {
    objective,
    atAGlance,
    alerts: alerts.slice(0, 4),
    opportunities: opportunities.slice(0, 4),
  };
}
