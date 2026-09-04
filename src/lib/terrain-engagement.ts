export type TerrainPulseInput = {
  tasks: { is_overdue: boolean }[];
  missions: unknown[];
  reports: unknown[];
  follow_ups: unknown[];
};

export type TerrainPulse = {
  overdueCount: number;
  missionCount: number;
  followUpCount: number;
  reportCount: number;
  totalActions: number;
  attentionCount: number;
  isFollowUpCurrent: boolean;
};

export function buildTerrainPulse(day: TerrainPulseInput): TerrainPulse {
  const overdueCount = day.tasks.filter((task) => task.is_overdue).length;
  const missionCount = day.missions.length;
  const followUpCount = day.follow_ups.length;
  const reportCount = day.reports.length;

  return {
    overdueCount,
    missionCount,
    followUpCount,
    reportCount,
    totalActions: overdueCount + missionCount + followUpCount + reportCount,
    attentionCount: overdueCount + reportCount,
    isFollowUpCurrent: overdueCount === 0 && reportCount === 0,
  };
}
