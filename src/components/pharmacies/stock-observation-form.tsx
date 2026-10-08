"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Save, Sparkles } from "lucide-react";
import {
  saveStockObservationAction,
  type StockObservationActionState,
} from "@/app/(protected)/dashboard/pharmacies/[id]/stocks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalizedFileInput } from "@/components/ui/localized-file-input";
import type { StockPhotoExtraction } from "@/lib/stock-observations/extraction";

type Product = { id: string; name: string; sku: string | null; ean: string | null };
type Preview = StockPhotoExtraction & {
  product: {
    status: "matched" | "unmatched" | "ambiguous";
    selectedId: string | null;
    candidates: Array<{ id: string; name: string }>;
  };
};

function showNumber(value: number | null) {
  return value === null ? "" : String(value);
}

export function StockObservationForm({
  brandPharmacyId, visitId, products,
}: {
  brandPharmacyId: string;
  visitId: string | null;
  products: Product[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<StockObservationActionState, FormData>(
    saveStockObservationAction, {},
  );
  const [productId, setProductId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoKey, setPhotoKey] = useState(0);
  const [shelf, setShelf] = useState("");
  const [backroom, setBackroom] = useState("");
  const [facings, setFacings] = useState("");
  const [analysisPayload, setAnalysisPayload] = useState("");
  const [analysisLabel, setAnalysisLabel] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  function startAnother() {
    setPhoto(null);
    setPhotoKey((value) => value + 1);
    setProductId("");
    setShelf("");
    setBackroom("");
    setFacings("");
    setAnalysisPayload("");
    setAnalysisLabel(null);
    setWarnings([]);
    setNotes("");
    setAnalysisError(null);
  }

  async function analyze() {
    if (!photo) {
      setAnalysisError("Ajoutez une photo d'étiquette.");
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const body = new FormData();
      body.set("brandPharmacyId", brandPharmacyId);
      body.set("photo", photo);
      const response = await fetch("/api/stock-observations/analyze", { method: "POST", body });
      const data = await response.json() as { preview?: Preview; error?: string };
      if (!response.ok || !data.preview) throw new Error(data.error || "Lecture IA indisponible.");
      const { product, ...extracted } = data.preview;
      setAnalysisPayload(JSON.stringify(extracted));
      setAnalysisLabel(extracted.productLabel);
      setShelf(showNumber(extracted.stockShelf));
      setBackroom(showNumber(extracted.stockBackroom));
      setFacings(showNumber(extracted.facings));
      if (product.selectedId) setProductId(product.selectedId);
      setWarnings([
        ...extracted.warnings,
        ...(product.status === "unmatched"
          ? ["Référence non identifiée : sélectionnez-la manuellement."]
          : product.status === "ambiguous"
            ? ["Plusieurs références possibles : choisissez la bonne."]
            : []),
      ]);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Lecture impossible.");
    } finally {
      setAnalyzing(false);
    }
  }

  const total = shelf !== "" && backroom !== "" ? Number(shelf) + Number(backroom) : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} />
      <input type="hidden" name="visitId" value={visitId ?? ""} />
      <input type="hidden" name="analysisPayload" value={analysisPayload} />
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p> : null}
      {state.warning ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{state.warning}</p> : null}

      <div className="rounded-xl border border-dashed p-4">
        {state.success ? (
          <Button type="button" variant="outline" className="mb-3" onClick={startAnother}>
            Nouveau relevé
          </Button>
        ) : null}
        <Label htmlFor="stock-photo" className="flex items-center gap-2 font-semibold">
          <Camera className="size-4" /> Photographier l'étiquette
        </Label>
        <LocalizedFileInput
          key={photoKey}
          id="stock-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="mt-2"
          onChange={(event) => {
            setPhoto(event.target.files?.[0] ?? null);
            setAnalysisPayload("");
            setAnalysisLabel(null);
            setWarnings([]);
            setAnalysisError(null);
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Recadrez l'étiquette : aucune donnée patient ou personnelle. Photo de 5 Mo maximum.
        </p>
        <Button type="button" variant="outline" className="mt-3 min-h-11" disabled={analyzing || pending || !photo} onClick={analyze}>
          <Sparkles className="size-4" /> {analyzing ? "Analyse en cours…" : "Lire avec TR1 AI"}
        </Button>
        {analysisError ? <p role="alert" className="mt-2 text-sm text-amber-700">{analysisError} Vous pouvez saisir le relevé manuellement.</p> : null}
        {analysisLabel ? <p className="mt-2 text-sm">Étiquette lue : <strong>{analysisLabel}</strong></p> : null}
        {warnings.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
            {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        ) : null}
      </div>

      <div>
        <Label htmlFor="stock-product">Référence produit</Label>
        <select id="stock-product" name="productId" required value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm">
          <option value="" disabled>Choisir le produit après vérification</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}{product.sku ? " · " + product.sku : ""}{product.ean ? " · " + product.ean : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="stock-shelf">Stock rayon</Label>
          <Input id="stock-shelf" name="stockShelf" type="number" min="0" max="100000" step="1"
            placeholder="Non connu" value={shelf} onChange={(event) => setShelf(event.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="stock-backroom">Stock dépôt / réserve</Label>
          <Input id="stock-backroom" name="stockBackroom" type="number" min="0" max="100000" step="1"
            placeholder="Non connu" value={backroom} onChange={(event) => setBackroom(event.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="stock-facings">Facings (emplacements)</Label>
          <Input id="stock-facings" name="facings" type="number" min="0" max="1000" step="1"
            placeholder="Non connu" value={facings} onChange={(event) => setFacings(event.target.value)} className="mt-1.5" />
        </div>
      </div>

      <p className="rounded-lg bg-muted p-3 text-sm">
        <strong>Stock total : {total === null ? "indéterminé" : total + " unités"}</strong>
        <span className="ml-2 text-muted-foreground">Calculé seulement si rayon ET réserve sont connus. Les facings ne sont jamais ajoutés.</span>
      </p>

      <div>
        <Label htmlFor="stock-notes">Précision sur l'étiquette (facultatif)</Label>
        <Input id="stock-notes" name="notes" value={notes}
          onChange={(event) => setNotes(event.target.value)} maxLength={2000}
          placeholder="Ex. convention de l'officine confirmée avec le titulaire" className="mt-1.5" />
      </div>
      <p className="text-xs text-muted-foreground">
        Vous validez les chiffres avant enregistrement. Chaque relevé constitue un nouveau point d'historique, sans écraser les précédents.
      </p>
      <Button type="submit" disabled={pending || analyzing || !productId || (shelf === "" && backroom === "" && facings === "")} className="min-h-11">
        <Save className="size-4" /> {pending ? "Enregistrement…" : "Valider et enregistrer"}
      </Button>
    </form>
  );
}
