export type AgentScheduledVisit = {
  id: string;
  pharmacyName: string;
  city: string | null;
  startAt: string;
  endAt: string | null;
  status: string;
  href: string;
};

const EXCLUDED_STATUSES = new Set(["cancelled", "rejected", "refunded"]);
const RESOLVED_STATUSES = new Set(["completed", "no_show"]);

function normalizedStatus(status: string) {
  return status.trim().toLowerCase();
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function buildAgentVisitDay(visits: AgentScheduledVisit[], now = new Date()) {
  const nowMs = now.getTime();
  const planned = visits
    .filter((visit) => !EXCLUDED_STATUSES.has(normalizedStatus(visit.status)))
    .sort((a, b) => timestamp(a.startAt) - timestamp(b.startAt));

  const completed = planned.filter((visit) => RESOLVED_STATUSES.has(normalizedStatus(visit.status)));
  const pendingClosure = planned.filter((visit) => {
    const status = normalizedStatus(visit.status);
    return !RESOLVED_STATUSES.has(status) && timestamp(visit.startAt) <= nowMs;
  });
  const upcoming = planned.filter((visit) => {
    const status = normalizedStatus(visit.status);
    return !RESOLVED_STATUSES.has(status) && timestamp(visit.startAt) > nowMs;
  });

  return {
    planned,
    completed,
    pendingClosure,
    upcoming,
    plannedCount: planned.length,
    completedCount: completed.length,
    pendingClosureCount: pendingClosure.length,
    upcomingCount: upcoming.length,
    progressPercent: planned.length ? Math.round((completed.length / planned.length) * 100) : 0,
  };
}
