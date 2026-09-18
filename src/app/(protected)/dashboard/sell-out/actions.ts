"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { assertActiveBrandCapability } from "@/lib/saas/server";
import { parseSellOutDocumentExtraction, sellOutExtractionHasPotentialPii } from "@/lib/sell-out/document-schema";

// PostgreSQL accepts canonical UUID text regardless of RFC version/variant bits.
// Seeded deterministic IDs use that broader PostgreSQL domain, so validate shape here.
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const captureMethod = z.enum(["document", "manual", "import", "stock_inference"]);
const evidenceKind = z.enum(["photo", "pdf", "csv", "other"]);
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
]);
const maxEvidenceBytes = 10 * 1024 * 1024;

export type SellOutDocumentActionState = {
  error?: string;
  success?: string;
  warning?: string;
};

const documentLineSchema = z.object({
  productId: z.union([uuid, z.literal("")]),
  sourceProductCode: z.string().trim().max(120).optional().default(""),
  ean: z.string().trim().max(32).optional().default(""),
  label: z.string().trim().max(300).optional().default(""),
  unitsSold: z.coerce.number().int().min(0),
  revenueHt: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
  confidence: z.union([z.coerce.number().min(0).max(1), z.literal(""), z.null()]).optional(),
});

const captureSchema = z.object({
  captureId: z.union([uuid, z.literal("")]).optional(),
  brandPharmacyId: uuid,
  method: captureMethod,
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  sourceLabel: z.string().trim().max(300).optional(),
  confidence: z.string().trim().max(16).optional(),
  tradeCampaignId: z.union([uuid, z.literal("")]).optional(),
});

async function requireSellOutBrand() {
  const [{ supabase, brand }] = await Promise.all([
    requireActiveBrand(),
    assertActiveBrandCapability("sell_out"),
  ]);
  return { supabase, brand };
}

function optionalNumber(value: FormDataEntryValue | null, { integer = false }: { integer?: boolean } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const schema = integer ? z.coerce.number().int().min(0) : z.coerce.number().min(0);
  return schema.parse(raw);
}

function optionalConfidence(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? z.coerce.number().min(0).max(1).parse(raw) : null;
}

function evidenceKindForMime(mimeType: string) {
  if (mimeType === "image/jpeg" || mimeType === "image/png") return "photo" as const;
  if (mimeType === "application/pdf") return "pdf" as const;
  if (mimeType === "text/csv" || mimeType === "application/vnd.ms-excel") return "csv" as const;
  return "other" as const;
}

function safeFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^[-.]+|[-.]+$/g, "").slice(0, 180) || "evidence";
}

export async function saveSellOutCaptureFormAction(formData: FormData): Promise<void> {
  const parsed = captureSchema.safeParse({
    captureId: String(formData.get("captureId") ?? "").trim(),
    brandPharmacyId: String(formData.get("brandPharmacyId") ?? "").trim(),
    method: String(formData.get("method") ?? "").trim(),
    periodStart: String(formData.get("periodStart") ?? "").trim(),
    periodEnd: String(formData.get("periodEnd") ?? "").trim(),
    sourceLabel: String(formData.get("sourceLabel") ?? "").trim(),
    confidence: String(formData.get("confidence") ?? "").trim(),
    tradeCampaignId: String(formData.get("tradeCampaignId") ?? "").trim(),
  });
  if (!parsed.success) throw new Error("Relevé sell-out invalide.");
  if (parsed.data.periodEnd < parsed.data.periodStart) throw new Error("La date de fin doit suivre la date de début.");
  const confidence = parsed.data.confidence ? z.coerce.number().min(0).max(1).parse(parsed.data.confidence) : null;

  const { supabase, brand } = await requireSellOutBrand();
  const { data, error } = await supabase.rpc("save_sell_out_capture", {
    target_capture_id: parsed.data.captureId || null,
    target_brand_id: brand.id,
    target_brand_pharmacy_id: parsed.data.brandPharmacyId,
    target_method: parsed.data.method,
    target_period_start: parsed.data.periodStart,
    target_period_end: parsed.data.periodEnd,
    target_source_label: parsed.data.sourceLabel || null,
    target_confidence: confidence,
    target_extraction_version: null,
    target_raw_extraction: null,
    target_trade_campaign_id: parsed.data.tradeCampaignId || null,
  });
  if (error) throw new Error(error.message);

  const captureId = uuid.parse(data);
  revalidatePath("/dashboard/sell-out");
  redirect(`/dashboard/sell-out/${captureId}`);
}

