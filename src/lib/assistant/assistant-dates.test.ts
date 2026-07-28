import { describe, expect, it } from "vitest";
import { resolveNaturalDate } from "./assistant-dates";

const timezone = "Europe/Paris";

describe("assistant natural dates", () => {
  it("resolves today, tomorrow and after tomorrow explicitly", () => {
    const now = new Date("2026-07-27T08:00:00.000Z");
    expect(resolveNaturalDate("aujourd’hui", { now, timezone })?.label).toContain("27 juillet 2026");
    expect(resolveNaturalDate("demain", { now, timezone })?.label).toContain("28 juillet 2026");
    expect(resolveNaturalDate("après-demain", { now, timezone })?.label).toContain("29 juillet 2026");
  });

  it("resolves mardi prochain in the following calendar week", () => {
    const value = resolveNaturalDate("La rappeler mardi prochain", {
      now: new Date("2026-07-27T08:00:00.000Z"),
      timezone,
    });
    expect(value?.label).toContain("mardi 4 août 2026");
    expect(value?.iso).toBe("2026-08-04T07:00:00.000Z");
  });

  it("resolves in X days and an explicit time", () => {
    const value = resolveNaturalDate("dans 5 jours à 14h30", {
      now: new Date("2026-07-31T08:00:00.000Z"),
      timezone,
    });
    expect(value?.label).toContain("mercredi 5 août 2026");
    expect(value?.iso).toBe("2026-08-05T12:30:00.000Z");
  });

  it("handles the week boundary and next week", () => {
    const sunday = new Date("2026-08-02T10:00:00.000Z");
    expect(resolveNaturalDate("lundi", { now: sunday, timezone })?.label).toContain("lundi 3 août 2026");
    expect(resolveNaturalDate("la semaine prochaine", { now: sunday, timezone })?.label).toContain("lundi 3 août 2026");
  });

  it("rejects missing and unreasonable dates", () => {
    expect(resolveNaturalDate("un de ces jours", { timezone })).toBeNull();
    expect(resolveNaturalDate("dans 999 jours", { timezone })).toBeNull();
  });
});

