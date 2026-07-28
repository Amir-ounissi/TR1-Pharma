"use client";

import { useEffect } from "react";
import { trackMissionImpactAction } from "@/app/(protected)/dashboard/mission-performance/actions";

export function MissionImpactTracker({
  eventName,
  missionId,
}: {
  eventName: "mission_impact_viewed" | "mission_performance_dashboard_viewed" | "mission_type_comparison_viewed";
  missionId?: string;
}) {
  useEffect(() => {
    void trackMissionImpactAction(eventName, missionId);
  }, [eventName, missionId]);
  return null;
}

