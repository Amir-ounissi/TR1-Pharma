import * as ImageManipulator from "expo-image-manipulator";

import { supabase } from "./supabase";

export type FacilitatorEvidenceFile = {
  uri: string;
  name: string;
  mimeType: string;
  width?: number | null;
};

export type FacilitatorSellOutProduct = {
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  taxRate: number | null;
};

export type FacilitatorSellOutPreviewLine = {
  index: number;
  label: string | null;
  sourceProductCode: string | null;
  ean: string | null;
  unitsSold: number | null;
  revenueHt: number | null;
  revenueTtc: number | null;
  revenueHtSource: "document" | "derived_from_ttc" | null;
  taxRate: number | null;
  confidence: number | null;
  warning: string | null;
  product: {
    status: "matched" | "unmatched" | "ambiguous";
    method: string | null;
    selectedId: string | null;
    selectedName: string | null;
    candidates: FacilitatorSellOutProduct[];
  };
};

export type FacilitatorSellOutPreview = {
  missionId: string;
  brandPharmacyId: string;
  pharmacyId: string;
  periodStart: string;
  periodEnd: string;
  extraction: {
    periodStart: string | null;
    periodEnd: string | null;
    personalDataDetected: boolean;
    lines: Array<Record<string, unknown>>;
    totalUnits: number | null;
    totalRevenueHt: number | null;
    totalRevenueTtc: number | null;
    confidence: number | null;
    warnings: string[];
  };
  lines: FacilitatorSellOutPreviewLine[];
  warnings: string[];
};

export type FacilitatorSellOutReviewedLine = {
  productId: string;
  sourceProductCode: string | null;
  ean: string | null;
  label: string | null;
  unitsSold: number;
  revenueHt: number | null;
  confidence: number | null;
};

const apiBaseUrl = (process.env.EXPO_PUBLIC_TR1_API_URL ?? "").replace(/\/$/, "");

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Votre session TR1 a expiré. Reconnectez-vous.");
  return token;
}

async function apiFetch(path: string, init: RequestInit) {
  if (!apiBaseUrl) throw new Error("L’URL de l’API TR1 mobile n’est pas configurée.");
  const token = await accessToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error || "La requête sell-out TR1 a échoué.");
  return payload as Record<string, unknown>;
}

function safeFileName(name: string) {
  const cleaned = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-160) || `preuve-${Date.now()}`;
}

async function prepareAnalysisFile(file: FacilitatorEvidenceFile): Promise<FacilitatorEvidenceFile> {
  if (!file.mimeType.startsWith("image/")) return file;
  const width = file.width && file.width > 1800 ? 1800 : file.width ?? null;
  const result = await ImageManipulator.manipulateAsync(
    file.uri,
    width && file.width && width < file.width ? [{ resize: { width } }] : [],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, name: "sortie-caisse-tr1.jpg", mimeType: "image/jpeg", width };
}

export async function analyzeFacilitatorSellOut(
  file: FacilitatorEvidenceFile,
  brandId: string,
  missionId: string,
): Promise<FacilitatorSellOutPreview> {
  const prepared = await prepareAnalysisFile(file);
  const form = new FormData();
  form.append("brandId", brandId);
  form.append("missionId", missionId);
  form.append("document", { uri: prepared.uri, name: prepared.name, type: prepared.mimeType } as unknown as Blob);
  const payload = await apiFetch("/api/mobile/facilitator/sell-out/analyze", { method: "POST", body: form });
  return payload.preview as FacilitatorSellOutPreview;
}

export async function createFacilitatorSellOutDraft(input: {
  brandId: string;
  missionId: string;
  missionAttachmentId: string;
  periodStart: string;
  periodEnd: string;
  extraction: FacilitatorSellOutPreview["extraction"];
  lines: FacilitatorSellOutReviewedLine[];
}) {
  const payload = await apiFetch("/api/mobile/facilitator/sell-out/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const captureId = typeof payload.captureId === "string" ? payload.captureId : null;
  if (!captureId) throw new Error("Le relevé sell-out n’a pas reçu d’identifiant TR1.");
  return captureId;
}

export async function uploadAndSubmitFacilitatorSellOutEvidence(input: {
  brandId: string;
  captureId: string;
  file: FacilitatorEvidenceFile;
}) {
  const response = await fetch(input.file.uri);
  if (!response.ok) throw new Error("Le document local n’est plus accessible.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength <= 0 || bytes.byteLength > 10485760) throw new Error("La preuve sell-out doit faire moins de 10 Mo.");

  const name = safeFileName(input.file.name);
  const path = `${input.brandId}/${input.captureId}/${Date.now()}-${name}`;
  const { error: uploadError } = await supabase.storage
    .from("sell-out-evidence")
    .upload(path, bytes, { contentType: input.file.mimeType, upsert: false });
  if (uploadError) throw new Error(uploadError.message || "La preuve sell-out n’a pas pu être stockée.");

  const { error: submitError } = await supabase.rpc("submit_facilitator_sell_out_capture", {
    target_capture_id: input.captureId,
    target_storage_path: path,
    target_file_name: input.file.name,
    target_mime_type: input.file.mimeType,
    target_byte_size: bytes.byteLength,
  });
  if (submitError) {
    await supabase.storage.from("sell-out-evidence").remove([path]).catch(() => undefined);
    throw new Error(submitError.message || "Le relevé sell-out n’a pas pu être soumis pour validation.");
  }
}
