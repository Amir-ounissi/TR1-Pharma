"use client";

import { useEffect } from "react";
import { trackFieldVisitOpenedAction } from "@/app/(protected)/dashboard/visits/actions";

export function VisitOpenedTracker({ visitId }: { visitId: string }) {
  useEffect(() => {
    void trackFieldVisitOpenedAction(visitId);
  }, [visitId]);

  return null;
}
