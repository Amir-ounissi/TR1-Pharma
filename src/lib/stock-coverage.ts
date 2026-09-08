export const STOCK_COVERAGE_MAX_AGE_DAYS = 45;

export type StockCapture = {
  id: string;
  period_end: string;
};

export type StockLine = {
  capture_id: string;
  product_id?: string | null;
  ean?: string | null;
  label?: string | null;
  units_sold: number | null;
  stock_current: number | null;
};

export type StockCoverage = {
  identity: string;
  name: string;
  stock: number;
  average: number;
  days: number;
  date: string;
};

export function isStockCaptureFresh(
  periodEnd: string,
  asOf = new Date(),
  maxAgeDays = STOCK_COVERAGE_MAX_AGE_DAYS,
) {
  const period = new Date(`${periodEnd.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(period.getTime())) return false;
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const ageDays = Math.floor((today - period.getTime()) / 86_400_000);
  return ageDays >= 0 && ageDays <= maxAgeDays;
}

/**
 * Compare chaque référence avec ses trois dernières périodes mensuelles disponibles.
 * Le stock utilisé est toujours celui du dernier relevé validé fourni.
 * Par défaut, une donnée de plus de 45 jours ne produit aucune couverture exploitable.
 */
export function stockCoverage(
  captures: StockCapture[],
  lines: StockLine[],
  options: { asOf?: Date; maxAgeDays?: number } = {},
): StockCoverage[] {
  const periods = [...captures].sort((a, b) => b.period_end.localeCompare(a.period_end));
  const latest = periods[0];
  if (!latest) return [];

  const maxAgeDays = options.maxAgeDays ?? STOCK_COVERAGE_MAX_AGE_DAYS;
  if (!isStockCaptureFresh(latest.period_end, options.asOf ?? new Date(), maxAgeDays)) return [];

  const key = (line: StockLine) => line.ean || line.product_id || line.label;
  const latestLines = lines.filter((line) => line.capture_id === latest.id && line.stock_current !== null);

  return latestLines.flatMap((line) => {
    const identity = key(line);
    if (!identity) return [];

    const observations: number[] = [];
    const seenMonths = new Set<string>();
    for (const period of periods) {
      const month = period.period_end.slice(0, 7);
      if (seenMonths.has(month)) continue;
      const match = lines.find((item) => item.capture_id === period.id && key(item) === identity && item.units_sold !== null);
      if (!match) continue;
      seenMonths.add(month);
      observations.push(Number(match.units_sold));
      if (observations.length === 3) break;
    }

    if (!observations.length) return [];
    const average = observations.reduce((sum, value) => sum + value, 0) / observations.length;
    if (!(average > 0)) return [];

    const stock = Number(line.stock_current);
    return [{
      identity,
      name: line.label || line.ean || "Référence à identifier",
      stock,
      average,
      days: Math.max(0, Math.round((stock / average) * 30)),
      date: latest.period_end,
    }];
  }).sort((a, b) => a.days - b.days);
}
