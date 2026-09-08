"use client";

import { useEffect } from "react";
import { setActiveOfflineScope } from "@/lib/offline-day-snapshot";

export function OfflineScopeRuntime({ userId, brandId }: { userId: string; brandId: string | null }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveOfflineScope(window.localStorage, brandId ? { userId, brandId } : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [brandId, userId]);

  return null;
}
