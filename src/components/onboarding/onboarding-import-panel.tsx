"use client";

import { useMemo, useState, useActionState } from "react";
import { stageOnboardingImportAction } from "@/app/(protected)/dashboard/admin/onboarding/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { previewImport } from "@/lib/imports/import-engine";
import { IMPORT_COLUMNS, type ColumnMapping, type ImportPreview, type ImportType } from "@/lib/imports/import-types";

const typeLabels: Record<ImportType, string> = {
  products: "Produits",
  pharmacies: "Pharmacies",
  territories: "Territoires",
  users: "Utilisateurs",
  orders: "Commandes historiques",
};

const modeOptions: Record<ImportType, Array<{ value: string; label: string }>> = {
  products: [
    { value: "create_only", label: "Créer uniquement" },
    { value: "update_only", label: "Mettre à jour uniquement" },
    { value: "upsert", label: "Créer et mettre à jour" },
  ],
  pharmacies: [
    { value: "create_only", label: "Créer uniquement" },
    { value: "update_only", label: "Mettre à jour uniquement" },
    { value: "upsert", label: "Créer et mettre à jour" },
  ],
  territories: [
    { value: "create_only", label: "Créer uniquement" },
    { value: "update_only", label: "Mettre à jour uniquement" },
    { value: "upsert", label: "Créer et mettre à jour" },
  ],
  users: [{ value: "invite", label: "Inviter ou réactiver après confirmation" }],
  orders: [{ value: "append_only", label: "Ajouter sans écraser l’historique" }],
};

export function OnboardingImportPanel({
  brandId,
  templates,
}: {
  brandId: string;
  templates: Array<{ import_type: ImportType; documentation: string }>;
}) {
  const [type, setType] = useState<ImportType>("products");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [dateFormat, setDateFormat] = useState("");
  const [state, action, pending] = useActionState(stageOnboardingImportAction, {});
  const documentation = templates.find((template) => template.import_type === type)?.documentation;
  const availableColumns = useMemo(() => [...IMPORT_COLUMNS[type].required, ...IMPORT_COLUMNS[type].optional], [type]);

  function refreshPreview(nextContent: string, nextType: ImportType, nextMapping?: ColumnMapping, nextDateFormat = dateFormat) {
    if (!nextContent) {
      setPreview(null);
      return;
    }
    try {
      const result = previewImport({
        content: nextContent,
        type: nextType,
        manualMapping: nextMapping,
        dateFormat: nextDateFormat === "DMY" || nextDateFormat === "MDY" ? nextDateFormat : undefined,
      });
      setPreview(result);
      setMapping(result.mapping);
      setPreviewError("");
    } catch (error) {
      setPreview(null);
      setPreviewError(error instanceof Error ? error.message : "Prévisualisation impossible.");
    }
  }

  async function readFile(file: File | undefined) {
    setFileName(file?.name ?? "");
    const nextContent = file ? await file.text() : "";
    setContent(nextContent);
    refreshPreview(nextContent, type);
  }

  function updateMapping(header: string, target: string) {
    const nextMapping = { ...mapping, [header]: target || null };
    setMapping(nextMapping);
    refreshPreview(content, type, nextMapping);
  }

  return (
    <div className="space-y-5">
      <Alert>
        <AlertTitle>Aucune donnée patient</AlertTitle>
        <AlertDescription>Les imports ne doivent contenir aucune donnée de santé ou information patient.</AlertDescription>
      </Alert>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
        <div className="md:col-span-2"><ActionFeedback error={state.error} success={state.success} /></div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-import-type">Données à importer</Label>
          <select
            id="onboarding-import-type"
            name="type"
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as ImportType;
              setType(nextType);
              refreshPreview(content, nextType);
            }}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">{documentation}</p>
          <a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/api/onboarding/templates/${type}`}>
            Télécharger le modèle CSV
          </a>
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-import-mode">Mode</Label>
          <select id="onboarding-import-mode" name="mode" className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm">
            {modeOptions[type].map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
          </select>
        </div>
        {type === "orders" ? (
          <div className="space-y-2">
            <Label htmlFor="dateFormat">Format des dates non ISO</Label>
            <select
              id="dateFormat"
              name="dateFormat"
              value={dateFormat}
              onChange={(event) => {
                setDateFormat(event.target.value);
                refreshPreview(content, type, mapping, event.target.value);
              }}
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="">ISO uniquement (AAAA-MM-JJ)</option>
              <option value="DMY">Jour / mois / année</option>
              <option value="MDY">Mois / jour / année</option>
            </select>
          </div>
        ) : null}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="onboarding-file">Fichier CSV UTF-8 — 5 Mo et 10 000 lignes maximum</Label>
          <input
            id="onboarding-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={(event) => void readFile(event.target.files?.[0])}
            className="border-input w-full rounded-md border p-2 text-sm"
          />
        </div>
        {preview ? (
          <div className="space-y-3 rounded-lg border p-4 md:col-span-2">
            <div>
              <h3 className="font-medium">Mapping des colonnes</h3>
              <p className="text-sm text-muted-foreground">Vérifiez ou corrigez chaque correspondance avant validation.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {preview.headers.map((header) => (
                <label className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm" key={header}>
                  <span className="truncate font-medium">{header}</span><span>→</span>
                  <select
                    value={mapping[header] ?? ""}
                    onChange={(event) => updateMapping(header, event.target.value)}
                    className="border-input bg-background h-9 min-w-0 rounded-md border px-2"
                  >
                    <option value="">Ignorer</option>
                    {availableColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{preview.summary.total} lignes</Badge>
              <Badge variant="secondary">{preview.summary.valid} valides</Badge>
              <Badge variant="secondary">{preview.summary.warnings} avertissements</Badge>
              <Badge variant={preview.summary.errors ? "destructive" : "secondary"}>{preview.summary.errors} erreurs</Badge>
              <Badge variant="secondary">{preview.summary.duplicates} doublons</Badge>
            </div>
            {preview.rows.some((row) => row.issues.length) ? (
              <div className="max-h-56 space-y-2 overflow-auto text-sm">
                {preview.rows.filter((row) => row.issues.length).slice(0, 20).map((row) => (
                  <div className="rounded-md bg-muted p-2" key={row.lineNumber}>
                    <span className="font-medium">Ligne {row.lineNumber}</span>
                    {row.issues.map((issue, index) => (
                      <p className={issue.severity === "error" ? "text-destructive" : "text-amber-700"} key={`${issue.column}-${index}`}>
                        {issue.column} : {issue.message}{issue.suggestion ? ` ${issue.suggestion}` : ""}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {previewError ? <p className="text-sm text-destructive md:col-span-2">{previewError}</p> : null}
        <Button disabled={pending || !preview || !fileName} className="md:col-span-2">
          {pending ? "Validation et stockage privé…" : "Valider la prévisualisation"}
        </Button>
      </form>
    </div>
  );
}
