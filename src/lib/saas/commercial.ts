export type SaasUsageState = "unlimited" | "normal" | "warning" | "exceeded";

export type SaasUsageProgress = {
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number | null;
  state: SaasUsageState;
};

export function resolveSaasUsageProgress(
  usedValue: number,
  limitValue: number | null,
): SaasUsageProgress {
  const used = Math.max(0, Number.isFinite(usedValue) ? usedValue : 0);
  if (limitValue == null) {
    return { used, limit: null, remaining: null, percent: null, state: "unlimited" };
  }

  const limit = Math.max(1, Number.isFinite(limitValue) ? limitValue : 1);
  const remaining = Math.max(limit - used, 0);
  const rawPercent = (used / limit) * 100;
  const percent = Math.min(Math.max(rawPercent, 0), 100);
  const state: SaasUsageState =
    used > limit ? "exceeded" : rawPercent >= 80 ? "warning" : "normal";

  return { used, limit, remaining, percent, state };
}

export function saasUsageStateLabel(state: SaasUsageState) {
  if (state === "unlimited") return "Illimité";
  if (state === "warning") return "À surveiller";
  if (state === "exceeded") return "Dépassé";
  return "Disponible";
}

export function saasQuotaPeriodLabel(period: string) {
  if (period === "year") return "Période annuelle";
  if (period === "lifetime") return "Période cumulée";
  return "Période mensuelle";
}

export function formatSaasLimit(value: number | null, unitLabel?: string) {
  if (value == null) return "Illimité";
  return `${new Intl.NumberFormat("fr-FR").format(value)}${unitLabel ? ` ${unitLabel}` : ""}`;
}
