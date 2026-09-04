"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  assignMissionAction,
  changeMissionStatusAction,
  createMissionAction,
  saveReportAction,
  scheduleMissionAction,
} from "@/app/(protected)/dashboard/missions/actions";
import { trackProductEventAction } from "@/app/(protected)/dashboard/agent/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { missionTypes } from "@/lib/missions";
import { uiLabel } from "@/lib/ui-copy";
import {
  clearDraft,
  draftKey,
  loadDraft,
  saveDraft,
} from "@/lib/local-draft";

type Option = {
  id: string;
  label: string;
  detail?: string;
};

export function MissionForm({
  pharmacies,
  products,
}: {
  pharmacies: Option[];
  products: Option[];
}) {
  const [state, action, pending] = useActionState(createMissionAction, {});

  return (
    <form action={action} className="space-y-5">
      <ActionFeedback {...state} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Pharmacie">
          <Select name="brandPharmacyId" required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choisir une pharmacie" />
            </SelectTrigger>
            <SelectContent>
              {pharmacies.map((item) => (
                <SelectItem value={item.id} key={item.id}>
                  {item.label}
                  {item.detail ? ` · ${item.detail}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Type">
          <Select name="missionType" defaultValue="animation">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {missionTypes.map((type) => (
                <SelectItem value={type} key={type}>
                  {uiLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Titre">
          <Input name="title" required />
        </Field>

        <Field label="Priorité">
          <Select name="priority" defaultValue="normal">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["low", "normal", "high", "urgent"].map((value) => (
                <SelectItem key={value} value={value}>
                  {uiLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Créneau souhaité">
          <Input name="scheduledStartAt" type="datetime-local" />
        </Field>

        <Field label="Fin souhaitée">
          <Input name="scheduledEndAt" type="datetime-local" />
        </Field>

        <Field label="Mode">
          <Select name="locationMode" defaultValue="in_pharmacy">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["in_pharmacy", "remote", "hybrid", "external_event"].map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {uiLabel(value)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Budget estimé HT">
          <Input
            name="costEstimatedHt"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Objectif">
            <Textarea name="objective" required />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Consignes">
            <Textarea name="briefing" className="min-h-32" />
          </Field>
        </div>
      </div>

      <div>
        <Label>Produits concernés</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {products.map((item) => (
            <label
              className="flex items-center gap-2 rounded-md border p-3 text-sm"
              key={item.id}
            >
              <input type="checkbox" name="productId" value={item.id} />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        La création enregistre une demande. L’affectation de l’intervenant et
        la planification définitive sont réalisées ensuite par TR1.
      </p>

      <Button disabled={pending}>
        {pending ? "Création…" : "Envoyer la demande de mission"}
      </Button>
    </form>
  );
}

export function MissionAssignmentForm({
  missionId,
  users,
}: {
  missionId: string;
  users: Option[];
}) {
  const [state, action, pending] = useActionState(assignMissionAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="missionId" value={missionId} />
      <ActionFeedback {...state} />

      <Field label="Intervenant">
        <Select name="assignedUserId" required>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choisir un intervenant" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.label}
                {user.detail ? ` · ${user.detail}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Button disabled={pending} className="w-full">
        {pending ? "Affectation…" : "Affecter la mission"}
      </Button>
    </form>
  );
}

export function MissionScheduleForm({
  missionId,
  defaultStart,
  defaultEnd,
}: {
  missionId: string;
  defaultStart?: string | null;
  defaultEnd?: string | null;
}) {
  const [state, action, pending] = useActionState(scheduleMissionAction, {});

  const toLocal = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="missionId" value={missionId} />
      <ActionFeedback {...state} />

      <Field label="Début confirmé">
        <Input
          name="scheduledStartAt"
          type="datetime-local"
          defaultValue={toLocal(defaultStart)}
          required
        />
      </Field>

      <Field label="Fin confirmée">
        <Input
          name="scheduledEndAt"
          type="datetime-local"
          defaultValue={toLocal(defaultEnd)}
        />
      </Field>

      <Button disabled={pending} className="w-full">
        {pending ? "Planification…" : "Confirmer la planification"}
      </Button>
    </form>
  );
}

export function MissionStatusForm({
  missionId,
  options,
}: {
  missionId: string;
  options: string[];
}) {
  const [state, action, pending] = useActionState(
    changeMissionStatusAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="missionId" value={missionId} />
      <ActionFeedback {...state} />

      <Select name="status" required>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Nouvelle étape" />
        </SelectTrigger>
        <SelectContent>
          {options.map((value) => (
            <SelectItem key={value} value={value}>
              {uiLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        name="reason"
        placeholder="Motif obligatoire pour refus, annulation ou absence"
      />

      <Button disabled={pending} className="w-full">
        Mettre à jour
      </Button>
    </form>
  );
}

export function MissionReportForm({
  missionId,
  missionType,
  pharmacyId,
  report,
  draftScope,
}: {
  missionId: string;
  missionType: string;
  pharmacyId: string;
  report?: Record<string, unknown> | null;
  draftScope?: string;
}) {
  const [state, action, pending] = useActionState(saveReportAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const started = useRef(false);
  const key = draftKey("report", missionId);
  const value = (field: string) => String(report?.[field] ?? "");

  useEffect(() => {
    const restored = loadDraft<Record<string, string>>(localStorage, key, {
      contextKey: draftScope,
    });

    if (!restored) return;

    const timer = window.setTimeout(() => {
      const form = formRef.current;
      if (!form) return;

      for (const [name, restoredValue] of Object.entries(restored)) {
        const control = form.elements.namedItem(name);
        if (
          control instanceof HTMLInputElement ||
          control instanceof HTMLTextAreaElement ||
          control instanceof HTMLSelectElement
        ) {
          control.value = restoredValue;
        }
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [draftScope, key]);

  useEffect(() => {
    if (state.success) clearDraft(localStorage, key);
  }, [key, state.success]);

  function preserveDraft() {
    if (!formRef.current) return;

    saveDraft(
      localStorage,
      key,
      Object.fromEntries(new FormData(formRef.current).entries()),
      {
        ttlHours: 72,
        contextKey: draftScope,
      },
    );
  }

  function markStarted() {
    if (started.current) return;
    started.current = true;
    void trackProductEventAction("report_started", pharmacyId);
  }

  return (
    <form
      ref={formRef}
      action={action}
      onInput={preserveDraft}
      onFocusCapture={markStarted}
      className="space-y-4"
    >
      <input type="hidden" name="missionId" value={missionId} />
      <input type="hidden" name="missionType" value={missionType} />

      <ActionFeedback {...state} />

      <Field label="Synthèse">
        <Textarea
          name="summary"
          defaultValue={value("summary")}
          className="min-h-28"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {missionType === "animation" ? (
          <>
            <Field label="Unités vendues">
              <Input
                name="unitsSold"
                type="number"
                min="0"
                defaultValue={value("units_sold")}
              />
            </Field>
            <Field label="Durée (minutes)">
              <Input
                name="durationMinutes"
                type="number"
                min="1"
                defaultValue={value("duration_minutes")}
              />
            </Field>
            <Field label="Contacts clients">
              <Input
                name="customerContacts"
                type="number"
                min="0"
                defaultValue={value("customer_contacts")}
              />
            </Field>
            <Field label="Ventes TTC">
              <Input
                name="netSalesTtc"
                type="number"
                min="0"
                step="0.01"
                defaultValue={value("net_sales_ttc")}
              />
            </Field>
          </>
        ) : null}

        {missionType === "training" ? (
          <>
            <Field label="Participants">
              <Input
                name="participantCount"
                type="number"
                min="0"
                defaultValue={value("participant_count")}
              />
            </Field>
            <Field label="Durée (minutes)">
              <Input
                name="durationMinutes"
                type="number"
                min="1"
                defaultValue={value("duration_minutes")}
              />
            </Field>
            <Field label="Connaissance avant %">
              <Input
                name="knowledgeBefore"
                type="number"
                min="0"
                max="100"
                defaultValue={value("knowledge_before")}
              />
            </Field>
            <Field label="Connaissance après %">
              <Input
                name="knowledgeAfter"
                type="number"
                min="0"
                max="100"
                defaultValue={value("knowledge_after")}
              />
            </Field>
          </>
        ) : null}

        {[
          "commercial_visit",
          "prospecting_visit",
          "relationship_visit",
          "reactivation",
        ].includes(missionType) ? (
          <>
            <Field label="Contact rencontré">
              <Input name="contactMet" defaultValue={value("contact_met")} />
            </Field>
            <Field label="Résultat">
              <Input
                name="meetingOutcome"
                defaultValue={value("meeting_outcome")}
              />
            </Field>
            <Field label="Commande attendue HT">
              <Input
                name="estimatedOrderAmountHt"
                type="number"
                min="0"
                defaultValue={value("estimated_order_amount_ht")}
              />
            </Field>
          </>
        ) : null}
      </div>

      <Field label="Retour pharmacie">
        <Textarea
          name="pharmacyFeedback"
          defaultValue={value("pharmacy_feedback")}
        />
      </Field>

      <Field label="Opportunités">
        <Textarea name="opportunities" defaultValue={value("opportunities")} />
      </Field>

      <div className="flex gap-2">
        <Button
          name="reportStatus"
          value="draft"
          variant="outline"
          disabled={pending}
        >
          Enregistrer
        </Button>
        <Button
          name="reportStatus"
          value="submitted"
          disabled={pending}
        >
          Soumettre à TR1
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        La soumission fait automatiquement passer la mission en attente de
        validation du rapport.
      </p>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
