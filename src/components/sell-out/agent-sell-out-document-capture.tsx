"use client";

import { useMemo, useRef, useState } from "react";
import { FileSearch, Save } from "lucide-react";
import { createAnalyzedSellOutCaptureAction } from "@/app/(protected)/dashboard/sell-out/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PharmacyOption = {
  id: string;
  name: string;
  city: string | null;
};

type PreviewLine = {
  index: number;
  label: string | null;
  sourceProductCode: string | null;
  ean: string | null;
  unitsSold: number | null;
  revenueHt: number | null;
  confidence: number | null;
  warning: string | null;
  product: {
    status: "matched" | "unmatched" | "ambiguous";
    selectedId: string | null;
    selectedName: string | null;
    candidates: Array<{
      id: string;
      name: string;
      sku: string | null;
      ean: string | null;
    }>;
  };
};

type Preview = {
  brandPharmacyId: string;
  periodStart: string;
  periodEnd: string;
  extraction: {
    confidence: number | null;
  };
  lines: PreviewLine[];
  warnings: string[];
};

type EditableLine = PreviewLine & {
  productId: string;
  unitsSoldInput: string;
  revenueHtInput: string;
};

export function AgentSellOutDocumentCapture({
  pharmacies,
  defaultPharmacyId = "",
}: {
  pharmacies: PharmacyOption[];
  defaultPharmacyId?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [brandPharmacyId, setBrandPharmacyId] = useState(defaultPharmacyId);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [confidence, setConfidence] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Document pharmacie");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const serializedLines = useMemo(
    () => JSON.stringify(lines.map((line) => ({
      productId: line.productId,
      sourceProductCode: line.sourceProductCode,
      ean: line.ean,
      label: line.label,
      unitsSold: line.unitsSoldInput === "" ? null : Number(line.unitsSoldInput),
      revenueHt: line.revenueHtInput === "" ? null : Number(line.revenueHtInput),
      confidence: line.confidence,
    }))),
    [lines],
  );

  async function analyzeDocument() {
    const document = fileRef.current?.files?.[0];
    if (!brandPharmacyId) {
      setAnalysisError("Choisissez d’abord la pharmacie.");
      return;
    }
    if (!document) {
      setAnalysisError("Ajoutez la sortie de caisse en photo ou PDF.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setPreview(null);
    setLines([]);
    try {
      const body = new FormData();
      body.set("brandPharmacyId", brandPharmacyId);
      body.set("document", document);
      const response = await fetch("/api/field-data/sell-out/analyze", {
        method: "POST",
        body,
      });
      const payload = await response.json() as {
        error?: string;
        preview?: Preview;
      };
      if (!response.ok || !payload.preview) {
        throw new Error(payload.error || "Le document n’a pas pu être analysé.");
      }

      const next = payload.preview;
      setPreview(next);
      setPeriodStart(next.periodStart);
      setPeriodEnd(next.periodEnd);
      setConfidence(next.extraction.confidence == null ? "" : String(next.extraction.confidence));
      setLines(next.lines.map((line) => ({
        ...line,
        productId: line.product.selectedId ?? "",
        unitsSoldInput: line.unitsSold == null ? "" : String(line.unitsSold),
        revenueHtInput: line.revenueHt == null ? "" : String(line.revenueHt),
      })));
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Le document n’a pas pu être analysé.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function patchLine(index: number, patch: Partial<EditableLine>) {
    setLines((current) => current.map((line, lineIndex) =>
      lineIndex === index ? { ...line, ...patch } : line
    ));
  }

  return (
    <form action={createAnalyzedSellOutCaptureAction} className="space-y-4">
      <input type="hidden" name="linesJson" value={serializedLines} />
      <input type="hidden" name="confidence" value={confidence} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="sell-out-pharmacy">Pharmacie</Label>
          <select
            id="sell-out-pharmacy"
            name="brandPharmacyId"
            required
            value={brandPharmacyId}
            onChange={(event) => {
              setBrandPharmacyId(event.target.value);
              setPreview(null);
              setLines([]);
            }}
            className="mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="" disabled>Choisir une pharmacie</option>
            {pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.name}{pharmacy.city ? " · " + pharmacy.city : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 rounded-xl border border-dashed p-3">
          <Label htmlFor="sell-out-document">Sortie de caisse / relevé sell-out</Label>
          <Input
            ref={fileRef}
            id="sell-out-document"
            name="document"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            required
            className="mt-1.5"
            onChange={() => {
              setPreview(null);
              setLines([]);
              setAnalysisError(null);
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Photo ou PDF. Aucune donnée patient/client ne doit apparaître sur le document.
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={analyzing}
        onClick={() => void analyzeDocument()}
      >
        <FileSearch className="size-4" />
        {analyzing ? "Analyse en cours…" : "Analyser le document"}
      </Button>

      {analysisError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {analysisError}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
          <div>
            <p className="font-semibold text-[var(--tr1-navy)]">Prévisualisation TR1</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Corrigez les lignes avant de créer le relevé. Le document original sera conservé comme preuve privée.
            </p>
          </div>

          {preview.warnings.length ? (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <ul className="list-disc space-y-1 pl-5">
                {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="sell-out-period-start">Début période</Label>
              <Input
                id="sell-out-period-start"
                name="periodStart"
                type="date"
                required
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="sell-out-period-end">Fin période</Label>
              <Input
                id="sell-out-period-end"
                name="periodEnd"
                type="date"
                required
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="sell-out-source-label">Source / contexte</Label>
              <Input
                id="sell-out-source-label"
                name="sourceLabel"
                maxLength={300}
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={line.index} className="rounded-xl border bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{line.label || "Produit à confirmer"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {line.ean || line.sourceProductCode || "Référence non lue"}
                    </p>
                  </div>
                  {line.confidence != null ? (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(line.confidence * 100)} % confiance
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <Label>Produit TR1</Label>
                    <select
                      value={line.productId}
                      onChange={(event) => patchLine(index, { productId: event.target.value })}
                      className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Conserver comme produit non rapproché</option>
                      {line.product.candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                          {candidate.sku ? " · " + candidate.sku : ""}
                          {candidate.ean ? " · " + candidate.ean : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={"sell-out-units-" + index}>Unités vendues</Label>
                    <Input
                      id={"sell-out-units-" + index}
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={line.unitsSoldInput}
                      onChange={(event) => patchLine(index, { unitsSoldInput: event.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={"sell-out-revenue-" + index}>CA HT</Label>
                    <Input
                      id={"sell-out-revenue-" + index}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.revenueHtInput}
                      onChange={(event) => patchLine(index, { revenueHtInput: event.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="flex items-end">
                    <p className="pb-2 text-xs text-muted-foreground">
                      {line.warning || "Ligne prête à valider."}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={lines.length === 0 || lines.some((line) => line.unitsSoldInput === "")}>
            <Save className="size-4" />
            Créer le relevé avec ce document
          </Button>
        </div>
      ) : null}
    </form>
  );
}
