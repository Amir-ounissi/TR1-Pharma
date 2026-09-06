"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardPenLine,
  Images,
  MapPinned,
  Mic,
  Navigation,
  Phone,
  Play,
  ShoppingCart,
  Square,
} from "lucide-react";
import {
  completeVisitAction,
  createQuickNoteAction,
  quickPlanVisitAction,
  startVisitAction,
} from "@/app/(protected)/dashboard/pharmacies/quick-actions";
import { TrackedLink } from "@/components/agent/tracked-link";
import { Badge } from "@/components/ui/badge";
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
import {
  buildGoogleMapsUrl,
  buildWazeUrl,
  type NavigablePharmacy,
} from "@/lib/agent-experience";

type ActiveVisit = {
  id: string;
  status: "planned" | "confirmed" | "in_progress";
  scheduledStartAt: string;
};

type TerrainPharmacyHeaderProps = {
  brandPharmacyId: string;
  pharmacyId: string;
  name: string;
  phone?: string | null;
  address: string;
  status: string;
  potential: string;
  lastOrderAt?: string | null;
  nextActionType?: string | null;
  nextActionAt?: string | null;
  objective?: string;
  navigation: NavigablePharmacy;
  activeVisit?: ActiveVisit | null;
  canQuickVisit?: boolean;
  canCreateOrder?: boolean;
};

type Feedback = { kind: "success" | "error" | "warning"; text: string } | null;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const TAGS = [
  ["order", "Commande"],
  ["merchandising", "Merchandising"],
  ["stockout", "Rupture"],
  ["competitor", "Concurrent"],
  ["callback", "À rappeler"],
  ["problem", "Problème"],
] as const;

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

function date(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

function dateTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(value))
    : "—";
}

