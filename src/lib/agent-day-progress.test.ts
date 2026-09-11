import { describe, expect, it } from "vitest";
import { getVisitProgress, visitStatusLabel } from "./agent-day-progress";

describe("daily visit progression", () => {
  it("does not turn an empty day into an achievement", () => {
    expect(getVisitProgress([])).toEqual({ planned: 0, completed: 0, missed: 0, percent: 0 });
  });
  it("counts actual completions and keeps no-shows out of achievements", () => {
    expect(getVisitProgress([{ status: "COMPLETED" }, { status: "no_show" }, { status: "planned" }]))
      .toEqual({ planned: 3, completed: 1, missed: 1, percent: 33 });
  });
  it("excludes cancelled visits from the target", () => {
    expect(getVisitProgress([{ status: "completed" }, { status: "cancelled" }, { status: "rejected" }]))
      .toEqual({ planned: 1, completed: 1, missed: 0, percent: 100 });
  });
  it("does not mark unknown statuses as successes", () => {
    expect(getVisitProgress([{ status: "unknown" }]).percent).toBe(0);
    expect(visitStatusLabel("unknown")).toBe("Statut à vérifier");
    expect(visitStatusLabel(" PLANNED ")).toBe("Planifiée");
  });
});
