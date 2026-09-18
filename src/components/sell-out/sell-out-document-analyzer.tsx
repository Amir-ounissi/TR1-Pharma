"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Save, Sparkles } from "lucide-react";
import {
  confirmSellOutDocumentAnalysisAction,
  type SellOutDocumentActionState,
} from "@/app/(protected)/dashboard/sell-out/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
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
  };
};

type Preview = {
  periodStart: string;
  periodEnd: string;
  confidence: number | null;
  extraction: unknown;
  lines: PreviewLine[];
  warnings: string[];
};

type EditableLine = {
  productId: string;
  sourceProductCode: string;
  ean: string;
  label: string;
  unitsSold: string;
  revenueHt: string;
  confidence: string;
  warning: string | null;
};

const emptyState: SellOutDocumentActionState = {};

export function SellOutDocumentAnalyzer({
  captureId,
  products,
}: {
  captureId: string;
  products: ProductOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(confirmSellOutDocumentAnalysisAction, emptyState);
  const [document, setDocument] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [confidence, setConfidence] = useState("");

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  const linesPayload = useMemo(
    () =>
      JSON.stringify(
        lines.map((line) => ({
          productId: line.productId,
          sourceProductCode: line.sourceProductCode,
          ean: line.ean,
          label: line.label,
          unitsSold: line.unitsSold,
          revenueHt: line.revenueHt,
          confidence: line.confidence,
        })),
      ),
    [lines],
  );

  function updateLine(index: number, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  }

  async function analyze() {
    if (!document) {
      setAnalysisError("Ajoutez d’abord la photo ou le PDF fourni par la pharmacie.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setPreview(null);
    try {
      const payload = new FormData();
      payload.set("captureId", captureId);
      payload.set("document", document);
      const response = await fetch("/api/sell-out/document/analyze", {
        method: "POST",
        body: payload,
      });
      const body = await response.json() as { error?: string; preview?: Preview };
      if (!response.ok || !body.preview) {
        throw new Error(body.error || "Le document n’a pas pu être analysé.");
      }

      const nextPreview = body.preview;
      setPreview(nextPreview);
      setPeriodStart(nextPreview.periodStart);
      setPeriodEnd(nextPreview.periodEnd);
      setConfidence(nextPreview.confidence == null ? "" : String(nextPreview.confidence));
      setLines(
        nextPreview.lines.map((line) => ({
          productId: line.product.selectedId ?? "",
          sourceProductCode: line.sourceProductCode ?? "",
          ean: line.ean ?? "",
          label: line.label ?? "",
          unitsSold: line.unitsSold == null ? "" : String(line.unitsSold),
          revenueHt: line.revenueHt == null ? "" : String(line.revenueHt),
          confidence: line.confidence == null ? "" : String(line.confidence),
          warning: line.warning,
        })),
      );
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Le document n’a pas pu être analysé.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed p-4">
        <div className="flex items-center gap-2 font-semibold text-[var(--tr1-navy)]">
          <FileSearch className="size-4 text-[var(--tr1-orange)]" />
          Analyser le document de la pharmacie
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Photo ou PDF · aucune ligne sell-out n’est enregistrée avant votre validation.
        </p>
        <Input
          className="mt-3"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => {
            setDocument(event.target.files?.[0] ?? null);
            setPreview(null);
            setLines([]);
            setAnalysisError(null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          disabled={!document || analyzing}
          onClick={() => void analyze()}
        >
          <Sparkles className="size-4 text-[var(--tr1-orange)]" />
          {analyzing ? "Analyse…" : "Analyser le document"}
        </Button>
        {analysisError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{analysisError}</p> : null}
      </div>

      {preview ? (
        <form action={action} className="space-y-4 rounded-xl border bg-muted/10 p-4">
          <input type="hidden" name="captureId" value={captureId} />
          <input type="hidden" name="extractionPayload" value={JSON.stringify(preview.extraction)} />
          <input type="hidden" name="linesPayload" value={linesPayload} />
          {document ? (
            <input
              type="file"
              name="document"
              className="sr-only"
              ref={(input) => {
                if (!input || !document) return;
                const transfer = new DataTransfer();
                transfer.items.add(document);
                input.files = transfer.files;
              }}
            />
          ) : null}

          <div>
            <p className="font-semibold text-[var(--tr1-navy)]">Prévisualisation à confirmer</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Corrigez les produits, quantités et montants si nécessaire. Le justificatif sera enregistré avec les lignes validées.
            </p>
          </div>

          {preview.warnings.length ? (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}
          {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
          {state.warning ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{state.warning}</p> : null}
          {state.success ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p> : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span>Début période</span>
              <Input name="periodStart" type="date" required value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span>Fin période</span>
              <Input name="periodEnd" type="date" required value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span>Confiance source</span>
              <Input name="confidence" type="number" min="0" max="1" step="0.01" value={confidence} onChange={(event) => setConfidence(event.target.value)} />
            </label>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="rounded-xl border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ligne {index + 1}</p>
                  {line.warning ? <span className="text-xs text-amber-700">{line.warning}</span> : null}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span>Produit TR1</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={line.productId}
                      onChange={(event) => updateLine(index, { productId: event.target.value })}
                    >
                      <option value="">À confirmer / produit externe</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.sku ? ` · ${product.sku}` : ""}
                          {product.ean ? ` · ${product.ean}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Unités vendues</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={line.unitsSold}
                      onChange={(event) => updateLine(index, { unitsSold: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>CA HT</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.revenueHt}
                      onChange={(event) => updateLine(index, { revenueHt: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>EAN</span>
                    <Input
                      maxLength={32}
                      value={line.ean}
                      onChange={(event) => updateLine(index, { ean: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Code source</span>
                    <Input
                      maxLength={120}
                      value={line.sourceProductCode}
                      onChange={(event) => updateLine(index, { sourceProductCode: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span>Libellé source</span>
                    <Input
                      maxLength={300}
                      value={line.label}
                      onChange={(event) => updateLine(index, { label: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Confiance ligne</span>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={line.confidence}
                      onChange={(event) => updateLine(index, { confidence: event.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={pending || lines.length === 0} className="min-h-11 w-full sm:w-auto">
            <Save className="size-4" />
            {pending ? "Enregistrement…" : "Valider ces données et enregistrer"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
