"use client";

import { useEffect } from "react";
import { trackProductEventAction } from "@/app/(protected)/dashboard/agent/actions";

export function DashboardTracker() {
  useEffect(() => {
    void trackProductEventAction("agent_dashboard_viewed");
  }, []);
  return null;
}
