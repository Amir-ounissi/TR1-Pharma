"use client";

import { useActionState } from "react";
import {
  scheduleAnimationRequestDayAction,
  scheduleOwnAnimationAction,
} from "@/app/(protected)/dashboard/missions/animation-actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function OwnAnimationScheduleForm({
  missionId,
  defaultStart,
  defaultEnd,
  requestMode = false,
}: {
  missionId: string;
  defaultStart: string | null;
  defaultEnd: string | null;
  requestMode?: boolean;
}) {
  const serverAction = requestMode ? scheduleAnimationRequestDayAction : scheduleOwnAnimationAction;
  const [state, action, pending] = useActionState(serverAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="missionId" value={missionId} />
      <ActionFeedback {...state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{requestMode ? "Début de la journée" : "Début confirmé"}</Label>
          <Input name="scheduledStartAt" type="datetime-local" defaultValue={toLocal(defaultStart)} required />
        </div>
        <div className="space-y-2">
          <Label>{requestMode ? "Fin de la journée" : "Fin confirmée"}</Label>
          <Input name="scheduledEndAt" type="datetime-local" defaultValue={toLocal(defaultEnd)} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {requestMode
          ? "Cette date sera rattachée à la demande acceptée. TR1 vérifiera le quota du mois et les chevauchements avec vos autres missions."
          : "Vous pouvez conserver le créneau proposé ou l’ajuster. TR1 vérifie automatiquement les chevauchements avec vos autres missions."}
      </p>
      <Button disabled={pending} className="w-full sm:w-auto">
        {pending ? "Planification…" : requestMode ? "Planifier cette journée" : "Confirmer mon créneau"}
      </Button>
    </form>
  );
}
