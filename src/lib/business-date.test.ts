import { describe, expect, it } from "vitest";
import { parisBusinessDate } from "./business-date";

describe("parisBusinessDate", () => {
  it("keeps the Paris business day around the UTC boundary", () => {
    expect(parisBusinessDate(new Date("2026-01-01T23:30:00.000Z"))).toBe("2026-01-02");
  });
});