async function compressNotePhoto(file: File) {
  if (file.size <= 900_000) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image_decode_failed"));
      image.src = url;
    });
    const largest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1600 / largest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    for (const quality of [0.78, 0.65, 0.52]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 900_000) {
        return new File([blob], `${base}.jpg`, {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }
    }
    throw new Error("image_too_large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function TerrainPharmacyHeader(props: TerrainPharmacyHeaderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [customPlanAt, setCustomPlanAt] = useState("");
  const [customNextAt, setCustomNextAt] = useState("");
  const [finishOutcome, setFinishOutcome] = useState<(typeof OUTCOMES)[number][0]>("good");
  const [nextVisit, setNextVisit] = useState<(typeof NEXT_VISITS)[number][0] | "custom">("none");
  const [noteText, setNoteText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [dictating, setDictating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const masterPhotosRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const activeVisit = props.activeVisit ?? null;
  const noteVisitId = activeVisit?.status === "in_progress" ? activeVisit.id : "";

  function applyResult(result: { success?: string; error?: string; warning?: string }) {
    if (result.error) setFeedback({ kind: "error", text: result.error });
    else if (result.warning) setFeedback({ kind: "warning", text: `${result.success ?? "Action réalisée."} ${result.warning}` });
    else if (result.success) setFeedback({ kind: "success", text: result.success });
  }

  function plan(preset: "today" | "tomorrow" | "week" | "custom") {
    startTransition(async () => {
      const result = await quickPlanVisitAction(
        props.brandPharmacyId,
        preset,
        preset === "custom" ? customPlanAt : undefined,
      );
      applyResult(result);
      if (result.success) {
        setPlanOpen(false);
        router.refresh();
      }
    });
  }

  function startVisit() {
    if (!activeVisit) return;
    startTransition(async () => {
      const result = await startVisitAction(props.brandPharmacyId, activeVisit.id);
      applyResult(result);
      if (result.success) router.refresh();
    });
  }

  function completeVisit() {
    if (!activeVisit) return;
    startTransition(async () => {
      const result = await completeVisitAction(
        props.brandPharmacyId,
        activeVisit.id,
        finishOutcome,
        nextVisit,
        nextVisit === "custom" ? customNextAt : undefined,
      );
      applyResult(result);
      if (result.success) {
        setFinishOpen(false);
        router.refresh();
      }
    });
  }

  async function appendPhotos(incoming: FileList | null) {
    if (!incoming?.length) return;
    try {
      const available = Math.max(0, 3 - noteFiles.length);
      const prepared = await Promise.all(
        Array.from(incoming)
          .slice(0, available)
          .map(compressNotePhoto),
      );
      const combined = [...noteFiles, ...prepared].slice(0, 3);
      setNoteFiles(combined);
      if (masterPhotosRef.current) {
        const transfer = new DataTransfer();
        combined.forEach((file) => transfer.items.add(file));
        masterPhotosRef.current.files = transfer.files;
      }
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    } catch {
      setFeedback({ kind: "error", text: "Une photo est trop lourde ou illisible. Reprenez-la avec l’appareil photo." });
    }
  }

  function removePhoto(index: number) {
    const combined = noteFiles.filter((_, itemIndex) => itemIndex !== index);
    setNoteFiles(combined);
    if (masterPhotosRef.current) {
      const transfer = new DataTransfer();
      combined.forEach((file) => transfer.items.add(file));
      masterPhotosRef.current.files = transfer.files;
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function startDictation() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      textareaRef.current?.focus();
      setFeedback({
        kind: "warning",
        text: "Dictée navigateur indisponible : utilisez le micro du clavier iPhone dans la zone de note.",
      });
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
      if (result) setNoteText((current) => `${current}${current ? " " : ""}${result}`);
    };
    recognition.onend = () => setDictating(false);
    recognition.onerror = () => {
      setDictating(false);
      textareaRef.current?.focus();
      setFeedback({ kind: "warning", text: "La dictée n’a pas démarré. Vous pouvez utiliser le micro du clavier iPhone." });
    };
    setDictating(true);
    recognition.start();
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createQuickNoteAction(formData);
      applyResult(result);
      if (result.success) {
        setNoteOpen(false);
        setNoteText("");
        setSelectedTags([]);
        setNoteFiles([]);
        if (masterPhotosRef.current) masterPhotosRef.current.value = "";
        router.refresh();
      }
    });
  }

  const visitLabel = activeVisit
    ? activeVisit.status === "in_progress"
      ? "Terminer"
      : "Démarrer"
    : "Planifier";

  return (
    <section className="tr1-da-panel overflow-hidden" data-testid="terrain-pharmacy-header">
      <div className="h-0.5 bg-[var(--tr1-orange)]" />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[.18em] text-[var(--tr1-orange)]">Pharmacie</p>
            <h1 className="mt-1 truncate font-mono text-2xl font-black uppercase tracking-[-0.055em] text-[var(--tr1-navy)] sm:text-3xl">{props.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{props.address}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {props.objective ? <Badge className="bg-[var(--tr1-orange)] text-white">{props.objective}</Badge> : null}
            <Badge variant="outline">{props.status}</Badge>
            <Badge variant="outline" className="border-[var(--tr1-orange)] text-[var(--tr1-orange)]">{props.potential}</Badge>
          </div>
        </div>

        {activeVisit ? (
          <div className={activeVisit.status === "in_progress" ? "rounded-xl border border-emerald-300 bg-emerald-50 p-3" : "rounded-xl border border-orange-200 bg-orange-50 p-3"}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{activeVisit.status === "in_progress" ? "Visite en cours" : "Visite prévue"}</p>
                <p className="font-semibold text-[var(--tr1-navy)]">{dateTime(activeVisit.scheduledStartAt)}</p>
              </div>
              <CheckCircle2 className="size-5 text-[var(--tr1-orange)]" />
            </div>
          </div>
        ) : null}

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

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {props.canQuickVisit ? (
            <Button
              type="button"
              size="lg"
              className="min-h-16 flex-col gap-1 text-sm"
              disabled={pending}
              onClick={() => {
                if (!activeVisit) setPlanOpen(true);
                else if (activeVisit.status === "in_progress") setFinishOpen(true);
                else startVisit();
              }}
            >
              {activeVisit?.status === "in_progress" ? <Square className="size-5" /> : activeVisit ? <Play className="size-5" /> : <CalendarPlus className="size-5" />}
              {visitLabel}
            </Button>
          ) : (
            <Button asChild size="lg" className="min-h-16 flex-col gap-1 text-sm">
              <Link href="?tab=activity"><ClipboardPenLine className="size-5" />Activité</Link>
            </Button>
          )}

          <Button type="button" size="lg" variant="secondary" className="min-h-16 flex-col gap-1 text-sm" onClick={() => setNoteOpen(true)}>
            <ClipboardPenLine className="size-5" />
            Note
          </Button>

          {props.canCreateOrder ? (
            <Button asChild size="lg" variant="secondary" className="min-h-16 flex-col gap-1 text-sm">
              <Link href={`/dashboard/orders/new?pharmacy=${props.brandPharmacyId}&mode=document`}>
                <ShoppingCart className="size-5" />
                Commande
              </Link>
            </Button>
          ) : (
            <Button disabled size="lg" variant="secondary" className="min-h-16 flex-col gap-1 text-sm"><ShoppingCart className="size-5" />Commande</Button>
          )}

          <TrackedLink
            href={buildWazeUrl(props.navigation)}
            eventName="navigation_waze_clicked"
            pharmacyId={props.pharmacyId}
            external
            className="min-h-16 flex-col gap-1 bg-[var(--tr1-navy)] text-sm text-white"
          >
            <Navigation className="size-5" />
            Itinéraire
          </TrackedLink>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {props.phone ? (
            <TrackedLink
              href={`tel:${props.phone}`}
              eventName="interaction_started"
              pharmacyId={props.pharmacyId}
              className="min-h-11 border border-[var(--tr1-line-strong)] bg-transparent text-[#0f2740]"
            >
              <Phone className="size-4" /> Appeler
            </TrackedLink>
          ) : (
            <Button disabled variant="outline"><Phone className="size-4" />Appeler</Button>
          )}
          <TrackedLink
            href={buildGoogleMapsUrl(props.navigation)}
            eventName="navigation_maps_clicked"
            pharmacyId={props.pharmacyId}
            external
            className="min-h-11 border border-[var(--tr1-line-strong)] bg-transparent text-[#0f2740]"
          >
            <MapPinned className="size-4" /> Maps
          </TrackedLink>
          <Button asChild variant="ghost" className="min-h-11">
            <Link href="?tab=activity">Plus <ChevronRight className="size-4" /></Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-lg border text-sm">
          <div className="p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Dernière commande</p>
            <strong>{date(props.lastOrderAt)}</strong>
          </div>
          <div className="border-l p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Prochaine action</p>
            <strong className="text-[var(--tr1-orange)]">{props.nextActionType ? `${props.nextActionType} · ${date(props.nextActionAt)}` : "Aucune"}</strong>
          </div>
        </div>
      </div>

      <Sheet open={planOpen} onOpenChange={setPlanOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader><SheetTitle>Ajouter au plan de visite</SheetTitle></SheetHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            <Button disabled={pending} size="lg" onClick={() => plan("today")}>Aujourd’hui</Button>
            <Button disabled={pending} size="lg" variant="secondary" onClick={() => plan("tomorrow")}>Demain</Button>
            <Button disabled={pending} size="lg" variant="secondary" onClick={() => plan("week")}>Cette semaine</Button>
            <Button disabled={pending} size="lg" variant="outline" onClick={() => document.getElementById("quick-custom-plan")?.focus()}>Choisir</Button>
          </div>
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="quick-custom-plan">Date et heure précises</Label>
            <Input id="quick-custom-plan" type="datetime-local" value={customPlanAt} onChange={(event) => setCustomPlanAt(event.target.value)} />
            <Button disabled={pending || !customPlanAt} className="w-full" onClick={() => plan("custom")}>Ajouter cette visite</Button>
          </div>
          <p className="pt-3 text-xs text-muted-foreground">Les raccourcis choisissent automatiquement le prochain créneau terrain libre de 45 min.</p>
        </SheetContent>
      </Sheet>

      <Sheet open={noteOpen} onOpenChange={setNoteOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader><SheetTitle>Note rapide · {props.name}</SheetTitle></SheetHeader>
          <form onSubmit={submitNote} className="space-y-4 py-4">
            <input type="hidden" name="brandPharmacyId" value={props.brandPharmacyId} />
            <input type="hidden" name="fieldVisitId" value={noteVisitId} />
            {selectedTags.map((tag) => <input key={tag} type="hidden" name="tags" value={tag} />)}
            <input ref={masterPhotosRef} className="sr-only" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple />
            <input ref={cameraRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void appendPhotos(event.target.files)} />
            <input ref={libraryRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void appendPhotos(event.target.files)} />

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="lg" variant={dictating ? "default" : "outline"} onClick={startDictation}>
                <Mic className="size-5" /> {dictating ? "J’écoute…" : "Dicter"}
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => cameraRef.current?.click()} disabled={noteFiles.length >= 3}>
                <Camera className="size-5" /> Photo
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-note-text">Note</Label>
              <Textarea
                ref={textareaRef}
                id="quick-note-text"
                name="notes"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Écrire ou dicter…"
                rows={4}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">Sur iPhone, vous pouvez aussi utiliser le micro du clavier.</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Qualifier sans taper</p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map(([value, label]) => (
                  <Button key={value} type="button" size="sm" variant={selectedTags.includes(value) ? "default" : "outline"} onClick={() => toggleTag(value)}>{label}</Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Photos · {noteFiles.length}/3</p>
                <Button type="button" size="sm" variant="ghost" disabled={noteFiles.length >= 3} onClick={() => libraryRef.current?.click()}><Images className="size-4" />Photothèque</Button>
              </div>
              {noteFiles.length ? (
                <div className="space-y-2">
                  {noteFiles.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{file.name}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removePhoto(index)}>Retirer</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <button type="button" className="flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground" onClick={() => cameraRef.current?.click()}>
                  <Camera className="size-5" /> Ajouter une photo
                </button>
              )}
            </div>

            <Button disabled={pending || (!noteText.trim() && noteFiles.length === 0)} size="lg" className="w-full">
              {pending ? "Enregistrement…" : "Enregistrer la note"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={finishOpen} onOpenChange={setFinishOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader><SheetTitle>Terminer la visite</SheetTitle></SheetHeader>
          <div className="space-y-5 py-4">
            <div>
              <p className="mb-2 text-sm font-medium">Comment s’est passée la visite ?</p>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map(([value, label]) => (
                  <Button key={value} type="button" variant={finishOutcome === value ? "default" : "outline"} onClick={() => setFinishOutcome(value)}>{label}</Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Prochain passage</p>
              <div className="grid grid-cols-2 gap-2">
                {NEXT_VISITS.map(([value, label]) => (
                  <Button key={value} type="button" variant={nextVisit === value ? "default" : "outline"} onClick={() => setNextVisit(value)}>{label}</Button>
                ))}
                <Button type="button" variant={nextVisit === "custom" ? "default" : "outline"} onClick={() => setNextVisit("custom")}>Choisir une date</Button>
              </div>
              {nextVisit === "custom" ? (
                <Input className="mt-3" type="datetime-local" value={customNextAt} onChange={(event) => setCustomNextAt(event.target.value)} />
              ) : null}
            </div>
            <Button size="lg" className="w-full" disabled={pending || (nextVisit === "custom" && !customNextAt)} onClick={completeVisit}>
              <CheckCircle2 className="size-5" /> {pending ? "Validation…" : "Terminer la visite"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
