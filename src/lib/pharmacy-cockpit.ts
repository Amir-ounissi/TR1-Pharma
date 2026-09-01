export type PharmacyObjective = "open" | "follow" | "develop";

export type PharmacyCockpitInput = {
  firstOrderAt?: string | null;
  validOrderCount?: number | null;
  reorderCount?: number | null;
  expectedReorderAt?: string | null;
  hasNextAction?: boolean | null;
  strategicDistributionRate?: number | null;
  missingProducts?: unknown[] | null;
  healthStatus?: string | null;
  priorityReasons?: string[] | null;
  commercialStatus?: string | null;
};

export type PharmacyCockpit = {
  objective: PharmacyObjective;
  objectiveLabel: string;
  primaryAction: { label: string; href: string };
  reasons: string[];
};

const objectives = {
  open: {
    label: "À ouvrir",
    action: "Enregistrer la première commande",
  },
  follow: {
    label: "À suivre",
    action: "Ajouter une prochaine action",
  },
  develop: {
    label: "À développer",
    action: "Créer une action terrain",
  },
} as const;

export function getPharmacyCockpit(input: PharmacyCockpitInput): PharmacyCockpit {
  const hasFirstOrder = Boolean(input.firstOrderAt) || Number(input.validOrderCount ?? 0) > 0;
  const strategicGap = Number(input.strategicDistributionRate ?? 100) < 100 || Boolean(input.missingProducts?.length);
  const needsRecovery = ["at_risk", "dormant", "watch"].includes(input.healthStatus ?? "");
  const objective: PharmacyObjective = !hasFirstOrder ? "open" : strategicGap || needsRecovery ? "develop" : "follow";
  const reasons = getReasons(input, hasFirstOrder, strategicGap, needsRecovery);
  const definition = objectives[objective];

  return {
    objective,
    objectiveLabel: definition.label,
    primaryAction: {
      label: definition.action,
      href: objective === "open" ? "?tab=orders" : objective === "develop" ? "?tab=performance" : "?tab=activity",
    },
    reasons,
  };
}

function getReasons(input: PharmacyCockpitInput, hasFirstOrder: boolean, strategicGap: boolean, needsRecovery: boolean) {
  const reasons: string[] = [];
  if (!hasFirstOrder) reasons.push("Aucune première commande n’est encore observée.");
  if (hasFirstOrder && Number(input.reorderCount ?? 0) === 0) reasons.push("Premier réassort à surveiller.");
  if (strategicGap) reasons.push("L’assortiment stratégique est incomplet.");
  if (needsRecovery) reasons.push("L’intervalle habituel de commande mérite une attention.");
  if (!input.hasNextAction) reasons.push("Aucune prochaine action n’est planifiée.");
  for (const reason of input.priorityReasons ?? []) {
    if (reasons.length >= 3) break;
    if (!reasons.includes(reason)) reasons.push(reason);
  }
  return reasons.length ? reasons.slice(0, 3) : ["Le compte est suivi : conservez une prochaine action utile."];
}
