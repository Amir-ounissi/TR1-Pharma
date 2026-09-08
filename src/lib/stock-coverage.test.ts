import { describe, expect, it } from "vitest";
import { isStockCaptureFresh, stockCoverage } from "./stock-coverage";

const asOf = new Date("2026-09-08T12:00:00.000Z");
const captures = [
  { id: "jun", period_end: "2026-06-30" },
  { id: "aug", period_end: "2026-08-31" },
  { id: "jul", period_end: "2026-07-31" },
];

describe("stockCoverage", () => {
  it("uses latest stock and averages each reference independently", () => {
    const lines = [
      { capture_id: "jun", ean: "a", units_sold: 18, stock_current: 20 },
      { capture_id: "aug", ean: "b", units_sold: 900, stock_current: 900 },
      { capture_id: "jul", ean: "a", units_sold: 24, stock_current: 14 },
      { capture_id: "aug", ean: "a", units_sold: 31, stock_current: 8 },
    ];

    const result = stockCoverage(captures, lines, { asOf });
    expect(result.find((item) => item.identity === "a")).toMatchObject({
      stock: 8,
      days: 10,
      average: 73 / 3,
    });
  });

  it("includes zero stock but excludes unknown stock and references without sales", () => {
    const lines = [
      { capture_id: "aug", ean: "a", units_sold: 30, stock_current: 0 },
      { capture_id: "aug", ean: "b", units_sold: 30, stock_current: null },
      { capture_id: "aug", ean: "c", units_sold: 0, stock_current: 8 },
    ];

    expect(stockCoverage(captures, lines, { asOf })).toMatchObject([{ identity: "a", days: 0 }]);
  });

  it("does not create predictive coverage from a stale capture", () => {
    const oldCaptures = [{ id: "old", period_end: "2026-07-01" }];
    const lines = [{ capture_id: "old", ean: "a", units_sold: 30, stock_current: 5 }];

    expect(stockCoverage(oldCaptures, lines, { asOf })).toEqual([]);
    expect(isStockCaptureFresh("2026-07-01", asOf)).toBe(false);
  });

  it("accepts a capture exactly 45 days old", () => {
    expect(isStockCaptureFresh("2026-07-25", asOf)).toBe(true);
  });
});
