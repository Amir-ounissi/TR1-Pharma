"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function isOnline() {
  return navigator.onLine;
}

function serverOnline() {
  return true;
}

/**
 * Navigator connectivity is a hint, not a guarantee that a server write succeeded.
 * Never imply an offline action has been synchronized.
 */
export function NetworkStatusBanner({ canUseOfflineDay }: { canUseOfflineDay: boolean }) {
  const online = useSyncExternalStore(subscribe, isOnline, serverOnline);
  if (online) return null;

  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-center gap-2 border-b border-amber-300/70 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950">
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      <span>Connexion indisponible. Les actions nécessitant le serveur peuvent échouer.</span>
      {canUseOfflineDay ? (
        <Link href="/offline" className="font-bold underline underline-offset-2">
          Ouvrir ma journée locale
        </Link>
      ) : null}
    </div>
  );
}
