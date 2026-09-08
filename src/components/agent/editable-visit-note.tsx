"use client";

import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateOpenVisitNoteAction } from "@/app/(protected)/dashboard/pharmacies/[id]/notes/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TAGS = [
  ["order", "Commande"],
  ["merchandising", "Merchandising"],
  ["stockout", "Rupture"],
  ["competitor", "Concurrent"],
  ["callback", "À rappeler"],
  ["problem", "Problème"],
] as const;

export function EditableVisitNote({
  brandPharmacyId,
  interactionId,
  initialNotes,
  initialTags,
}: {
  brandPharmacyId: string;
  interactionId: string;
  initialNotes: string;
  initialTags: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [tags, setTags] = useState(initialTags);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }

  function cancel() {
    setNotes(initialNotes);
    setTags(initialTags);
    setError(null);
    setEditing(false);
  }

  function save() {
    const data = new FormData();
    data.set("brandPharmacyId", brandPharmacyId);
    data.set("interactionId", interactionId);
    data.set("notes", notes);
    tags.forEach((tag) => data.append("tags", tag));
    setError(null);
    startTransition(async () => {
      const result = await updateOpenVisitNoteAction(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <p className="text-xs font-medium text-emerald-900">
          Modifiable tant que la visite reste en cours.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" /> Modifier
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--tr1-navy)]">Modifier la note de cette visite</p>
        <Button type="button" size="icon-sm" variant="ghost" onClick={cancel} disabled={pending} aria-label="Annuler la modification">
          <X className="size-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`edit-note-${interactionId}`}>Note</Label>
        <Textarea
          id={`edit-note-${interactionId}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={4000}
          rows={4}
          className="bg-white text-base"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {TAGS.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={tags.includes(value) ? "default" : "outline"}
            onClick={() => toggleTag(value)}
            disabled={pending}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Les photos déjà associées sont conservées.</p>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <Button type="button" className="w-full" disabled={pending} onClick={save}>
        {pending ? "Mise à jour…" : "Enregistrer les modifications"}
      </Button>
    </div>
  );
}