export async function saveSellOutLineFormAction(formData: FormData): Promise<void> {
  const captureId = uuid.parse(formData.get("captureId"));
  const lineIdValue = String(formData.get("lineId") ?? "").trim();
  const productIdValue = String(formData.get("productId") ?? "").trim();
  const sourceProductCode = String(formData.get("sourceProductCode") ?? "").trim().slice(0, 120);
  const ean = String(formData.get("ean") ?? "").trim().slice(0, 32);
  const label = String(formData.get("label") ?? "").trim().slice(0, 300);
  const unitsSold = optionalNumber(formData.get("unitsSold"), { integer: true });
  const revenueHt = optionalNumber(formData.get("revenueHt"));
  const stockBefore = optionalNumber(formData.get("stockBefore"), { integer: true });
  const deliveredUnits = optionalNumber(formData.get("deliveredUnits"), { integer: true });
  const stockCurrent = optionalNumber(formData.get("stockCurrent"), { integer: true });
  const confidence = optionalConfidence(formData.get("confidence"));
  const { supabase } = await requireSellOutBrand();

  const { error } = await supabase.rpc("save_sell_out_line", {
    target_line_id: lineIdValue ? uuid.parse(lineIdValue) : null,
    target_capture_id: captureId,
    target_product_id: productIdValue ? uuid.parse(productIdValue) : null,
    target_source_product_code: sourceProductCode || null,
    target_ean: ean || null,
    target_label: label || null,
    target_units_sold: unitsSold,
    target_revenue_ht: revenueHt,
    target_stock_before: stockBefore,
    target_delivered_units: deliveredUnits,
    target_stock_current: stockCurrent,
    target_confidence: confidence,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/sell-out/${captureId}`);
  revalidatePath("/dashboard/sell-out");
}

export async function confirmSellOutDocumentAnalysisAction(
  _state: SellOutDocumentActionState,
  formData: FormData,
): Promise<SellOutDocumentActionState> {
  try {
    const captureId = uuid.parse(String(formData.get("captureId") ?? ""));
    const periodStart = z.string().date().parse(String(formData.get("periodStart") ?? ""));
    const periodEnd = z.string().date().parse(String(formData.get("periodEnd") ?? ""));
    if (periodEnd < periodStart) throw new Error("La date de fin doit suivre la date de début.");

    const confidenceRaw = String(formData.get("confidence") ?? "").trim();
    const confidence = confidenceRaw ? z.coerce.number().min(0).max(1).parse(confidenceRaw) : null;

    const document = formData.get("document");
    if (!(document instanceof File) || document.size < 1) {
      throw new Error("Ajoutez le document analysé.");
    }
    if (document.size > maxEvidenceBytes) throw new Error("Le justificatif ne doit pas dépasser 10 Mo.");
    if (!["image/jpeg", "image/png", "application/pdf"].includes(document.type)) {
      throw new Error("L’analyse automatique accepte les photos JPG/PNG et les PDF.");
    }

    let extraction: ReturnType<typeof parseSellOutDocumentExtraction>;
    try {
      extraction = parseSellOutDocumentExtraction(
        JSON.parse(String(formData.get("extractionPayload") ?? "{}")),
      );
    } catch {
      throw new Error("La prévisualisation du document est invalide. Relancez l’analyse.");
    }
    if (sellOutExtractionHasPotentialPii(extraction)) {
      throw new Error("Le document contient des données client ou patient et ne peut pas être enregistré automatiquement.");
    }

    let linesInput: unknown;
    try {
      linesInput = JSON.parse(String(formData.get("linesPayload") ?? "[]"));
    } catch {
      throw new Error("Les lignes du relevé sont invalides.");
    }
    const lines = z.array(documentLineSchema).min(1).max(150).parse(linesInput);
    if (lines.some((line) => !line.productId && !line.sourceProductCode && !line.ean && !line.label)) {
      throw new Error("Chaque ligne doit identifier un produit.");
    }

    const { supabase, brand } = await requireSellOutBrand();
    const { data: capture, error: captureError } = await supabase
      .from("sell_out_captures")
      .select("id,brand_id,brand_pharmacy_id,method,status")
      .eq("id", captureId)
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .maybeSingle();
    if (captureError) throw new Error(captureError.message);
    if (!capture) throw new Error("Relevé sell-out introuvable.");
    if (capture.method !== "document") throw new Error("Ce relevé n’est pas un relevé Photo / PDF.");
    if (!["draft", "review_required"].includes(capture.status)) {
      throw new Error("Ce relevé a déjà été relu.");
    }

    const selectedProductIds = [...new Set(lines.map((line) => line.productId).filter(Boolean))];
    if (selectedProductIds.length) {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .is("discontinued_at", null)
        .in("id", selectedProductIds);
      if (productsError || (products ?? []).length !== selectedProductIds.length) {
        throw new Error("Un produit sélectionné n’est plus disponible dans le catalogue.");
      }
    }

    const bytes = Buffer.from(await document.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const extractionHash = createHash("sha256").update(JSON.stringify(extraction)).digest("hex");
    const { data: existingEvidence, error: existingEvidenceError } = await supabase
      .from("sell_out_evidence")
      .select("id,storage_path")
      .eq("capture_id", captureId)
      .eq("sha256", sha256)
      .maybeSingle();
    if (existingEvidenceError) throw new Error(existingEvidenceError.message);

    let storagePath: string | null = null;
    if (!existingEvidence) {
      const fileName = safeFileName(document.name);
      storagePath = `${brand.id}/${captureId}/${randomUUID()}-${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("sell-out-evidence")
        .upload(storagePath, bytes, { contentType: document.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
    }

    const rpcLines = lines.map((line) => ({
      product_id: line.productId || null,
      source_product_code: line.sourceProductCode || null,
      ean: line.ean || null,
      label: line.label || null,
      units_sold: line.unitsSold,
      revenue_ht: line.revenueHt === "" || line.revenueHt == null ? null : Number(line.revenueHt),
      confidence: line.confidence === "" || line.confidence == null ? null : Number(line.confidence),
    }));

    const { data: appliedCount, error: applyError } = await supabase.rpc("apply_sell_out_document_preview", {
      target_capture_id: captureId,
      target_period_start: periodStart,
      target_period_end: periodEnd,
      target_confidence: confidence,
      target_extraction_version: "agent-web-document-v1",
      target_raw_extraction: extraction,
      target_lines: rpcLines,
    });
    if (applyError) {
      if (storagePath) await supabase.storage.from("sell-out-evidence").remove([storagePath]);
      throw new Error(applyError.message);
    }

    if (storagePath) {
      const kind = evidenceKind.parse(evidenceKindForMime(document.type));
      const { error: evidenceError } = await supabase.rpc("add_sell_out_evidence", {
        target_capture_id: captureId,
        target_kind: kind,
        target_storage_path: storagePath,
        target_file_name: safeFileName(document.name),
        target_mime_type: document.type,
        target_byte_size: document.size,
        target_sha256: sha256,
        target_extraction_payload_hash: extractionHash,
      });
      if (evidenceError) {
        await supabase.storage.from("sell-out-evidence").remove([storagePath]);
        revalidatePath(`/dashboard/sell-out/${captureId}`);
        return {
          success: `${Number(appliedCount ?? lines.length)} ligne(s) enregistrée(s).`,
          warning: "Le document n’a pas pu être relié comme preuve. Réessayez avant de soumettre le relevé.",
        };
      }
    }

    revalidatePath(`/dashboard/sell-out/${captureId}`);
    revalidatePath("/dashboard/sell-out");
    return {
      success: `${Number(appliedCount ?? lines.length)} ligne(s) et justificatif enregistrés. Vérifiez puis soumettez le relevé pour relecture humaine.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossible d’enregistrer l’analyse du document.",
    };
  }
}

export async function uploadSellOutEvidenceFormAction(formData: FormData): Promise<void> {
  const captureId = uuid.parse(formData.get("captureId"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) throw new Error("Ajoutez un justificatif sell-out.");
  if (file.size > maxEvidenceBytes) throw new Error("Le justificatif ne doit pas dépasser 10 Mo.");
  if (!allowedMimeTypes.has(file.type)) throw new Error("Format non supporté. Utilisez JPG, PNG, PDF ou CSV.");

  const { supabase, brand } = await requireSellOutBrand();
  const { data: capture, error: captureError } = await supabase
    .from("sell_out_captures")
    .select("id,brand_id,status")
    .eq("id", captureId)
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (captureError) throw new Error(captureError.message);
  if (!capture) throw new Error("Relevé sell-out introuvable.");
  if (!["draft", "review_required"].includes(capture.status)) throw new Error("Ce relevé a déjà été relu et ne peut plus recevoir de justificatif.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = safeFileName(file.name);
  const storagePath = `${brand.id}/${captureId}/${randomUUID()}-${fileName}`;
  const { error: uploadError } = await supabase.storage.from("sell-out-evidence").upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const kind = evidenceKind.parse(evidenceKindForMime(file.type));
  const { error: evidenceError } = await supabase.rpc("add_sell_out_evidence", {
    target_capture_id: captureId,
    target_kind: kind,
    target_storage_path: storagePath,
    target_file_name: fileName,
    target_mime_type: file.type,
    target_byte_size: file.size,
    target_sha256: sha256,
    target_extraction_payload_hash: null,
  });
  if (evidenceError) {
    await supabase.storage.from("sell-out-evidence").remove([storagePath]);
    throw new Error(evidenceError.message);
  }

  revalidatePath(`/dashboard/sell-out/${captureId}`);
}

export async function submitSellOutCaptureFormAction(formData: FormData): Promise<void> {
  const captureId = uuid.parse(formData.get("captureId"));
  const { supabase } = await requireSellOutBrand();
  const { error } = await supabase.rpc("submit_sell_out_capture", { target_capture_id: captureId });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/sell-out/${captureId}`);
  revalidatePath("/dashboard/sell-out");
  redirect(`/dashboard/sell-out/${captureId}`);
}

export async function validateSellOutCaptureFormAction(formData: FormData): Promise<void> {
  const captureId = uuid.parse(formData.get("captureId"));
  const approved = String(formData.get("approved") ?? "false") === "true";
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 5000);
  const { supabase } = await requireSellOutBrand();
  const { error } = await supabase.rpc("validate_sell_out_capture", {
    target_capture_id: captureId,
    target_approved: approved,
    target_notes: notes || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/sell-out/${captureId}`);
  revalidatePath("/dashboard/sell-out");
  redirect(`/dashboard/sell-out/${captureId}`);
}

export async function archiveSellOutCaptureFormAction(formData: FormData): Promise<void> {
  const captureId = uuid.parse(formData.get("captureId"));
  const { supabase } = await requireSellOutBrand();
  const { error } = await supabase.rpc("archive_sell_out_capture", { target_capture_id: captureId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/sell-out");
  redirect("/dashboard/sell-out");
}
