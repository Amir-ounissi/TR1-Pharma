"use client";

import { useActionState, useMemo, useState } from "react";
import { FileUp, Save } from "lucide-react";
import { saveMappingProfileAction } from "@/app/(protected)/dashboard/imports/mapping/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canonicalImportFields,
  IGNORE_MAPPING_TARGET,
  suggestCanonicalField,
  validateDataMapping,
} from "@/lib/data-mapping";
import type { ImportEntity } from "@/lib/reference-data";

const entityLabels: Record<ImportEntity, string> = {
  pharmacies: "Pharmacies",
  contacts: "Contacts",
  brand_pharmacies: "Relations marque-pharmacie",
  products: "Produits",
  orders: "Commandes",
};

function splitHeaderLine(line: string) {
  const separator = (line.match(/;/g)?.length ?? 0) > (line.match(/,/g)?.length ?? 0) ? ";" : ",";
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === separator && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values.filter(Boolean);
}

const initialMapping = {
  "Nom officine": "legal_name",
  "Code postal": "postal_code",
  Ville: "city",
  Commentaire: IGNORE_MAPPING_TARGET,
};

export function MappingProfileForm() {
  const [actionState, action, pending] = useActionState(saveMappingProfileAction, {});
  const [entity, setEntity] = useState<ImportEntity>("pharmacies");
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [mappingText, setMappingText] = useState(JSON.stringify(initialMapping, null, 2));

  const parsedMapping = useMemo(() => {
    try {
      const parsed = JSON.parse(mappingText);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : null;
    } catch {
      return null;
    }
  }, [mappingText]);

  const mappingErrors = useMemo(() => {
    if (!parsedMapping) return ["Le JSON du mapping est invalide."];
    return validateDataMapping(entity, parsedMapping);
  }, [entity, parsedMapping]);

  async function loadExampleFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim());
    if (!firstLine) return;
    const headers = splitHeaderLine(firstLine);
    setSourceHeaders(headers);
    const suggested = Object.fromEntries(
      headers.map((header) => [header, suggestCanonicalField(header, entity) ?? IGNORE_MAPPING_TARGET]),
    );
    setMappingText(JSON.stringify(suggested, null, 2));
  }

  function changeEntity(nextEntity: ImportEntity) {
    setEntity(nextEntity);
    if (sourceHeaders.length) {
      const suggested = Object.fromEntries(
        sourceHeaders.map((header) => [header, suggestCanonicalField(header, nextEntity) ?? IGNORE_MAPPING_TARGET]),
      );
      setMappingText(JSON.stringify(suggested, null, 2));
    }
  }

  function updateVisualMapping(source: string, target: string) {
    if (!parsedMapping) return;
    setMappingText(JSON.stringify({ ...parsedMapping, [source]: target }, null, 2));
  }

  return (
    <form action={action} className="space-y-5">
      <ActionFeedback error={actionState.error} success={actionState.success} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div className="space-y-2">
          <Label htmlFor="name">Nom du profil</Label>
          <Input id="name" name="name" placeholder="Export HubSpot pharmacies" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceSystem">Système source</Label>
          <Input id="sourceSystem" name="sourceSystem" defaultValue="generic_csv" placeholder="hubspot" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="entityType">Type de données</Label>
        <select
          id="entityType"
          name="entityType"
          value={entity}
          onChange={(event) => changeEntity(event.target.value as ImportEntity)}
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
        >
          {Object.entries(entityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed p-4">
        <div className="flex items-center gap-2 font-medium"><FileUp className="size-4" />Charger un CSV exemple</div>
        <p className="text-xs text-muted-foreground">Seule la ligne d’entêtes est utilisée dans votre navigateur pour préparer le mapping. L’exemple n’est pas importé.</p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="border-input w-full rounded-md border p-2 text-sm"
          onChange={(event) => void loadExampleFile(event.target.files?.[0] ?? null)}
        />
      </div>

      {sourceHeaders.length && parsedMapping ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Correspondance des colonnes</Label>
            <Badge variant="secondary">{sourceHeaders.length} colonnes</Badge>
          </div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {sourceHeaders.map((source) => (
              <div key={source} className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={source}>{source}</p>
                  <p className="text-[11px] text-muted-foreground">Colonne source</p>
                </div>
                <select
                  value={parsedMapping[source] ?? IGNORE_MAPPING_TARGET}
                  onChange={(event) => updateVisualMapping(source, event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-xs"
                >
                  <option value={IGNORE_MAPPING_TARGET}>Ignorer cette colonne</option>
                  {canonicalImportFields[entity].map((field) => (
                    <option key={field.key} value={field.key}>{field.label}{field.required ? " *" : ""} · {field.key}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {mappingErrors.length ? (
        <Alert variant="destructive"><AlertDescription>{mappingErrors[0]}</AlertDescription></Alert>
      ) : (
        <Alert><AlertDescription>Mapping valide pour {entityLabels[entity]}.</AlertDescription></Alert>
      )}

      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">Édition JSON avancée</summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Le mode visuel et ce JSON restent synchronisés.</p>
          <Textarea
            id="mappingJson"
            name="mappingJson"
            rows={10}
            className="font-mono text-xs"
            value={mappingText}
            onChange={(event) => setMappingText(event.target.value)}
            required
          />
        </div>
      </details>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" />
        Utiliser ce profil par défaut pour ce type de données
      </label>
      <Button type="submit" className="w-full" disabled={pending || mappingErrors.length > 0}>
        <Save className="size-4" />{pending ? "Enregistrement…" : "Enregistrer le profil"}
      </Button>
    </form>
  );
}
