"use client";

import { useEffect } from "react";
import { saveOfflineDaySnapshot, type OfflineDaySnapshot } from "@/lib/offline-day-snapshot";

export function OfflineDayPreloader({ snapshot }: { snapshot: OfflineDaySnapshot }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveOfflineDaySnapshot(window.localStorage, snapshot);
      window.dispatchEvent(new Event("tr1:pwa-day-snapshot-updated"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  return null;
}
