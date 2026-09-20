"use client";

import { useEffect } from "react";
import { trackProductEventAction } from "@/app/(protected)/dashboard/agent/actions";

export function PharmacyOpenedTracker({ pharmacyId }: { pharmacyId: string }) {
  useEffect(() => {
    void trackProductEventAction("pharmacy_opened", pharmacyId);
  }, [pharmacyId]);

  return null;
}
