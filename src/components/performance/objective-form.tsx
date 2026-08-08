"use client";

import { useActionState } from "react";
import { saveObjectiveAction, type ObjectiveActionState } from "@/app/(protected)/dashboard/network/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { performanceMetricLabels } from "@/lib/performance";

type Option = { id: string; name: string };

export function ObjectiveForm({
  periodStart,
  periodEnd,
  territories,
  agents,
}: {
  periodStart: string;
  periodEnd: string;
  territories: Option[];
  agents: Option[];
}) {
  const [state, action, pending] = useActionState<ObjectiveActionState, FormData>(saveObjectiveAction, {});

  return (
    <form action={action} className="grid gap-3 lg:grid-cols-3">
      <div className="lg:col-span-3"><ActionFeedback {...state} /></div>
      <div className="space-y-2">
        <Label>Métrique</Label>
        <Select name="metricKey" defaultValue="revenue_ht">
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(performanceMetricLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Périmètre</Label>
        <Select name="scopeType" defaultValue="brand">
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="brand">Marque</SelectItem>
            <SelectItem value="territory">Territoire</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Cible</Label>
        <Input name="targetValue" min="0" step="0.1" type="number" defaultValue="0" />
      </div>
      <div className="space-y-2">
        <Label>Début</Label>
        <Input name="periodStart" type="date" defaultValue={periodStart} />
      </div>
      <div className="space-y-2">
        <Label>Fin</Label>
        <Input name="periodEnd" type="date" defaultValue={periodEnd} />
      </div>
      <div className="space-y-2">
        <Label>Territoire</Label>
        <Select name="territoryId" defaultValue="none">
          <SelectTrigger className="w-full"><SelectValue placeholder="Optionnel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucun</SelectItem>
            {territories.map((territory) => <SelectItem key={territory.id} value={territory.id}>{territory.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 lg:col-span-2">
        <Label>Agent</Label>
        <Select name="userId" defaultValue="none">
          <SelectTrigger className="w-full"><SelectValue placeholder="Optionnel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucun</SelectItem>
            {agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 lg:col-span-3">
        <Label>Note</Label>
        <Textarea name="note" rows={2} placeholder="Contexte, arbitrage, hypothèse terrain…" />
      </div>
      <div className="lg:col-span-3">
        <Button disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer l’objectif"}</Button>
      </div>
    </form>
  );
}
