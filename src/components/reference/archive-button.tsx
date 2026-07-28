"use client";

import { archiveBrandPharmacyAction } from "@/app/(protected)/dashboard/reference/actions";
import { Button } from "@/components/ui/button";

export function ArchiveButton({ id }: { id: string }) {
  return <form action={archiveBrandPharmacyAction} onSubmit={(event) => { if (!window.confirm("Archiver cette relation marque-pharmacie ? Aucune donnée ne sera supprimée.")) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><Button variant="destructive" type="submit">Archiver</Button></form>;
}
