"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const navigatorStandalone = (navigator as NavigatorWithStandalone).standalone === true;
  return navigatorStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

function isSafariOnIos() {
  if (typeof navigator === "undefined") return false;
  return /Safari/.test(navigator.userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(navigator.userAgent);
}

export function PwaRuntime() {
  const pathname = usePathname();
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // The web app remains fully usable when service-worker registration is unavailable.
      });
    }
  }, []);

  useEffect(() => {
    const dismissed = window.localStorage.getItem("tr1-pwa-install-hint-dismissed") === "1";
    const eligibleRoute = pathname.startsWith("/dashboard");
    setShowInstallHint(
      !dismissed && eligibleRoute && isIosDevice() && isSafariOnIos() && !isStandaloneMode(),
    );
  }, [pathname]);

  if (!showInstallHint) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[100] mx-auto max-w-md rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur"
      aria-label="Installer TR1 Pharma sur l’iPhone"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0b1e32] text-sm font-black text-white">
          TR1
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Installer TR1 Pharma sur l’iPhone</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dans Safari : touchez Partager, puis « Ajouter à l’écran d’accueil ». TR1 s’ouvrira ensuite comme une application.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          aria-label="Masquer ce conseil"
          onClick={() => {
            window.localStorage.setItem("tr1-pwa-install-hint-dismissed", "1");
            setShowInstallHint(false);
          }}
        >
          ×
        </button>
      </div>
    </aside>
  );
}
