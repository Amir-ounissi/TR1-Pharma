"use client";

import { useActionState } from "react";
import { confirmImportAction, previewImportAction } from "@/app/(protected)/dashboard/reference/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function downloadImportErrors(errors: Array<{ line: number; messages: string[] }>) {
  const rows = ["ligne;erreurs", ...errors.map(({ line, messages }) => `${line};"${messages.join(" | ").replaceAll('"', '""')}"`)];
  const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "erreurs-import.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportForm() {
  const [state, action, pending] = useActionState(previewImportAction, {});
  return <div className="space-y-6"><form action={action} className="grid gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2"><ActionFeedback error={state.error} success={state.success} /></div>
    <div className="space-y-2"><Label>Type de données</Label><Select name="entity" required><SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner le type de données" /></SelectTrigger><SelectContent><SelectItem value="pharmacies">Pharmacies</SelectItem><SelectItem value="contacts">Contacts</SelectItem><SelectItem value="brand_pharmacies">Relations marque-pharmacie</SelectItem><SelectItem value="products">Produits</SelectItem><SelectItem value="orders">Commandes et lignes</SelectItem></SelectContent></Select></div>
    <div className="space-y-2"><Label>Stratégie</Label><Select name="strategy" defaultValue="create_only"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="create_only">Créer uniquement</SelectItem><SelectItem value="update_only">Mettre à jour uniquement</SelectItem><SelectItem value="upsert">Créer ou compléter</SelectItem><SelectItem value="skip_duplicates">Ignorer les doublons</SelectItem></SelectContent></Select></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="file">Fichier CSV</Label><input id="file" name="file" type="file" accept=".csv,text/csv" required className="border-input w-full rounded-md border p-2 text-sm" /></div>
    <Button disabled={pending} className="sm:col-span-2">{pending ? "Analyse…" : "Prévisualiser"}</Button>
  </form>
  {state.batchId ? <Alert><AlertTitle>Prévisualisation</AlertTitle><AlertDescription className="space-y-3"><p>{state.validRows} ligne(s) valide(s), {state.errorRows} en erreur, {state.duplicateRows} doublon(s) potentiel(s).</p><p className="text-xs">Mapping : {Object.entries(state.mapping ?? {}).map(([source, target]) => `${source} → ${target}`).join(" · ")}</p>{state.errors?.map((error) => <p key={error.line} className="text-destructive">Ligne {error.line} : {error.messages.join(", ")}</p>)}<div className="flex flex-wrap gap-2">{state.errors?.length ? <Button type="button" variant="outline" onClick={() => downloadImportErrors(state.errors ?? [])}>Télécharger les erreurs</Button> : null}<form action={confirmImportAction}><input type="hidden" name="batchId" value={state.batchId} /><Button disabled={(state.validRows ?? 0) === 0}>Confirmer les lignes valides</Button></form></div></AlertDescription></Alert> : null}</div>;
}
