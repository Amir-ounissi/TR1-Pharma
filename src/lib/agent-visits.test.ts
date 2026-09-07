import { describe, expect, it } from "vitest";
import { buildAgentVisitDay, type AgentScheduledVisit } from "./agent-visits";

function visit(overrides: Partial<AgentScheduledVisit> = {}): AgentScheduledVisit {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    pharmacyName: overrides.pharmacyName ?? "Pharmacie test",
    city: overrides.city ?? "Marseille",
    startAt: overrides.startAt ?? "2026-09-07T12:00:00+02:00",
    endAt: overrides.endAt ?? "2026-09-07T12:30:00+02:00",
    status: overrides.status ?? "planned",
    href: overrides.href ?? "/dashboard/pharmacies",
  };
}

describe("buildAgentVisitDay", () => {
  const now = new Date("2026-09-07T14:00:00+02:00");

  it("counts planned, completed, pending closure and upcoming visits", () => {
    const summary = buildAgentVisitDay([
      visit({ id: "done", startAt: "2026-09-07T09:00:00+02:00", status: "completed" }),
      visit({ id: "late", startAt: "2026-09-07T11:00:00+02:00", status: "planned" }),
      visit({ id: "next", startAt: "2026-09-07T16:00:00+02:00", status: "planned" }),
    ], now);

    expect(summary).toMatchObject({
      plannedCount: 3,
      completedCount: 1,
      pendingClosureCount: 1,
      upcomingCount: 1,
      progressPercent: 33,
    });
    expect(summary.pendingClosure.map((item) => item.id)).toEqual(["late"]);
  });

  it("offers closure as soon as the appointment start time has passed", () => {
    const summary = buildAgentVisitDay([
      visit({ id: "at-time", startAt: "2026-09-07T14:00:00+02:00", status: "planned" }),
    ], now);

    expect(summary.pendingClosure.map((item) => item.id)).toEqual(["at-time"]);
    expect(summary.upcoming).toHaveLength(0);
  });

  it("keeps no-show as a resolved planned visit and excludes cancelled visits", () => {
    const summary = buildAgentVisitDay([
      visit({ id: "no-show", startAt: "2026-09-07T10:00:00+02:00", status: "no_show" }),
      visit({ id: "cancelled", startAt: "2026-09-07T15:00:00+02:00", status: "cancelled" }),
    ], now);

    expect(summary.plannedCount).toBe(1);
    expect(summary.completedCount).toBe(1);
    expect(summary.pendingClosureCount).toBe(0);
  });
});
