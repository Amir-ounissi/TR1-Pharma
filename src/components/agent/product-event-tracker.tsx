"use client";

import { useEffect } from "react";
import { trackProductEventAction } from "@/app/(protected)/dashboard/agent/actions";

export function ProductEventTracker({ pharmacyId }: { pharmacyId: string }) {
  useEffect(() => {
    void trackProductEventAction("mission_opened", pharmacyId);
  }, [pharmacyId]);
  return null;
}
