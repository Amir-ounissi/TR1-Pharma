"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ScanSearch, Save } from "lucide-react";
import {
  savePriceObservationAction,
  type PriceObservationActionState,
} from "@/app/(protected)/dashboard/pharmacies/[id]/prices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyState: PriceObservationActionState = {};

type AnalysisPreview = {
  extraction: {
    productLabel: string | null;
    ean: string | null;
    priceTtc: number | null;
    priceType: "regular" | "promotion" | "bundle" | "other";
    bundleQuantity: number | null;
    confidence: number;
  };
  product: {
    status: "matched" | "suggested" | "unmatched" | "ambiguous";
    selectedId: string | null;
    selectedName: string | null;
    referencePriceTtc: number | null;
    candidates: Array<{
      id: string;
      name: string;
      sku: string | null;
      ean: string | null;
      retailPriceTtc: number | null;
    }>;
  };
  warnings: string[];
};

export function PriceObservationForm({
  brandPharmacyId,
  visitId,
  products,
}: {
  brandPharmacyId: string;
  visitId?: string | null;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    ean: string | null;
    retailPriceTtc: number | string | null;
  }>;
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(savePriceObservationAction, emptyState);
  const [priceType, setPriceType] = useState<"regular" | "promotion" | "bundle" | "other">("regular");
  const [method, setMethod] = useState<"photo" | "manual" | "import">("photo");
  const [productId, setProductId] = useState("");
  const [priceTtc, setPriceTtc] = useState("");
  const [bundleQuantity, setBundleQuantity] = useState("");
  const [observedEan, setObservedEan] = useState("");
  const [confidence, setConfidence] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisPreview | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (state.success && !state.error) router.refresh();
  }, [state.success, state.error, router]);

  async function analyzePhoto() {
    const photo = photoRef.current?.files?.[0];
    if (!photo) {
      setAnalysisError("Prenez ou sélectionnez d’abord la photo du produit et de son prix.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const body = new FormData();
      body.set("brandPharmacyId", brandPharmacyId);
      body.set("photo", photo);
      const response = await fetch("/api/field-data/price/analyze", {
        method: "POST",
        body,
      });
      const payload = await response.json() as {
        error?: string;
        preview?: AnalysisPreview;
      };
      if (!response.ok || !payload.preview) {
        throw new Error(payload.error || "La photo n’a pas pu être analysée.");
      }

      const preview = payload.preview;
      setAnalysis(preview);
      if (preview.product.selectedId) setProductId(preview.product.selectedId);
      if (preview.extraction.priceTtc != null) {
        setPriceTtc(String(preview.extraction.priceTtc));
      }
      setPriceType(preview.extraction.priceType);
      setBundleQuantity(
        preview.extraction.bundleQuantity == null
          ? ""
          : String(preview.extraction.bundleQuantity),
      );
      setObservedEan(preview.extraction.ean ?? "");
      setConfidence(String(preview.extraction.confidence));
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "La photo n’a pas pu être analysée.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} />
      <input type="hidden" name="visitId" value={visitId ?? ""} />

      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p> : null}

      <div>
        <Label htmlFor="capture-method">Source</Label>
        <select
          id="capture-method"
          name="captureMethod"
          value={method}
          onChange={(event) => {
            setMethod(event.target.value as typeof method);
            setAnalysis(null);
            setAnalysisError(null);
          }}
          className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
        >
          <option value="photo">Photo terrain</option>
          <option value="manual">Saisie manuelle</option>
          <option value="import">Import</option>
        </select>
      </div>

      {method === "photo" ? (
        <div className="rounded-xl border border-dashed p-3">
          <Label htmlFor="price-photo" className="flex cursor-pointer items-center gap-2 font-medium">
            <Camera className="size-4 text-[var(--tr1-orange)]" />
            Photo produit + étiquette prix
          </Label>
          <Input
            ref={photoRef}
            id="price-photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            required
            className="mt-2"
            onChange={() => {
              setAnalysis(null);
              setAnalysisError(null);
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={analyzing}
              onClick={() => void analyzePhoto()}
            >
              <ScanSearch className="size-4" />
              {analyzing ? "Analyse en cours…" : "Analyser la photo"}
            </Button>
            <p className="text-xs text-muted-foreground">
              TR1 propose. Vous vérifiez avant enregistrement.
            </p>
          </div>
          {analysisError ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {analysisError}
            </p>
          ) : null}
          {analysis ? (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-950">
              <p className="font-semibold">
                Prévisualisation TR1
                {analysis.extraction.productLabel ? " · " + analysis.extraction.productLabel : ""}
              </p>
              <p className="mt-1 text-xs text-blue-900/80">
                Confiance {Math.round(analysis.extraction.confidence * 100)} %
                {analysis.product.selectedName ? " · produit proposé : " + analysis.product.selectedName : ""}
              </p>
              {analysis.warnings.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-blue-900/80">
                  {analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            La photo est une preuve privée. Évitez toute personne ou donnée client dans le cadre.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="price-product">Produit</Label>
          <select
            id="price-product"
            name="productId"
            required
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="" disabled>Choisir un produit</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {product.sku ? " · " + product.sku : ""}
                {product.retailPriceTtc != null ? " · réf. " + product.retailPriceTtc + " €" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="price-ttc">Prix TTC observé</Label>
          <Input
            id="price-ttc"
            name="priceTtc"
            type="number"
            min="0.01"
            max="10000"
            step="0.01"
            required
            className="mt-1.5"
            placeholder="19,90"
            value={priceTtc}
            onChange={(event) => setPriceTtc(event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="price-type">Type de prix</Label>
          <select
            id="price-type"
            name="priceType"
            value={priceType}
            onChange={(event) => setPriceType(event.target.value as typeof priceType)}
            className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="regular">Prix normal</option>
            <option value="promotion">Promotion</option>
            <option value="bundle">Lot</option>
            <option value="other">Autre</option>
          </select>
        </div>

        {priceType === "bundle" ? (
          <div>
            <Label htmlFor="bundle-quantity">Quantité dans le lot</Label>
            <Input
              id="bundle-quantity"
              name="bundleQuantity"
              type="number"
              min="2"
              max="100"
              step="1"
              required
              className="mt-1.5"
              value={bundleQuantity}
              onChange={(event) => setBundleQuantity(event.target.value)}
            />
          </div>
        ) : null}

        <div>
          <Label htmlFor="observed-ean">EAN observé</Label>
          <Input
            id="observed-ean"
            name="observedEan"
            maxLength={32}
            className="mt-1.5"
            placeholder="Facultatif"
            value={observedEan}
            onChange={(event) => setObservedEan(event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="price-confidence">Confiance</Label>
          <Input
            id="price-confidence"
            name="confidence"
            type="number"
            min="0"
            max="1"
            step="0.01"
            className="mt-1.5"
            placeholder="Facultatif"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="price-notes">Commentaire</Label>
        <Textarea id="price-notes" name="notes" maxLength={2000} rows={2} className="mt-1.5" placeholder="Ex. promo tête de gondole, prix barré…" />
      </div>

      <Button disabled={pending || analyzing} className="min-h-11 w-full sm:w-auto">
        <Save className="size-4" />
        {pending ? "Enregistrement…" : "Enregistrer le prix observé"}
      </Button>
    </form>
  );
}
