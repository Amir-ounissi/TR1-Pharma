import { describe, expect, it } from "vitest";
import { buildTerrainPulse, type TerrainPulseInput } from "./terrain-engagement";

function day(overrides: Partial<TerrainPulseInput> = {}): TerrainPulseInput {
  return { tasks: [], missions: [], reports: [], follow_ups: [], ...overrides };
}

describe("buildTerrainPulse", () => {
  it("returns an up-to-date state for an empty day", () => {
    expect(buildTerrainPulse(day())).toEqual({
      overdueCount: 0,
      missionCount: 0,
      followUpCount: 0,
      reportCount: 0,
      totalActions: 0,
      attentionCount: 0,
      isFollowUpCurrent: true,
    });
  });

  it("counts only overdue tasks as day-load actions", () => {
    const pulse = buildTerrainPulse(day({
      tasks: [{ is_overdue: true }, { is_overdue: true }, { is_overdue: false }],
    }));

    expect(pulse).toMatchObject({ overdueCount: 2, totalActions: 2, attentionCount: 2, isFollowUpCurrent: false });
  });

  it("counts reports as attention items", () => {
    const pulse = buildTerrainPulse(day({ reports: [{}, {}], follow_ups: [{}] }));

    expect(pulse).toMatchObject({ reportCount: 2, followUpCount: 1, totalActions: 3, attentionCount: 2, isFollowUpCurrent: false });
  });

  it("combines every actionable category without inventing completion", () => {
    const pulse = buildTerrainPulse(day({
      tasks: [{ is_overdue: true }],
      missions: [{}, {}],
      reports: [{}],
      follow_ups: [{}, {}, {}],
    }));

    expect(pulse).toMatchObject({
      overdueCount: 1,
      missionCount: 2,
      followUpCount: 3,
      reportCount: 1,
      totalActions: 7,
      attentionCount: 2,
      isFollowUpCurrent: false,
    });
  });
});
