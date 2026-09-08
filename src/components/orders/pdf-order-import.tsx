"use client";

import { Camera, FileUp, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useRef, useState, type ReactNode } from "react";
import { analyzePdfOrderAction, confirmPdfOrderAction, type PdfOrderPreview } from "@/app/(protected)/dashboard/orders/pdf-actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { translateMatchMethod, translateUiMessage } from "@/lib/ui-copy";

const MAX_ORDER_DOCUMENT_SIZE = 3 * 1024 * 1024;
const TARGET_ORDER_IMAGE_SIZE = 1.5 * 1024 * 1024;
const ORDER_DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const ORDER_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

type DraftLine = {
  productId: string;
  quantity: string;
  freeQuantity: string;
  unitPriceHt: string;
  discountRate: string;
};

function toDraftLines(preview: PdfOrderPreview): DraftLine[] {
  return preview.lines.map((line) => ({
    productId: line.product.selectedId || (line.product.status === "matched" ? line.product.candidates[0]?.id ?? "" : ""),
    quantity: line.quantity == null ? "" : String(line.quantity),
    freeQuantity: String(line.freeQuantity ?? 0),
    unitPriceHt: line.suggestedPriceHt == null ? "" : String(line.suggestedPriceHt),
    discountRate: line.discountRate == null ? "" : String(line.discountRate),
  }));
}

function ProductSelect({ line, value, onChange }: { line: PdfOrderPreview["lines"][number]; value: string; onChange: (value: string) => void }) {
  return (
    <select
      aria-label={`Produit ${line.index + 1}`}
      className="h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Sélectionner un produit</option>
      {line.product.candidates.map((candidate) => (
        <option key={candidate.id} value={candidate.id}>
          {candidate.name} {candidate.sku ? `· ${candidate.sku}` : ""}
        </option>
      ))}
    </select>
  );
}

function replaceInputFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

function isHeicPhoto(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

async function compressOrderPhoto(file: File): Promise<File> {
  if (file.size <= TARGET_ORDER_IMAGE_SIZE && !isHeicPhoto(file)) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image_decode_failed"));
      image.src = objectUrl;
    });
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1800 / largestSide);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "commande";
    for (const quality of [0.8, 0.7, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_ORDER_DOCUMENT_SIZE) {
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
      }
    }
    throw new Error("image_too_large");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function OrderEntryModes({ manual, isAgent = false }: { manual: ReactNode; isAgent?: boolean }) {
  const [mode, setMode] = useState<"manual" | "document">("manual");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        <Button type="button" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>Saisie manuelle</Button>
        <Button type="button" variant={mode === "document" ? "default" : "outline"} onClick={() => setMode("document")}>Scanner / importer</Button>
      </div>
      {mode === "manual" ? manual : <PdfOrderImport isAgent={isAgent} />}
    </div>
  );
}

