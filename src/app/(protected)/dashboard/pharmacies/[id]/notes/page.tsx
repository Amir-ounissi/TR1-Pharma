import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, StickyNote } from "lucide-react";
import { EditableVisitNote } from "@/components/agent/editable-visit-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";
import { canEditVisitNote } from "@/lib/visit-note-editing";

const tagLabels: Record<string, string> = {
  order: "Commande",
  merchandising: "Merchandising",
  stockout: "Rupture",
  competitor: "Concurrent",
  callback: "À rappeler",
  problem: "Problème",
};

type Params = Promise<{ id: string }>;

export default async function PharmacyNotesPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, brand, userId } = await requireActiveBrand();
  const { data: relation } = await supabase
    .from("brand_pharmacies")
    .select("id,pharmacy_id,pharmacies(trade_name,legal_name,city)")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!relation) notFound();
  const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;

  const { data: notes, error } = await supabase
    .from("interactions")
    .select("id,occurred_at,subject,notes,tags,field_visit_id,created_by")
    .eq("brand_pharmacy_id", id)
    .eq("brand_id", brand.id)
    .eq("interaction_type", "internal_note")
    .is("archived_at", null)
    .order("occurred_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);

  const noteIds = (notes ?? []).map((note) => note.id);
  const visitIds = Array.from(
    new Set((notes ?? []).map((note) => note.field_visit_id).filter((value): value is string => Boolean(value))),
  );
  const [{ data: attachments }, { data: linkedVisits }] = await Promise.all([
    noteIds.length
      ? supabase
          .from("interaction_attachments")
          .select("id,interaction_id,object_path,original_name,mime_type")
          .in("interaction_id", noteIds)
          .is("archived_at", null)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    visitIds.length
      ? supabase
          .from("field_visits")
          .select("id,status,owner_user_id")
          .in("id", visitIds)
          .eq("pharmacy_id", relation.pharmacy_id)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
  ]);
  const visitById = new Map((linkedVisits ?? []).map((visit) => [visit.id, visit]));

  const paths = (attachments ?? []).map((attachment) => attachment.object_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from("interaction-evidence").createSignedUrls(paths, 3600)
    : { data: [] };
  const signedByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  const attachmentsByInteraction = new Map<string, Array<{ id: string; url: string; name: string }>>();
  for (const attachment of attachments ?? []) {
    const url = signedByPath.get(attachment.object_path);
    if (!url) continue;
    const list = attachmentsByInteraction.get(attachment.interaction_id) ?? [];
    list.push({ id: attachment.id, url, name: attachment.original_name });
    attachmentsByInteraction.set(attachment.interaction_id, list);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/pharmacies/${id}`}><ArrowLeft className="size-4" />Retour</Link>
        </Button>
        <div className="min-w-0">
          <p className="truncate font-bold text-[var(--tr1-navy)]">{pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie"}</p>
          <p className="text-xs text-muted-foreground">Notes terrain · {pharmacy?.city || ""}</p>
        </div>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-[var(--tr1-navy)]"><StickyNote className="size-6" />Historique des notes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Texte, dictée, tags et photos pris sur le terrain. Une note liée à une visite reste modifiable jusqu’à sa clôture.</p>
      </div>

      <div className="space-y-3">
        {(notes ?? []).map((note) => {
          const photos = attachmentsByInteraction.get(note.id) ?? [];
          const tags = Array.isArray(note.tags) ? note.tags : [];
          const linkedVisit = note.field_visit_id ? visitById.get(note.field_visit_id) : null;
          const editable = Boolean(linkedVisit && canEditVisitNote({
            visitStatus: linkedVisit.status,
            visitOwnerUserId: linkedVisit.owner_user_id,
            noteCreatedBy: note.created_by,
            userId,
          }));
          return (
            <Card key={note.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{note.subject || "Note terrain"}</p>
                    <time className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(note.occurred_at))}
                    </time>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {editable ? <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Visite en cours</Badge> : null}
                    {photos.length ? <Badge variant="secondary"><Camera className="mr-1 size-3" />{photos.length}</Badge> : null}
                  </div>
                </div>
                {note.notes ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.notes}</p> : null}
                {tags.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => <Badge key={tag} variant="outline">{tagLabels[tag] || tag}</Badge>)}
                  </div>
                ) : null}
                {photos.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {photos.map((photo) => (
                      <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.name} className="aspect-square h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {editable ? (
                  <EditableVisitNote
                    brandPharmacyId={id}
                    interactionId={note.id}
                    initialNotes={note.notes || ""}
                    initialTags={tags}
                  />
                ) : note.field_visit_id ? (
                  <p className="text-xs text-muted-foreground">Note verrouillée après clôture de la visite.</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!notes?.length ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune note terrain pour cette pharmacie.</div>
        ) : null}
      </div>
    </div>
  );
}
