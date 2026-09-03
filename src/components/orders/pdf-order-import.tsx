"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState, type ReactNode } from "react";
import { analyzePdfOrderAction, confirmPdfOrderAction, type PdfOrderPreview } from "@/app/(protected)/dashboard/orders/pdf-actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DraftLine = { productId: string; quantity: string; unitPriceHt: string; discountRate: string };

function toDraftLines(preview: PdfOrderPreview): DraftLine[] {
  return preview.lines.map((line) => ({ productId: line.product.selectedId || (line.product.status === "matched" ? line.product.candidates[0]?.id ?? "" : ""), quantity: line.quantity == null ? "" : String(line.quantity), unitPriceHt: line.suggestedPriceHt == null ? "" : String(line.suggestedPriceHt), discountRate: line.discountRate == null ? "" : String(line.discountRate) }));
}

function ProductSelect({ line, value, onChange }: { line: PdfOrderPreview["lines"][number]; value: string; onChange: (value: string) => void }) {
  const candidates = line.product.candidates;
  return <select aria-label={`Produit ${line.index + 1}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Sélectionner un produit</option>
    {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} {candidate.sku ? `· ${candidate.sku}` : ""}</option>)}
  </select>;
}

export function OrderEntryModes({ manual }: { manual: ReactNode }) {
  const [mode, setMode] = useState<"manual" | "pdf">("manual");
  return <div className="space-y-5">
    <div className="flex gap-2 border-b pb-4"><Button type="button" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>Saisie manuelle</Button><Button type="button" variant={mode === "pdf" ? "default" : "outline"} onClick={() => setMode("pdf")}>Importer un PDF</Button></div>
    {mode === "manual" ? manual : <PdfOrderImport />}
  </div>;
}

export function PdfOrderImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analysis, analyzeAction, analyzing] = useActionState(analyzePdfOrderAction, {});
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const preview = analysis.preview;

  function validateFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") { setFileError("Ajoutez uniquement un fichier PDF."); return; }
    if (file.size > 3 * 1024 * 1024) { setFileError("Le PDF ne peut pas dépasser 3 Mo."); return; }
    setFileError(""); setFileName(file.name);
  }

  return <div className="space-y-6">
    <form action={analyzeAction} className="space-y-3 rounded-lg border border-dashed p-5" onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (!file || !inputRef.current) return; const transfer = new DataTransfer(); transfer.items.add(file); inputRef.current.files = transfer.files; validateFile(file); }} onDragOver={(event) => event.preventDefault()}>
      <div><h2 className="font-medium">Importer un PDF de commande</h2><p className="text-sm text-muted-foreground">PDF uniquement, 3 Mo maximum. Rien n’est créé avant confirmation.</p></div>
      <Label htmlFor="pdf-order-file" className="sr-only">PDF de commande</Label><Input ref={inputRef} id="pdf-order-file" name="pdf" type="file" accept="application/pdf" required onChange={(event) => validateFile(event.target.files?.[0])} />
      {fileName ? <p className="text-sm text-muted-foreground">{fileName}</p> : null}{fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
      <ActionFeedback {...analysis} />
      <Button disabled={analyzing || Boolean(fileError)}>{analyzing ? "Analyse du PDF…" : "Analyser le PDF"}</Button>
    </form>

    {preview ? <PdfOrderPreviewForm key={`${preview.extraction.orderNumber}-${preview.extraction.orderDate}-${preview.lines.length}`} preview={preview} /> : null}
  </div>;
}

function PdfOrderPreviewForm({ preview }: { preview: PdfOrderPreview }) {
  const [confirmation, confirmAction, confirming] = useActionState(confirmPdfOrderAction, {});
  const [pharmacyId, setPharmacyId] = useState(preview.pharmacy.selectedPharmacyId || "");
  const [brandPharmacyId, setBrandPharmacyId] = useState(preview.pharmacy.selectedBrandPharmacyId || "");
  const [createMissing, setCreateMissing] = useState(false);
  const [newPharmacy, setNewPharmacy] = useState({ legalName: preview.extraction.pharmacy.name ?? "", tradeName: preview.extraction.pharmacy.name ?? "", siret: preview.extraction.pharmacy.siret ?? "", cip: preview.extraction.pharmacy.cip ?? "", finess: preview.extraction.pharmacy.finess ?? "", postalCode: preview.extraction.pharmacy.postalCode ?? "", city: "", address: preview.extraction.pharmacy.address ?? "" });
  const [lines, setLines] = useState(() => toDraftLines(preview));
  function updateLine(index: number, field: keyof DraftLine, value: string) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  }
  const totalTr1 = useMemo(() => Number(lines.reduce((total, line) => {
    const quantity = Number(line.quantity); const price = Number(line.unitPriceHt); const discount = Number(line.discountRate || "0");
    return Number.isFinite(quantity) && Number.isFinite(price) ? total + quantity * price * (1 - discount / 100) : total;
  }, 0).toFixed(2)), [lines]);
  const canConfirm = Boolean((brandPharmacyId || pharmacyId || (createMissing && newPharmacy.legalName)) && preview.extraction.orderNumber && preview.extraction.orderDate && lines.length > 0 && lines.every((line) => line.productId && Number(line.quantity) > 0 && Number(line.unitPriceHt) >= 0));
  return <form action={confirmAction} className="space-y-5 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-4"><div><h2 className="font-medium">Prévisualisation obligatoire</h2><p className="text-sm text-muted-foreground">Vérifiez les correspondances avant création.</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">Aucune écriture effectuée</span></div>
      <ActionFeedback {...confirmation} />
      <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1"><Label>Pharmacie</Label>{preview.pharmacy.candidates.length > 0 ? <select aria-label="Pharmacie" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={pharmacyId} onChange={(event) => { const candidate = preview.pharmacy.candidates.find((item) => item.pharmacyId === event.target.value); setPharmacyId(event.target.value); setBrandPharmacyId(candidate?.brandPharmacyId ?? ""); setCreateMissing(false); }}><option value="">Sélectionner une pharmacie</option>{preview.pharmacy.candidates.map((candidate) => <option key={candidate.pharmacyId} value={candidate.pharmacyId}>{candidate.name} {candidate.postalCode ? `· ${candidate.postalCode}` : ""}</option>)}</select> : <><p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Pharmacie absente du référentiel TR1. La création est explicite et sera vérifiée à la confirmation.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createMissing} onChange={(event) => { setCreateMissing(event.target.checked); setPharmacyId(""); setBrandPharmacyId(""); }} />Créer cette pharmacie et continuer</label></>}{brandPharmacyId ? <p className="text-xs text-muted-foreground">Déjà cliente de la marque.</p> : pharmacyId ? <p className="text-xs text-muted-foreground">Nouvelle pharmacie pour la marque : rattachement à la confirmation.</p> : preview.pharmacy.status === "suggested" ? <p className="text-xs text-amber-700">Correspondance probable trouvée : vérifiez la pharmacie avant confirmation.</p> : preview.pharmacy.status === "unmatched" && preview.pharmacy.candidates.length > 0 ? <p className="text-xs text-amber-700">Aucune correspondance certaine : choisissez parmi les pharmacies trouvées au même code postal.</p> : null}</div><div className="space-y-1"><Label htmlFor="pdf-order-number">Numéro commande</Label><Input id="pdf-order-number" name="orderNumber" defaultValue={preview.extraction.orderNumber ?? ""} required /></div><div className="space-y-1"><Label htmlFor="pdf-order-date">Date</Label><Input id="pdf-order-date" name="orderDate" type="date" defaultValue={preview.extraction.orderDate?.slice(0, 10) ?? ""} required /></div></div>
      {createMissing ? <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">{([['legalName','Nom'],['tradeName','Enseigne'],['siret','SIRET'],['cip','CIP'],['finess','FINESS'],['postalCode','Code postal'],['city','Ville'],['address','Adresse']] as const).map(([field, label]) => <div key={field}><Label htmlFor={`new-pharmacy-${field}`}>{label}</Label><Input id={`new-pharmacy-${field}`} value={newPharmacy[field]} onChange={(event) => setNewPharmacy((current) => ({ ...current, [field]: event.target.value }))} /></div>)}</div> : null}
      <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} /><input type="hidden" name="pharmacyId" value={brandPharmacyId ? "" : pharmacyId} /><input type="hidden" name="newPharmacy" value={createMissing ? JSON.stringify(newPharmacy) : ""} /><input type="hidden" name="items" value={JSON.stringify(lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPriceHt: Number(line.unitPriceHt), discountRate: line.discountRate === "" ? null : Number(line.discountRate) })))} />
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="p-2">Produit PDF</th><th className="p-2">Produit TR1</th><th className="p-2">Qté</th><th className="p-2">Prix HT</th><th className="p-2">Remise</th><th className="p-2">TVA TR1</th></tr></thead><tbody>{preview.lines.map((line, index) => { const selected = line.product.candidates.find((candidate) => candidate.id === lines[index]?.productId); return <tr key={line.index} className="border-b align-top"><td className="p-2"><p className="font-medium">{line.label || "Libellé absent"}</p><p className="text-xs text-muted-foreground">{line.ean || line.sku || "Référence absente"}</p></td><td className="min-w-56 p-2"><ProductSelect line={line} value={lines[index]?.productId ?? ""} onChange={(value) => updateLine(index, "productId", value)} /><p className="mt-1 text-xs text-muted-foreground">{line.product.status === "matched" ? `Correspondance ${line.product.method}` : "Sélection requise."}</p></td><td className="p-2"><Input aria-label={`Quantité ${index + 1}`} type="number" min="1" value={lines[index]?.quantity ?? ""} onChange={(event) => updateLine(index, "quantity", event.target.value)} /></td><td className="p-2"><Input aria-label={`Prix HT ${index + 1}`} type="number" min="0" step="0.01" value={lines[index]?.unitPriceHt ?? ""} onChange={(event) => updateLine(index, "unitPriceHt", event.target.value)} />{line.priceWarning ? <p className="mt-1 text-xs text-amber-700">{line.priceWarning}</p> : null}</td><td className="p-2"><Input aria-label={`Remise ${index + 1}`} type="number" min="0" max="100" step="0.01" value={lines[index]?.discountRate ?? ""} onChange={(event) => updateLine(index, "discountRate", event.target.value)} /></td><td className="p-2">{selected?.taxRate ?? "—"}%</td></tr>; })}</tbody></table></div>
      <div className="space-y-1 rounded-md bg-muted/40 p-4 text-sm"><p>Total PDF HT : <strong>{preview.extraction.totalHt == null ? "Non indiqué" : `${preview.extraction.totalHt.toFixed(2)} €`}</strong></p><p>Total TR1 HT : <strong>{totalTr1.toFixed(2)} €</strong></p>{preview.extraction.totalHt != null && Math.abs(preview.extraction.totalHt - totalTr1) > 0.02 ? <p className="font-medium text-amber-700">Attention : le total PDF diffère du total recalculé TR1 de plus de 0,02 €.</p> : null}{preview.warnings.map((warning) => <p className="text-amber-700" key={warning}>{warning}</p>)}</div>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={!canConfirm || confirming}>{confirming ? "Confirmation…" : "Confirmer la commande"}</Button>{confirmation.orderId ? <Link className="text-sm underline" href={`/dashboard/orders/${confirmation.orderId}`}>Ouvrir la commande</Link> : null}</div>
  </form>;
}
