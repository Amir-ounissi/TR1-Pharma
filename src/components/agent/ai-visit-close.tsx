"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Mic,
  Pencil,
  Send,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  analyzeVisitCloseAction,
  completeVisitWithAssistantAction,
  getVisitCloseAvailabilityAction,
} from "@/app/(protected)/dashboard/pharmacies/visit-close-ai-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

const OUTCOMES = [
  ["very_good", "Très bien"],
  ["good", "Bien"],
  ["follow_up", "À revoir"],
  ["problem", "Problème"],
] as const;

const NEXT_VISITS = [
  ["none", "Pas de prochain passage"],
  ["week1", "Dans 1 semaine"],
  ["weeks2", "Dans 2 semaines"],
  ["month1", "Dans 1 mois"],
] as const;

const TAG_LABELS: Record<string, string> = {
  order: "Commande",
  merchandising: "Merchandising",
  stockout: "Rupture",
  competitor: "Concurrent",
  callback: "Relance",
  problem: "Problème",
};

type Outcome = (typeof OUTCOMES)[number][0];
type NextVisit = (typeof NEXT_VISITS)[number][0] | "custom";
type Feedback = { kind: "error" | "warning"; text: string } | null;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function outcomeLabel(value: Outcome) {
  return OUTCOMES.find(([item]) => item === value)?.[1] ?? "Bien";
}

