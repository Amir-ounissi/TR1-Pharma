"use client";

import { useEffect } from "react";
import { trackCommercialEventAction } from "@/app/(protected)/dashboard/commercial-health/actions";

export function CommercialEventTracker({ eventName, pharmacyId }: { eventName: string; pharmacyId?: string }) {
  useEffect(() => {
    void trackCommercialEventAction(eventName, pharmacyId);
  }, [eventName, pharmacyId]);
  return null;
}
