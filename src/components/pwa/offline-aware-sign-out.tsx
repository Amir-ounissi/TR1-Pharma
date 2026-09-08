"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearOfflineDaySnapshot } from "@/lib/offline-day-snapshot";
import { clearOfflineActions } from "@/lib/offline-queue";

export function OfflineAwareSignOut({ action }: { action: () => void | Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={() => {
        clearOfflineDaySnapshot(window.localStorage);
        clearOfflineActions(window.localStorage);
      }}
    >
      <Button className="w-full justify-start text-sidebar-foreground/65 hover:bg-white/8 hover:text-white" variant="ghost">
        <LogOut className="size-4" />
        Déconnexion
      </Button>
    </form>
  );
}
