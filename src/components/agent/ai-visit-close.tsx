"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Mic, Sparkles } from "lucide-react";
import {
  analyzeVisitCloseAction,
  completeVisitWithAssistantAction,
  getVisitCloseAvailabilityAction,
} from "@/app/(protected)/dashboard/pharmacies/visit-close-ai-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ["none", "Pas maintenant"],
  ["week1", "Dans 1 semaine"],
  ["weeks2", "Dans 2 semaines"],
  ["month1", "Dans 1 mois"],
] as const;

type Outcome = (typeof OUTCOMES)[number][0];
type NextVisit = (typeof NEXT_VISITS)[number][0] | "custom";
type Feedback = { kind: "error" | "warning" | "success"; text: string } | null;

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
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
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

  async function analyze() {
    if (!visitId || !normalizedNote || analyzing) return;
    if (aiDraftCurrent) return;
    setAnalyzing(true);
    setFeedback(null);
    const result = await analyzeVisitCloseAction(brandPharmacyId, visitId, normalizedNote);
    setAnalyzing(false);
    if (!result.draft) {
      setFeedback({
        kind: "warning",
        text: result.error || "TR1 n’a pas pu préparer la clôture. La saisie manuelle reste disponible.",
      });
      return;
    }
    setSummary(result.draft.summary);
    setOutcome(result.draft.outcome);
    setNextVisit(result.draft.next);
    setCustomNext(result.draft.customNext ?? "");
    setTags(result.draft.tags);
    setLastAnalyzedNote(normalizedNote);
    setFeedback({ kind: "success", text: "Compte rendu préparé. Vérifiez puis validez." });
  }

  function startDictation() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      textareaRef.current?.focus();
      setFeedback({ kind: "warning", text: "Utilisez le micro du clavier pour dicter votre compte rendu." });
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
      if (transcript) setNote((current) => `${current}${current ? " " : ""}${transcript}`);
    };
    recognition.onend = () => setDictating(false);
    recognition.onerror = () => {
      setDictating(false);
      textareaRef.current?.focus();
      setFeedback({ kind: "warning", text: "La dictée n’a pas démarré. Utilisez le micro du clavier." });
    };
    setDictating(true);
    recognition.start();
  }

  async function complete() {
    if (!visitId || saving || (nextVisit === "custom" && !customNext)) return;
    setSaving(true);
    setFeedback(null);
    const useAiDraft = normalizedNote === lastAnalyzedNote && Boolean(summary);
    const result = await completeVisitWithAssistantAction({
      brandPharmacyId,
      visitId,
      outcome,
      next: nextVisit,
      customNext: nextVisit === "custom" ? customNext : undefined,
      note: useAiDraft ? summary : normalizedNote || undefined,
      tags: useAiDraft ? tags : [],
    });
    setSaving(false);
    if (result.error) {
      setFeedback({ kind: "error", text: result.error });
      return;
    }
    if (result.warning) {
      setFeedback({ kind: "warning", text: result.warning });
    }
    setVisitId(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 rounded-xl border border-[var(--tr1-orange)]/35 bg-[var(--tr1-orange)]/5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--tr1-navy)]">
            <Sparkles className="size-4 text-[var(--tr1-orange)]" />
            TR1 Assistant · visite en cours
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Dictez quelques mots, TR1 prépare la clôture et le compte rendu.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Clôturer sans saisie
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[94dvh] overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Clôturer avec TR1 Assistant</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ai-visit-close-note">En deux phrases, que s’est-il passé ?</Label>
                <Button type="button" size="sm" variant={dictating ? "default" : "outline"} onClick={startDictation}>
                  <Mic className="size-4" /> {dictating ? "J’écoute…" : "Dicter"}
                </Button>
              </div>
              <Textarea
                ref={textareaRef}
                id="ai-visit-close-note"
                value={note}
                maxLength={2000}
                rows={4}
                className="text-base"
                placeholder="Ex. Commande 12 unités. Sommeil à revoir car stock concurrent. Elle veut une animation en octobre et un rappel dans 2 semaines."
                onChange={(event) => {
                  setNote(event.target.value);
                  setFeedback(null);
                }}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Aucune analyse automatique : l’API est appelée uniquement quand vous le demandez.</p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!normalizedNote || analyzing || aiDraftCurrent}
                  onClick={() => void analyze()}
                >
                  <Sparkles className="size-4" />
                  {analyzing ? "Analyse…" : aiDraftCurrent ? "Prérempli" : "Préremplir avec TR1"}
                </Button>
              </div>
            </div>

            {feedback ? (
              <div
                role="status"
                className={
                  feedback.kind === "error"
                    ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    : feedback.kind === "warning"
                      ? "rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                      : "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                }
              >
                {feedback.text}
              </div>
            ) : null}

            {summary ? (
              <div className={aiDraftCurrent ? "rounded-xl border border-emerald-200 bg-emerald-50/60 p-3" : "rounded-xl border bg-muted/40 p-3"}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Compte rendu TR1</p>
                <p className="mt-1 text-sm text-[var(--tr1-navy)]">{summary}</p>
                {!aiDraftCurrent ? <p className="mt-2 text-xs text-amber-700">La note a été modifiée. Relancez le préremplissage pour actualiser ce résumé.</p> : null}
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-medium">Résultat de la visite</p>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map(([value, label]) => (
                  <Button key={value} type="button" variant={outcome === value ? "default" : "outline"} onClick={() => setOutcome(value)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Prochain passage</p>
              <div className="grid grid-cols-2 gap-2">
                {NEXT_VISITS.map(([value, label]) => (
                  <Button key={value} type="button" variant={nextVisit === value ? "default" : "outline"} onClick={() => setNextVisit(value)}>
                    {label}
                  </Button>
                ))}
                <Button type="button" variant={nextVisit === "custom" ? "default" : "outline"} onClick={() => setNextVisit("custom")}>
                  Choisir une date
                </Button>
              </div>
              {nextVisit === "custom" ? (
                <Input className="mt-3" type="datetime-local" value={customNext} onChange={(event) => setCustomNext(event.target.value)} />
              ) : null}
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={saving || (nextVisit === "custom" && !customNext)}
              onClick={() => void complete()}
            >
              <CheckCircle2 className="size-5" />
              {saving ? "Clôture…" : "Valider et clôturer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
