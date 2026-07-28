"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronRight, Map, MessageSquareText, Pencil, Search, Send, X } from "lucide-react";
import {
  assistantOpenedAction,
  cancelAssistantDraftAction,
  confirmAssistantDraftAction,
  modifyAssistantDraftAction,
  searchAssistantPharmaciesAction,
  sendAssistantMessageAction,
} from "@/app/(protected)/dashboard/agent/assistant/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { presentationLabel } from "@/lib/presentation";
import type { AssistantResponse, PharmacyMatch } from "@/lib/assistant/assistant-schemas";

type ConversationEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: AssistantResponse;
};

function formatDate(value: unknown) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(new Date(String(value)));
}

function toLocalInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function DraftCard({
  response,
  onResponse,
}: {
  response: Extract<AssistantResponse, { kind: "draft" }>;
  onResponse(response: AssistantResponse): void;
}) {
  const { draft, pharmacy } = response;
  const payload = draft.payload;
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pharmacyQuery, setPharmacyQuery] = useState(pharmacy.pharmacy_name);
  const [pharmacyOptions, setPharmacyOptions] = useState<PharmacyMatch[]>([pharmacy]);
  const [brandPharmacyId, setBrandPharmacyId] = useState(pharmacy.brand_pharmacy_id);
  const [notes, setNotes] = useState(String(payload.notes ?? payload.description ?? ""));
  const [actionKind, setActionKind] = useState(String(payload.next_action_type ?? payload.task_type ?? "call"));
  const [outcome, setOutcome] = useState(String(payload.outcome ?? "completed"));
  const [dueAt, setDueAt] = useState(toLocalInput(payload.next_action_at ?? payload.due_at));

  function confirm() {
    startTransition(async () => onResponse(await confirmAssistantDraftAction(draft.id)));
  }

  function cancel() {
    startTransition(async () => onResponse(await cancelAssistantDraftAction(draft.id)));
  }

  function searchPharmacies() {
    startTransition(async () => {
      const matches = await searchAssistantPharmaciesAction(pharmacyQuery) as PharmacyMatch[];
      setPharmacyOptions(matches);
      if (matches.length === 1) setBrandPharmacyId(matches[0].brand_pharmacy_id);
    });
  }

  function save() {
    const isTask = draft.action_type === "task";
    const nextPayload = isTask
      ? {
          task_type: actionKind,
          title: String(payload.title),
          description: notes,
          priority: String(payload.priority ?? "normal"),
          due_at: new Date(dueAt).toISOString(),
        }
      : {
          interaction_type: String(payload.interaction_type),
          outcome,
          subject: String(payload.subject),
          notes,
          occurred_at: String(payload.occurred_at),
          ...(draft.action_type === "interaction_with_next_action"
            ? { next_action_type: actionKind, next_action_at: new Date(dueAt).toISOString() }
            : {}),
        };
    startTransition(async () => {
      const result = await modifyAssistantDraftAction(draft.id, brandPharmacyId, nextPayload);
      if (result.kind === "draft") setEditing(false);
      onResponse(result);
    });
  }

  return (
    <Card data-testid="assistant-draft" className="border-[#ee8f45]/50 bg-[#fff9ed] shadow-sm">
      <CardHeader className="pb-3">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b45a19]">Compte rendu préparé</p>
        <CardTitle className="text-xl text-[#0f2740]">{pharmacy.pharmacy_name}</CardTitle>
        <p className="text-sm text-muted-foreground">{pharmacy.city}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Action</p><p className="font-medium">{presentationLabel(draft.action_type)}</p></div>
            {"outcome" in payload && <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Résultat</p><p className="font-medium">{presentationLabel(String(payload.outcome))}</p></div>}
            <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Note</p><p className="whitespace-pre-wrap font-medium">{String(payload.notes ?? payload.description ?? "")}</p></div>
            {Boolean(payload.next_action_at || payload.due_at) && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Prochaine action</p>
                <p className="font-medium">{presentationLabel(String(payload.next_action_type ?? payload.task_type))} — {formatDate(payload.next_action_at ?? payload.due_at)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4" data-testid="assistant-draft-editor">
            <div className="space-y-2">
              <Label htmlFor={`pharmacy-${draft.id}`}>Pharmacie</Label>
              <div className="flex gap-2">
                <Input id={`pharmacy-${draft.id}`} value={pharmacyQuery} onChange={(event) => setPharmacyQuery(event.target.value)} />
                <Button type="button" variant="outline" size="icon" onClick={searchPharmacies} disabled={pending}><Search className="size-4" /><span className="sr-only">Rechercher</span></Button>
              </div>
              {pharmacyOptions.length > 0 && (
                <Select value={brandPharmacyId} onValueChange={setBrandPharmacyId}>
                  <SelectTrigger aria-label="Pharmacie sélectionnée"><SelectValue /></SelectTrigger>
                  <SelectContent>{pharmacyOptions.map((option) => <SelectItem key={option.brand_pharmacy_id} value={option.brand_pharmacy_id}>{option.pharmacy_name} — {option.city}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            {"outcome" in payload && (
              <div className="space-y-2">
                <Label>Résultat</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger aria-label="Résultat de l’interaction"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Terminée</SelectItem>
                    <SelectItem value="interested">Intéressée</SelectItem>
                    <SelectItem value="decision_pending">Décision en attente</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label htmlFor={`notes-${draft.id}`}>Note</Label><Textarea id={`notes-${draft.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} /></div>
            {Boolean(payload.next_action_at || payload.due_at) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type d’action</Label>
                  <Select value={actionKind} onValueChange={setActionKind}>
                    <SelectTrigger aria-label="Type de prochaine action"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Appel</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="visit">Visite</SelectItem>
                      <SelectItem value="follow_up">Relance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label htmlFor={`due-${draft.id}`}>Date et heure</Label><Input id={`due-${draft.id}`} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div>
              </div>
            )}
            <div className="flex gap-2"><Button type="button" onClick={save} disabled={pending}>Enregistrer les modifications</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Fermer</Button></div>
          </div>
        )}
        {!editing && (
          <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:grid-cols-3">
            <Button type="button" className="min-h-11 bg-[#0f5b78] hover:bg-[#0c4960]" onClick={confirm} disabled={pending}><Check className="size-4" />Confirmer</Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(true)} disabled={pending}><Pencil className="size-4" />Modifier</Button>
            <Button type="button" variant="ghost" className="min-h-11 text-destructive" onClick={cancel} disabled={pending}><X className="size-4" />Annuler</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssistantReply({ response, onResponse }: { response: AssistantResponse; onResponse(response: AssistantResponse): void }) {
  if (response.kind === "draft") return <DraftCard response={response} onResponse={onResponse} />;
  if (response.kind === "disambiguation") {
    return (
      <div className="space-y-3">
        <p>{response.message}</p>
        <div className="space-y-2">{response.choices.map((choice) => (
          <Button
            key={choice.brand_pharmacy_id}
            type="button"
            variant="outline"
            className="h-auto w-full justify-between px-4 py-3 text-left"
            onClick={async () => onResponse(await sendAssistantMessageAction(response.originalMessage, Intl.DateTimeFormat().resolvedOptions().timeZone, choice.brand_pharmacy_id))}
          >
            <span><span className="block font-medium">{choice.pharmacy_name}</span><span className="block text-xs text-muted-foreground">{choice.address_line_1} · {choice.city}</span></span>
            <ChevronRight className="size-4" />
          </Button>
        ))}</div>
      </div>
    );
  }
  if (response.kind === "answer" && response.details) {
    const details = response.details;
    return (
      <div className="space-y-3">
        <p>{response.message}</p>
        {"pharmacy" in details && (
          <div className="rounded-xl border bg-background p-4 text-sm">
            <p className="font-semibold text-[#0f2740]">{String(details.pharmacy)}</p>
            <p className="mt-1 text-muted-foreground">{formatDate(details.scheduledAt)}</p>
            <p className="mt-2">{String(details.address ?? "")}</p>
            <p className="mt-2"><span className="font-medium">Objectif :</span> {String(details.objective ?? "Non renseigné")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><a href={String(details.wazeUrl)} target="_blank" rel="noreferrer">Waze</a></Button>
              <Button asChild size="sm" variant="outline"><a href={String(details.mapsUrl)} target="_blank" rel="noreferrer"><Map className="size-4" />Maps</a></Button>
            </div>
          </div>
        )}
        {"status" in details && (
          <div className="grid gap-2 rounded-xl border bg-background p-4 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Statut :</span> {String(details.status)}</p>
            <p><span className="text-muted-foreground">Potentiel :</span> {String(details.potential)}</p>
            <p><span className="text-muted-foreground">Dernière commande :</span> {formatDate(details.lastOrderAt)}</p>
            <p><span className="text-muted-foreground">Prochaine action :</span> {formatDate(details.nextActionAt)}</p>
          </div>
        )}
      </div>
    );
  }
  return <p className={response.kind === "error" ? "text-destructive" : ""}>{response.message}</p>;
}

export function AssistantConsole({ brandName, firstName }: { brandName: string; firstName: string }) {
  const [message, setMessage] = useState("");
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void assistantOpenedAction();
  }, []);

  function appendResponse(response: AssistantResponse) {
    setEntries((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: response.message, response }]);
  }

  function send() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setEntries((current) => [...current, { id: crypto.randomUUID(), role: "user", text: trimmed }]);
    setMessage("");
    startTransition(async () => {
      appendResponse(await sendAssistantMessageAction(trimmed, Intl.DateTimeFormat().resolvedOptions().timeZone));
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="overflow-hidden border-[#d9d0bf] bg-[#fffdf7]">
        <CardHeader className="border-b bg-[#f6efe2]">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[#0f2740] text-[#fffaf0]"><MessageSquareText className="size-5" /></span>
            <div><CardTitle className="text-lg text-[#0f2740]">Conversation terrain</CardTitle><p className="text-sm text-muted-foreground">{brandName} · session privée</p></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div aria-live="polite" className="min-h-72 space-y-4" data-testid="assistant-history">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-[#edf4f7] p-4 text-sm text-[#173a51]">
              Bonjour {firstName}. Je peux consulter votre terrain ou préparer une action soumise à votre confirmation.
            </div>
            {entries.map((entry) => (
              <div key={entry.id} className={entry.role === "user" ? "ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#0f2740] p-4 text-sm text-[#fffaf0]" : "max-w-[96%] rounded-2xl rounded-tl-sm bg-[#edf4f7] p-4 text-sm text-[#173a51]"}>
                {entry.response ? <AssistantReply response={entry.response} onResponse={appendResponse} /> : entry.text}
              </div>
            ))}
            {pending && <div className="max-w-[88%] rounded-2xl bg-[#edf4f7] p-4 text-sm text-muted-foreground">Analyse du contexte autorisé…</div>}
          </div>
          <div className="border-t pt-4">
            <Label htmlFor="assistant-message" className="sr-only">Votre demande terrain</Label>
            <Textarea
              id="assistant-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              maxLength={1200}
              placeholder="Ex. Quelle est ma prochaine visite ?"
              className="min-h-24 resize-none bg-background"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Aucune écriture sans confirmation.</p>
              <Button type="button" className="min-h-11 bg-[#d96f28] hover:bg-[#bd5d20]" onClick={send} disabled={pending || !message.trim()}><Send className="size-4" />Envoyer</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <aside className="space-y-3">
        <Card className="border-[#d9d0bf] bg-[#f6efe2]"><CardContent className="p-4 text-sm"><p className="font-semibold text-[#0f2740]">Cadre sécurisé</p><ul className="mt-2 space-y-2 text-muted-foreground"><li>Lecture limitée à votre périmètre.</li><li>Brouillon persistant pendant 30 minutes.</li><li>Confirmation obligatoire et idempotente.</li></ul></CardContent></Card>
      </aside>
    </div>
  );
}
