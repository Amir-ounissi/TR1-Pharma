"use client";

import { useActionState, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { quickInteractionAction, syncOfflineInteractionAction } from "@/app/(protected)/dashboard/agent/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/local-draft";
import { suggestNextAction } from "@/lib/agent-experience";
import { enqueueOfflineAction, flushOfflineActions, listOfflineActions } from "@/lib/offline-queue";

type Draft = {
  interactionType: string;
  outcome: string;
  note: string;
  nextTaskType: string;
  nextTaskAt: string;
  noNextAction: boolean;
  noNextReason: string;
};

function defaultDate(delayDays = 2) {
  const date = new Date(Date.now() + delayDays * 86_400_000);
  date.setHours(9, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function createInitialDraft(): Draft {
  return {
    interactionType: "visit",
    outcome: "completed",
    note: "",
    nextTaskType: "follow_up",
    nextTaskAt: defaultDate(7),
    noNextAction: false,
    noNextReason: "",
  };
}

export function QuickInteraction({
  brandPharmacyId,
  pharmacyId,
  draftScope,
  commercialStatus,
  lastOrderAt,
  visitStartedAt,
  onSuccess,
}: {
  brandPharmacyId: string;
  pharmacyId: string;
  draftScope?: string;
  commercialStatus: string;
  lastOrderAt?: string | null;
  visitStartedAt?: string;
  onSuccess?: (message: string) => void;
}) {
  const router = useRouter();
  const key = useMemo(() => draftKey("interaction", brandPharmacyId), [brandPharmacyId]);
  const [draft, setDraft] = useState(createInitialDraft);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [state, action, pending] = useActionState(quickInteractionAction, {});

  const refreshOfflineCount = useCallback(() => {
    setPendingOfflineCount(listOfflineActions(localStorage).length);
  }, []);

  const syncPending = useCallback(async () => {
    if (!window.navigator.onLine || syncingOffline) return;
    const queued = listOfflineActions(localStorage);
    if (!queued.length) return;

    setSyncingOffline(true);
    try {
      const result = await flushOfflineActions(localStorage, async (offlineAction) => {
        const response = await syncOfflineInteractionAction(offlineAction.payload);
        return response.error ? { ok: false, error: response.error } : { ok: true };
      });
      refreshOfflineCount();
      if (result.completed > 0) {
        setOfflineMessage(`${result.completed} compte rendu${result.completed > 1 ? "s" : ""} synchronisé${result.completed > 1 ? "s" : ""} avec TR1.`);
        router.refresh();
      }
    } finally {
      setSyncingOffline(false);
    }
  }, [refreshOfflineCount, router, syncingOffline]);

  useEffect(() => {
    const updateConnection = () => {
      const online = window.navigator.onLine;
      setIsOnline(online);
      if (online) void syncPending();
    };
    const initializeTimer = window.setTimeout(() => {
      updateConnection();
      refreshOfflineCount();
    }, 0);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("storage", refreshOfflineCount);
    window.addEventListener("tr1:offline-queue-updated", refreshOfflineCount);
    return () => {
      window.clearTimeout(initializeTimer);
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      window.removeEventListener("storage", refreshOfflineCount);
      window.removeEventListener("tr1:offline-queue-updated", refreshOfflineCount);
    };
  }, [refreshOfflineCount, syncPending]);

  useEffect(() => {
    const restored = loadDraft<Draft>(localStorage, key, { contextKey: draftScope });
    if (!restored) return;
    const timer = window.setTimeout(() => setDraft(restored), 0);
    return () => window.clearTimeout(timer);
  }, [draftScope, key]);

  useEffect(() => {
    if (draft.note || draft.noNextReason) saveDraft(localStorage, key, draft, { ttlHours: 24, contextKey: draftScope });
  }, [draft, draftScope, key]);

  useEffect(() => {
    if (state.success) {
      clearDraft(localStorage, key);
      onSuccess?.(state.success);
      const timer = window.setTimeout(() => setDraft(createInitialDraft()), 0);
      return () => window.clearTimeout(timer);
    }
  }, [key, onSuccess, state.success]);

  function update(values: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...values }));
  }

  function updateSuggestion(interactionType: string, outcome: string) {
    const suggestion = suggestNextAction({ interactionType, outcome, commercialStatus, lastOrderAt });
    update({ interactionType, outcome, nextTaskType: suggestion.type, nextTaskAt: defaultDate(suggestion.delayDays) });
  }

  function appendNote(fragment: string) {
    setDraft((current) => ({
      ...current,
      note: current.note.trim() ? `${current.note.trim()} ${fragment}` : fragment,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isOnline) return;
    event.preventDefault();

    const queuedAt = new Date();
    const visitStart = visitStartedAt ? new Date(visitStartedAt) : null;
    const durationMinutes = visitStart
      ? Math.max(1, Math.min(1440, Math.round((queuedAt.getTime() - visitStart.getTime()) / 60_000)))
      : null;

    enqueueOfflineAction(localStorage, {
      kind: "interaction",
      payload: {
        brandPharmacyId,
        pharmacyId,
        interactionType: draft.interactionType,
        outcome: draft.outcome,
        note: draft.note,
        noNextAction: draft.noNextAction,
        noNextReason: draft.noNextAction ? draft.noNextReason : null,
        nextTaskType: draft.noNextAction ? null : draft.nextTaskType,
        nextTaskAt: draft.noNextAction ? null : draft.nextTaskAt,
        visitStartedAt: visitStartedAt ?? null,
        occurredAt: visitStart?.toISOString() ?? queuedAt.toISOString(),
        durationMinutes,
      },
    });

    clearDraft(localStorage, key);
    const queuedCount = listOfflineActions(localStorage).length;
    setPendingOfflineCount(queuedCount);
    setDraft(createInitialDraft());
    setOfflineMessage(`Compte rendu sauvegardé sur cet appareil. ${queuedCount} action${queuedCount > 1 ? "s" : ""} à synchroniser.`);
    window.dispatchEvent(new Event("tr1:offline-queue-updated"));
    onSuccess?.("Visite enregistrée hors ligne. Elle sera comptabilisée après synchronisation avec TR1.");
  }

  return (
    <form action={action} id="quick-interaction" className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} />
      <input type="hidden" name="pharmacyId" value={pharmacyId} />
      {visitStartedAt ? <input type="hidden" name="visitStartedAt" value={visitStartedAt} /> : null}
      {visitStartedAt ? <p className="rounded-xl bg-[#e9f2f8] px-3 py-2 text-sm font-medium text-[#0f2740]">Visite démarrée à {new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(visitStartedAt))}</p> : null}

      {!isOnline ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          Hors connexion : le compte rendu sera enregistré sur cet appareil puis envoyé à TR1 au retour du réseau.
        </p>
      ) : null}

      {pendingOfflineCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span>{pendingOfflineCount} compte rendu{pendingOfflineCount > 1 ? "s" : ""} en attente de synchronisation.</span>
          <Button type="button" size="sm" variant="outline" disabled={!isOnline || syncingOffline} onClick={() => void syncPending()}>
            {syncingOffline ? "Synchronisation…" : "Synchroniser"}
          </Button>
        </div>
      ) : null}

      {offlineMessage ? <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{offlineMessage}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="interactionType">Type</Label>
          <select id="interactionType" name="interactionType" value={draft.interactionType} onChange={(event) => updateSuggestion(event.target.value, draft.outcome)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm">
            <option value="visit">Visite</option><option value="call">Appel</option><option value="email">E-mail</option>
            <option value="message">Message</option><option value="video_call">Visio</option><option value="other">Autre</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="outcome">Résultat</Label>
          <select id="outcome" name="outcome" value={draft.outcome} onChange={(event) => updateSuggestion(draft.interactionType, event.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm">
            <option value="completed">Terminé</option><option value="interested">Intéressé</option><option value="no_answer">Sans réponse</option>
            <option value="callback_requested">Rappel demandé</option><option value="offer_requested">Offre demandée</option>
            <option value="offer_sent">Offre envoyée</option><option value="order_expected">Commande attendue</option>
            <option value="decision_pending">Décision en attente</option><option value="not_interested">Non intéressé</option><option value="other">Autre</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note courte</Label>
        <Textarea id="note" name="note" required minLength={2} maxLength={1000} rows={3} placeholder="Ce qu’il faut retenir…" value={draft.note} onChange={(event) => update({ note: event.target.value })} />
        <div className="flex flex-wrap gap-2" aria-label="Raccourcis de compte rendu">
          {["Offre mise en place", "Stock à surveiller", "Merchandising à revoir", "Formation à prévoir", "Commande à relancer"].map((fragment) => (
            <button key={fragment} type="button" onClick={() => appendNote(fragment)} className="min-h-9 rounded-full border border-[#d8d0c2] bg-white px-3 text-xs font-medium text-[#0f2740] transition-colors hover:border-[#ee6c3b] hover:text-[#c84f24]">
              + {fragment}
            </button>
          ))}
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm">
        <input type="checkbox" name="noNextAction" checked={draft.noNextAction} onChange={(event) => update({ noNextAction: event.target.checked })} />
        Aucune prochaine action
      </label>

      {draft.noNextAction ? (
        <div className="space-y-2">
          <Label htmlFor="noNextReason">Justification obligatoire</Label>
          <Textarea id="noNextReason" name="noNextReason" minLength={10} required rows={2} value={draft.noNextReason} onChange={(event) => update({ noNextReason: event.target.value })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f4efe4] p-3">
          <div className="space-y-2">
            <Label htmlFor="nextTaskType">Prochaine action</Label>
            <select id="nextTaskType" name="nextTaskType" value={draft.nextTaskType} onChange={(event) => update({ nextTaskType: event.target.value })} className="h-10 w-full rounded-lg border bg-white px-3 text-sm">
              <option value="follow_up">Relance</option><option value="call">Appel</option><option value="visit">Visite</option>
              <option value="appointment">Rendez-vous</option><option value="send_offer">Envoyer offre</option><option value="request_order">Demander commande</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextTaskAt">Quand</Label>
            <input id="nextTaskAt" name="nextTaskAt" type="datetime-local" required value={draft.nextTaskAt} onChange={(event) => update({ nextTaskAt: event.target.value })} className="h-9 w-full rounded-lg border bg-white px-2 text-sm" />
          </div>
        </div>
      )}

      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm font-medium text-emerald-700">{state.success}</p> : null}
      <Button type="submit" size="lg" disabled={pending} className="min-h-12 w-full bg-[#ee6c3b] text-white hover:bg-[#d85a2d]">
        {pending ? "Enregistrement…" : isOnline ? "Enregistrer et revenir à ma journée" : "Enregistrer hors ligne"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Le brouillon reste local 24 h. Une saisie hors ligne n’est comptabilisée qu’après réception par TR1.</p>
    </form>
  );
}