export function PdfOrderImport({ isAgent = false }: { isAgent?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [analysis, analyzeAction, analyzing] = useActionState(analyzePdfOrderAction, {});
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const preview = analysis.preview;

  async function prepareFile(file: File | undefined, input: HTMLInputElement | null, otherInput: HTMLInputElement | null) {
    if (!file || !input) return;
    const supportedImage = ORDER_IMAGE_TYPES.has(file.type) || isHeicPhoto(file);
    if (file.type !== "application/pdf" && !supportedImage) {
      input.value = "";
      setFileName("");
      setFileError("Ajoutez un PDF ou une photo JPG, PNG, WebP ou HEIC.");
      return;
    }
    if (file.type === "application/pdf" && file.size > MAX_ORDER_DOCUMENT_SIZE) {
      input.value = "";
      setFileName("");
      setFileError("Le PDF ne peut pas dépasser 3 Mo.");
      return;
    }
    try {
      const prepared = supportedImage ? await compressOrderPhoto(file) : file;
      if (prepared.size > MAX_ORDER_DOCUMENT_SIZE) throw new Error("file_too_large");
      if (prepared !== file) replaceInputFile(input, prepared);
      if (otherInput) otherInput.value = "";
      setFileError("");
      setFileName(prepared.name);
    } catch {
      input.value = "";
      setFileName("");
      setFileError("La photo est trop lourde ou illisible. Reprenez une photo nette de la commande.");
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <form
        action={analyzeAction}
        className="space-y-3 rounded-2xl border border-dashed p-3 sm:space-y-4 sm:p-5"
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (!file || !inputRef.current) return;
          replaceInputFile(inputRef.current, file);
          void prepareFile(file, inputRef.current, cameraRef.current);
        }}
        onDragOver={(event) => event.preventDefault()}
      >
        <div>
          <h2 className="font-medium">Ajouter la commande</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">
            Scannez la commande avec la caméra du téléphone ou importez un PDF. La capture web est optimisée avant analyse et vous vérifierez toujours les données avant création.
          </p>
        </div>

        <input
          ref={inputRef}
          id="order-document-file"
          name="document"
          type="file"
          accept={ORDER_DOCUMENT_ACCEPT}
          className="sr-only"
          onChange={(event) => void prepareFile(event.target.files?.[0], event.currentTarget, cameraRef.current)}
        />
        <input
          ref={cameraRef}
          id="order-camera-file"
          name="camera"
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => void prepareFile(event.target.files?.[0], event.currentTarget, inputRef.current)}
        />

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" />
            Photo
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => inputRef.current?.click()}>
            <FileUp className="size-4" />
            Importer
          </Button>
        </div>

        {fileName ? (
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/45 px-3 py-2 text-sm">
            <span className="shrink-0 font-medium">Prêt :</span>
            <span className="truncate text-muted-foreground">{fileName}</span>
          </div>
        ) : (
          <p className="text-center text-[0.68rem] text-muted-foreground">PDF ou scan caméra · 3 Mo max après optimisation</p>
        )}
        {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
        <ActionFeedback {...analysis} />
        <Button
          disabled={analyzing || Boolean(fileError) || !fileName}
          className="h-11 w-full rounded-xl bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)] sm:w-auto"
        >
          {analyzing ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {analyzing ? "Analyse en cours…" : "Analyser la commande"}
        </Button>
        {analyzing ? <p className="text-center text-xs text-muted-foreground sm:text-left">Lecture du document et rapprochement des produits…</p> : null}
      </form>

      {preview ? <PdfOrderPreviewForm key={`${preview.extraction.orderNumber}-${preview.extraction.orderDate}-${preview.lines.length}`} preview={preview} isAgent={isAgent} /> : null}
    </div>
  );
}