function nextVisitLabel(value: NextVisit, customNext: string) {
  if (value === "custom") {
    if (!customNext) return "Date à préciser";
    const parsed = new Date(customNext);
    if (Number.isNaN(parsed.getTime())) return "Date à préciser";
    return parsed.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return NEXT_VISITS.find(([item]) => item === value)?.[1] ?? "Pas de prochain passage";
}

export function AiVisitClose({ brandPharmacyId }: { brandPharmacyId: string }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("good");
  const [nextVisit, setNextVisit] = useState<NextVisit>("none");
  const [customNext, setCustomNext] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [lastAnalyzedNote, setLastAnalyzedNote] = useState("");
  const [checking, setChecking] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    void getVisitCloseAvailabilityAction(brandPharmacyId).then((result) => {
      if (cancelled) return;
      setVisitId(result.active ? result.visitId ?? null : null);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [brandPharmacyId]);

  if (checking || !visitId) return null;

  const normalizedNote = note.trim();
  const aiDraftCurrent = Boolean(summary && normalizedNote && normalizedNote === lastAnalyzedNote);
  const canSend = Boolean(normalizedNote && !analyzing && normalizedNote !== lastAnalyzedNote);

  async function analyze() {
    if (!visitId || !canSend) return;
    setAnalyzing(true);
    setFeedback(null);
    setEditing(false);
    setShowDetails(false);

    const result = await analyzeVisitCloseAction(brandPharmacyId, visitId, normalizedNote);
    setAnalyzing(false);

    if (!result.draft) {
      setEditing(true);
      setFeedback({
        kind: "warning",
        text: result.error || "Je n’ai pas réussi à analyser cette visite. Réessaie ou utilise la clôture classique.",
      });
      return;
    }

    setSummary(result.draft.summary);
    setOutcome(result.draft.outcome);
    setNextVisit(result.draft.next);
    setCustomNext(result.draft.customNext ?? "");
    setTags(result.draft.tags);
    setLastAnalyzedNote(normalizedNote);
  }

  function startDictation() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      textareaRef.current?.focus();
      setFeedback({ kind: "warning", text: "Utilise le micro du clavier pour dicter ton message." });
      return;
    }

    const recognition = new Constructor();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
      if (transcript) {
        setNote((current) => `${current}${current ? " " : ""}${transcript}`);
        setFeedback(null);
      }
    };
    recognition.onend = () => setDictating(false);
    recognition.onerror = () => {
      setDictating(false);
      textareaRef.current?.focus();
      setFeedback({ kind: "warning", text: "La dictée n’a pas démarré. Utilise le micro du clavier." });
    };
    setDictating(true);
    recognition.start();
  }

  function editMessage() {
    setEditing(true);
    setFeedback(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function complete() {
    if (!visitId || saving || !aiDraftCurrent || (nextVisit === "custom" && !customNext)) return;
    setSaving(true);
    setFeedback(null);

    const result = await completeVisitWithAssistantAction({
      brandPharmacyId,
      visitId,
      outcome,
      next: nextVisit,
      customNext: nextVisit === "custom" ? customNext : undefined,
      note: summary,
      tags,
    });

    setSaving(false);
    if (result.error) {
      setFeedback({ kind: "error", text: result.error });
      return;
    }
    if (result.warning) {
      setFeedback({ kind: "warning", text: result.warning });
      return;
    }

    setVisitId(null);
    setOpen(false);
    router.refresh();
  }

  const showComposer = !summary || editing || !aiDraftCurrent;

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 rounded-xl border border-[var(--tr1-orange)]/35 bg-[var(--tr1-orange)]/5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--tr1-navy)]">
            <Sparkles className="size-4 text-[var(--tr1-orange)]" />
            TR1 Assistant · visite en cours
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Raconte ta visite. TR1 s’occupe de la clôture.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Parler à TR1
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[94dvh] min-h-[72dvh] flex-col rounded-t-2xl px-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="border-b px-4 pb-3">
            <SheetTitle className="flex items-center gap-2 text-left">
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--tr1-orange)]/10">
                <Sparkles className="size-4 text-[var(--tr1-orange)]" />
              </span>
              TR1 Assistant
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr1-navy)] text-white">
                <Sparkles className="size-4" />
              </div>
              <div className="max-w-[86%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm text-[var(--tr1-navy)]">
                <p className="font-semibold">Comment s’est passée ta visite ?</p>
                <p className="mt-1 text-muted-foreground">Dis-moi simplement ce qui s’est passé : commande, objection, prochaine action, animation…</p>
              </div>
            </div>

            {lastAnalyzedNote ? (
              <div className="flex justify-end">
                <div className="max-w-[86%] rounded-2xl rounded-tr-md bg-[var(--tr1-orange)] px-4 py-3 text-sm text-white">
                  {lastAnalyzedNote}
                </div>
              </div>
            ) : null}

            {analyzing ? (
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr1-navy)] text-white">
                  <Sparkles className="size-4" />
                </div>
                <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                  J’analyse la visite…
                </div>
              </div>
            ) : null}

            {feedback ? (
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr1-navy)] text-white">
                  <Sparkles className="size-4" />
                </div>
                <div
                  role="status"
                  className={
                    feedback.kind === "error"
                      ? "max-w-[86%] rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                      : "max-w-[86%] rounded-2xl rounded-tl-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  }
                >
                  {feedback.text}
                </div>
              </div>
            ) : null}

            {summary && aiDraftCurrent && !analyzing ? (
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr1-navy)] text-white">
                  <Sparkles className="size-4" />
                </div>
                <div className="max-w-[90%] space-y-3 rounded-2xl rounded-tl-md border bg-background px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-[var(--tr1-navy)]">J’ai compris :</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">{summary}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/70 p-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Résultat</p>
                      <p className="mt-0.5 text-sm font-bold text-[var(--tr1-navy)]">{outcomeLabel(outcome)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/70 p-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prochain passage</p>
                      <p className="mt-0.5 text-sm font-bold text-[var(--tr1-navy)]">{nextVisitLabel(nextVisit, customNext)}</p>
                    </div>
                  </div>

                  {tags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[var(--tr1-orange)]/10 px-2.5 py-1 text-xs font-medium text-[var(--tr1-navy)]">
                          {TAG_LABELS[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="text-xs text-muted-foreground">Je peux enregistrer ce compte rendu et clôturer la visite.</p>
                </div>
              </div>
            ) : null}

            {summary && aiDraftCurrent ? (
              <div className="space-y-2 pl-10">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={editMessage}>
                    <Pencil className="size-4" /> Modifier
                  </Button>
                  <Button type="button" disabled={saving || (nextVisit === "custom" && !customNext)} onClick={() => void complete()}>
                    <CheckCircle2 className="size-4" /> {saving ? "Clôture…" : "Valider et clôturer"}
                  </Button>
                </div>
                <Button type="button" variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowDetails((value) => !value)}>
                  <SlidersHorizontal className="size-3.5" /> {showDetails ? "Masquer les corrections" : "Corriger les détails"}
                </Button>
              </div>
            ) : null}

            {showDetails && summary && aiDraftCurrent ? (
              <div className="ml-10 space-y-4 rounded-xl border bg-muted/20 p-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Résultat</p>
                  <div className="grid grid-cols-2 gap-2">
                    {OUTCOMES.map(([value, label]) => (
                      <Button key={value} type="button" size="sm" variant={outcome === value ? "default" : "outline"} onClick={() => setOutcome(value)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prochain passage</p>
                  <div className="grid grid-cols-2 gap-2">
                    {NEXT_VISITS.map(([value, label]) => (
                      <Button key={value} type="button" size="sm" variant={nextVisit === value ? "default" : "outline"} onClick={() => setNextVisit(value)}>
                        {label}
                      </Button>
                    ))}
                    <Button type="button" size="sm" variant={nextVisit === "custom" ? "default" : "outline"} onClick={() => setNextVisit("custom")}>
                      Choisir une date
                    </Button>
                  </div>
                  {nextVisit === "custom" ? (
                    <Input className="mt-3" type="datetime-local" value={customNext} onChange={(event) => setCustomNext(event.target.value)} />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {showComposer ? (
            <div className="border-t bg-background px-4 pt-3">
              <div className="rounded-2xl border bg-background p-2 shadow-sm focus-within:border-[var(--tr1-orange)]/60">
                <Textarea
                  ref={textareaRef}
                  value={note}
                  maxLength={2000}
                  rows={2}
                  className="min-h-14 resize-none border-0 bg-transparent px-2 py-1 text-base shadow-none focus-visible:ring-0"
                  placeholder="Raconte ta visite à TR1…"
                  onChange={(event) => {
                    setNote(event.target.value);
                    setFeedback(null);
                  }}
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button type="button" size="sm" variant="ghost" onClick={startDictation}>
                    <Mic className="size-4" /> {dictating ? "J’écoute…" : "Dicter"}
                  </Button>
                  <Button type="button" size="icon" aria-label="Envoyer à TR1" disabled={!canSend} onClick={() => void analyze()}>
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
