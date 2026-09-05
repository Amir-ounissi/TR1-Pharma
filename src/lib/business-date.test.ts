import { describe, expect, it } from "vitest";
import { nextIsoDate, parisBusinessDate, parisYearToDate } from "./business-date";

describe("parisBusinessDate", () => {
  it("keeps the Paris business day around the UTC boundary", () => {
    expect(parisBusinessDate(new Date("2026-01-01T23:30:00.000Z"))).toBe("2026-01-02");
  });

  it("builds the current Paris year-to-date period", () => {
    expect(parisYearToDate(new Date("2026-09-05T10:00:00.000Z"))).toEqual({
      from: "2026-01-01",
      to: "2026-09-05",
    });
  });

  it("gets the exclusive upper bound for a date filter", () => {
    expect(nextIsoDate("2026-09-05")).toBe("2026-09-06");
    expect(nextIsoDate("2026-12-31")).toBe("2027-01-01");
  });
});
