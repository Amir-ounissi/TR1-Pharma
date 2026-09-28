export type HubSpotVisitCandidate = {
  id: string;
  scheduledStartAt: string;
  source: string | null;
  createdAt: string | null;
};

function sourceRank(source: string | null) {
  if (source === "manual") return 0;
  if (source === "interaction") return 1;
  if (source === "import") return 2;
  return 3;
}

export function selectHubSpotVisitCandidate(
  candidates: HubSpotVisitCandidate[],
  alreadyLinkedVisitIds: ReadonlySet<string>,
  expectedStartMs: number,
) {
  return candidates
    .filter((candidate) => !alreadyLinkedVisitIds.has(candidate.id))
    .flatMap((candidate) => {
      const scheduledStartMs = new Date(candidate.scheduledStartAt).getTime();
      if (!Number.isFinite(scheduledStartMs)) return [];
      return [{
        candidate,
        distanceMs: Math.abs(scheduledStartMs - expectedStartMs),
        sourceRank: sourceRank(candidate.source),
        createdAtMs: candidate.createdAt ? new Date(candidate.createdAt).getTime() : Number.POSITIVE_INFINITY,
      }];
    })
    .sort((left, right) =>
      left.distanceMs - right.distanceMs ||
      left.sourceRank - right.sourceRank ||
      left.createdAtMs - right.createdAtMs ||
      left.candidate.id.localeCompare(right.candidate.id)
    )[0]?.candidate.id ?? null;
}

export function hubSpotCanMutateVisit(source: string | null, status: string) {
  return source === "import" && status !== "in_progress" && status !== "completed";
}


export function resolveHubSpotMeetingStart(options: {
  meetingStartTime: unknown;
  activityTimestamp: unknown;
  outcome: unknown;
}) {
  const scheduledStart =
    typeof options.meetingStartTime === "string" && options.meetingStartTime.trim()
      ? options.meetingStartTime.trim()
      : null;
  if (scheduledStart) {
    return { start: scheduledStart, isScheduled: true };
  }

  const outcome = String(options.outcome ?? "").trim().toUpperCase();
  const activityTimestamp =
    typeof options.activityTimestamp === "string" && options.activityTimestamp.trim()
      ? options.activityTimestamp.trim()
      : null;

  if (outcome === "COMPLETED" && activityTimestamp) {
    return { start: activityTimestamp, isScheduled: false };
  }

  return { start: null, isScheduled: false };
}
