"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  syncHubSpotAgentDataAction,
  type HubSpotManualSyncState,
} from "@/app/(protected)/dashboard/agent/actions";
import { Button } from "@/components/ui/button";

const initialState: HubSpotManualSyncState = {};

function syncLabel(value: string | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function HubSpotManualSync({
  available,
  lastFullSyncAt,
}: {
  available: boolean;
  lastFullSyncAt: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(syncHubSpotAgentDataAction, initialState);

  useEffect(() => {
    if (state.syncedAt) router.refresh();
  }, [router, state.syncedAt]);

  if (!available) return null;

  const displayedSyncAt = state.syncedAt ?? lastFullSyncAt;

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 sm:items-end">
      <form action={action}>
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="min-h-11 border-[var(--tr1-navy)]/15 bg-white px-3.5 text-[var(--tr1-navy)]"
        >
          <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
          {pending ? "Synchronisation…" : "Synchroniser HubSpot"}
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground">
        Dernière synchro complète : {syncLabel(displayedSyncAt)}
      </p>
      {state.error ? (
        <p role="alert" className="max-w-xs text-xs text-red-700">{state.error}</p>
      ) : null}
      {state.success ? (
        <p role="status" className="max-w-sm text-xs text-emerald-700">{state.success}</p>
      ) : null}
    </div>
  );
}