function PdfOrderPreviewForm({ preview, isAgent }: { preview: PdfOrderPreview; isAgent: boolean }) {
  const [confirmation, confirmAction, confirming] = useActionState(confirmPdfOrderAction, {});
  const [pharmacyId, setPharmacyId] = useState(preview.pharmacy.selectedPharmacyId || "");
  const [brandPharmacyId, setBrandPharmacyId] = useState(preview.pharmacy.selectedBrandPharmacyId || "");
  const [createMissing, setCreateMissing] = useState(false);
  const [orderNumber, setOrderNumber] = useState(preview.extraction.orderNumber ?? "");
  const [orderDate, setOrderDate] = useState(preview.extraction.orderDate?.slice(0, 10) ?? "");
  const [newPharmacy, setNewPharmacy] = useState({
    legalName: preview.extraction.pharmacy.name ?? "",
    tradeName: preview.extraction.pharmacy.name ?? "",
    siret: preview.extraction.pharmacy.siret ?? "",
    cip: preview.extraction.pharmacy.cip ?? "",
    finess: preview.extraction.pharmacy.finess ?? "",
    postalCode: preview.extraction.pharmacy.postalCode ?? "",
    city: "",
    address: preview.extraction.pharmacy.address ?? "",
  });
  const [lines, setLines] = useState(() => toDraftLines(preview));

  function updateLine(index: number, field: keyof DraftLine, value: string) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  }

  const totalTr1 = useMemo(() => {
    const total = lines.reduce((sum, line) => {
      const quantity = Number(line.quantity);
      const price = Number(line.unitPriceHt);
      const discount = Number(line.discountRate || "0");
      if (!Number.isFinite(quantity) || !Number.isFinite(price)) return sum;
      return sum + roundCurrency(quantity * price * (1 - discount / 100));
    }, 0);
    return Number(total.toFixed(2));
  }, [lines]);

  const reviewWarnings = useMemo(() => {
    const warnings = preview.warnings.map((warning) => translateUiMessage(warning));
    if (preview.extraction.totalHt != null && Math.abs(preview.extraction.totalHt - totalTr1) > 0.02) {
      warnings.unshift("Le total du document diffère du total recalculé TR1 de plus de 0,02 €.");
    }
    return [...new Set(warnings)];
  }, [preview.extraction.totalHt, preview.warnings, totalTr1]);

  const canConfirm = Boolean(
    (brandPharmacyId || pharmacyId || (createMissing && newPharmacy.legalName))
    && orderNumber.trim()
    && orderDate
    && lines.length > 0
    && lines.every((line) => line.productId && Number(line.quantity) > 0 && Number(line.freeQuantity) >= 0 && Number(line.unitPriceHt) >= 0),
  );

  return (
    <form action={confirmAction} className="space-y-4 rounded-2xl border p-3 pb-28 sm:space-y-5 sm:p-5 md:pb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium">Vérifier la commande</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">Corrigez uniquement ce qui est nécessaire avant validation.</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[0.66rem] font-medium text-muted-foreground sm:text-xs">Aucune écriture</span>
      </div>
      <ActionFeedback {...confirmation} />

      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        <div className="space-y-1">
          <Label>Pharmacie</Label>
          {preview.pharmacy.candidates.length > 0 ? (
            <select
              aria-label="Pharmacie"
              className="h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm"
              value={pharmacyId}
              onChange={(event) => {
                const candidate = preview.pharmacy.candidates.find((item) => item.pharmacyId === event.target.value);
                setPharmacyId(event.target.value);
                setBrandPharmacyId(candidate?.brandPharmacyId ?? "");
                setCreateMissing(false);
              }}
            >
              <option value="">Sélectionner une pharmacie</option>
              {preview.pharmacy.candidates.map((candidate) => (
                <option key={candidate.pharmacyId} value={candidate.pharmacyId}>{candidate.name} {candidate.postalCode ? `· ${candidate.postalCode}` : ""}</option>
              ))}
            </select>
          ) : (
            <>
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">Pharmacie absente du référentiel TR1. La création sera vérifiée à la confirmation.</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createMissing} onChange={(event) => { setCreateMissing(event.target.checked); setPharmacyId(""); setBrandPharmacyId(""); }} />Créer cette pharmacie et continuer</label>
            </>
          )}
          {brandPharmacyId ? <p className="text-xs text-muted-foreground">Déjà cliente de la marque.</p> : null}
          {!brandPharmacyId && pharmacyId ? <p className="text-xs text-muted-foreground">Nouvelle pharmacie pour la marque : rattachement à la confirmation.</p> : null}
          {!pharmacyId && preview.pharmacy.status === "suggested" ? <p className="text-xs text-amber-700">Correspondance probable : vérifiez la pharmacie.</p> : null}
          {!pharmacyId && preview.pharmacy.status === "unmatched" && preview.pharmacy.candidates.length > 0 ? <p className="text-xs text-amber-700">Choisissez la bonne pharmacie parmi les propositions.</p> : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor="pdf-order-number">Numéro commande</Label>
          <Input id="pdf-order-number" name="orderNumber" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} required className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pdf-order-date">Date</Label>
          <Input id="pdf-order-date" name="orderDate" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} required className="h-11 rounded-xl" />
        </div>
      </div>

      {createMissing ? (
        <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-2">
          {([['legalName','Nom'],['tradeName','Enseigne'],['siret','SIRET'],['cip','CIP'],['finess','FINESS'],['postalCode','Code postal'],['city','Ville'],['address','Adresse']] as const).map(([field, label]) => (
            <div key={field}><Label htmlFor={`new-pharmacy-${field}`}>{label}</Label><Input id={`new-pharmacy-${field}`} value={newPharmacy[field]} onChange={(event) => setNewPharmacy((current) => ({ ...current, [field]: event.target.value }))} /></div>
          ))}
        </div>
      ) : null}

      <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} />
      <input type="hidden" name="pharmacyId" value={brandPharmacyId ? "" : pharmacyId} />
      <input type="hidden" name="newPharmacy" value={createMissing ? JSON.stringify(newPharmacy) : ""} />
      <input type="hidden" name="items" value={JSON.stringify(lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), freeQuantity: Number(line.freeQuantity || "0"), unitPriceHt: Number(line.unitPriceHt), discountRate: line.discountRate === "" ? null : Number(line.discountRate) })))} />

      <div className="space-y-3 md:hidden">
        {preview.lines.map((line, index) => {
          const selected = line.product.candidates.find((candidate) => candidate.id === lines[index]?.productId);
          const documentTaxRate = preview.extraction.lines[index]?.taxRate ?? null;
          const displayedTaxRate = selected?.taxRate ?? documentTaxRate;
          return (
            <section key={line.index} className="min-w-0 space-y-3 rounded-2xl border bg-white/55 p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-[var(--tr1-navy)]">{line.label || "Produit non identifié"}</p>
                <p className="mt-0.5 break-all text-[0.68rem] text-muted-foreground">{line.ean || line.sku || "Référence absente"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Produit TR1</Label>
                <ProductSelect line={line} value={lines[index]?.productId ?? ""} onChange={(value) => updateLine(index, "productId", value)} />
                <p className="text-[0.68rem] text-muted-foreground">{line.product.status === "matched" ? `Correspondance ${translateMatchMethod(line.product.method)}` : "Sélection requise."}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MobileNumberField label="Qté" ariaLabel={`Quantité ${index + 1}`} min="1" value={lines[index]?.quantity ?? ""} onChange={(value) => updateLine(index, "quantity", value)} />
                <MobileNumberField label="UG" ariaLabel={`UG ${index + 1}`} min="0" value={lines[index]?.freeQuantity ?? "0"} onChange={(value) => updateLine(index, "freeQuantity", value)} />
                <MobileNumberField label="Prix HT" ariaLabel={`Prix HT ${index + 1}`} min="0" step="0.01" value={lines[index]?.unitPriceHt ?? ""} onChange={(value) => updateLine(index, "unitPriceHt", value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MobileNumberField label="Remise %" ariaLabel={`Remise ${index + 1}`} min="0" max="100" step="0.01" value={lines[index]?.discountRate ?? ""} onChange={(value) => updateLine(index, "discountRate", value)} />
                <div className="space-y-1">
                  <Label className="text-xs">TVA</Label>
                  <div className="flex h-10 items-center rounded-xl border bg-muted/25 px-3 text-sm">{displayedTaxRate == null ? "—" : `${displayedTaxRate}%`}</div>
                </div>
              </div>
              {line.priceWarning ? <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">{line.priceWarning}</p> : null}
            </section>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground"><tr><th className="p-2">Produit document</th><th className="p-2">Produit TR1</th><th className="p-2">Qté</th><th className="p-2">UG</th><th className="p-2">Prix HT</th><th className="p-2">Remise</th><th className="p-2">TVA</th></tr></thead>
          <tbody>
            {preview.lines.map((line, index) => {
              const selected = line.product.candidates.find((candidate) => candidate.id === lines[index]?.productId);
              const documentTaxRate = preview.extraction.lines[index]?.taxRate ?? null;
              const displayedTaxRate = selected?.taxRate ?? documentTaxRate;
              return (
                <tr key={line.index} className="border-b align-top">
                  <td className="p-2"><p className="font-medium">{line.label || "Libellé absent"}</p><p className="text-xs text-muted-foreground">{line.ean || line.sku || "Référence absente"}</p></td>
                  <td className="min-w-56 p-2"><ProductSelect line={line} value={lines[index]?.productId ?? ""} onChange={(value) => updateLine(index, "productId", value)} /><p className="mt-1 text-xs text-muted-foreground">{line.product.status === "matched" ? `Correspondance ${translateMatchMethod(line.product.method)}` : "Sélection requise."}</p></td>
                  <td className="p-2"><Input aria-label={`Quantité ${index + 1}`} type="number" min="1" value={lines[index]?.quantity ?? ""} onChange={(event) => updateLine(index, "quantity", event.target.value)} /></td>
                  <td className="p-2"><Input aria-label={`UG ${index + 1}`} type="number" min="0" value={lines[index]?.freeQuantity ?? "0"} onChange={(event) => updateLine(index, "freeQuantity", event.target.value)} /></td>
                  <td className="p-2"><Input aria-label={`Prix HT ${index + 1}`} type="number" min="0" step="0.01" value={lines[index]?.unitPriceHt ?? ""} onChange={(event) => updateLine(index, "unitPriceHt", event.target.value)} />{line.priceWarning ? <p className="mt-1 text-xs text-amber-700">{line.priceWarning}</p> : null}</td>
                  <td className="p-2"><Input aria-label={`Remise ${index + 1}`} type="number" min="0" max="100" step="0.01" value={lines[index]?.discountRate ?? ""} onChange={(event) => updateLine(index, "discountRate", event.target.value)} /></td>
                  <td className="p-2">{displayedTaxRate == null ? "—" : `${displayedTaxRate}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl bg-muted/40 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <TotalItem label="Document HT" value={preview.extraction.totalHt == null ? "—" : `${preview.extraction.totalHt.toFixed(2)} €`} />
          <TotalItem label="TVA" value={preview.extraction.totalVat == null ? "—" : `${preview.extraction.totalVat.toFixed(2)} €`} />
          <TotalItem label="Document TTC" value={preview.extraction.totalTtc == null ? "—" : `${preview.extraction.totalTtc.toFixed(2)} €`} />
          <TotalItem label="TR1 HT" value={`${totalTr1.toFixed(2)} €`} />
        </div>
        {reviewWarnings.length > 0 ? (
          <details className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
            <summary className="cursor-pointer font-medium">{reviewWarnings.length} point{reviewWarnings.length > 1 ? "s" : ""} à vérifier</summary>
            <ul className="mt-2 space-y-1.5 pl-4 text-xs leading-relaxed">
              {reviewWarnings.map((warning) => <li className="list-disc" key={warning}>{warning}</li>)}
            </ul>
          </details>
        ) : (
          <p className="mt-3 text-xs font-medium text-emerald-700">Aucune anomalie détectée dans le document.</p>
        )}
      </div>

      <div className="fixed inset-x-3 bottom-[calc(5.2rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border bg-[var(--tr1-ivory)]/96 p-2 shadow-lg backdrop-blur md:static md:flex md:flex-wrap md:items-center md:gap-3 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <Button disabled={!canConfirm || confirming} className="h-12 w-full rounded-xl md:h-10 md:w-auto">
          {confirming ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {confirming ? "Enregistrement…" : isAgent ? "Envoyer à la marque" : "Valider la commande"}
        </Button>
        {confirmation.orderId ? <Link className="mt-2 block text-center text-sm underline md:mt-0" href={`/dashboard/orders/${confirmation.orderId}`}>Ouvrir la commande</Link> : null}
      </div>
    </form>
  );
}

function MobileNumberField({ label, ariaLabel, value, onChange, min, max, step }: { label: string; ariaLabel: string; value: string; onChange: (value: string) => void; min?: string; max?: string; step?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        aria-label={ariaLabel}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-xl px-2 text-sm"
      />
    </div>
  );
}

function TotalItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] text-muted-foreground">{label}</p>
      <p className="font-semibold text-[var(--tr1-navy)]">{value}</p>
    </div>
  );
}
