import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "./supabase";

export type OrderPreviewLine = {
  index: number;
  label: string | null;
  sku: string | null;
  ean: string | null;
  quantity: number | null;
  freeQuantity: number;
  unitPriceHt: number | null;
  discountRate: number | null;
  suggestedPriceHt: number | null;
  priceWarning: string | null;
  product: {
    status: "matched" | "unmatched" | "ambiguous";
    method: string | null;
    selectedId: string | null;
    selectedName: string | null;
    candidates: Array<{ id: string; name: string; sku: string | null; ean: string | null; wholesalePriceHt: number | null }>;
  };
};

export type MobileOrderPreview = {
  extraction: {
    pharmacy: { name: string | null; siret: string | null; cip: string | null; finess: string | null; postalCode: string | null };
    orderNumber: string | null;
    orderDate: string | null;
    deliveryDate: string | null;
    totalHt: number | null;
    totalTtc: number | null;
    warnings: string[];
  };
  pharmacy: {
    status: "matched" | "suggested" | "unmatched" | "ambiguous";
    method: string | null;
    selectedPharmacyId: string | null;
    selectedBrandPharmacyId: string | null;
    selectedName: string | null;
    candidates: Array<{ pharmacyId: string; brandPharmacyId: string | null; name: string; postalCode: string | null }>;
  };
  lines: OrderPreviewLine[];
  totalTr1Ht: number;
  totalDifferenceWarning: boolean;
  warnings: string[];
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
  if (!response.ok) throw new Error(payload.error || "La requête TR1 mobile a échoué.");
  return payload as Record<string, unknown>;
}

async function optimizeOrderPhoto(asset: ImagePickerAsset) {
  const width = asset.width > 1800 ? 1800 : asset.width;
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    width > 0 && width < asset.width ? [{ resize: { width } }] : [],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, name: "commande-tr1.jpg", type: "image/jpeg" };
}

export async function analyzeOrderPhoto(asset: ImagePickerAsset, brandId: string): Promise<MobileOrderPreview> {
  const photo = await optimizeOrderPhoto(asset);
  const form = new FormData();
  form.append("brandId", brandId);
  form.append("document", photo as unknown as Blob);
  const payload = await apiFetch("/api/mobile/orders/document/analyze", { method: "POST", body: form });
  return payload.preview as MobileOrderPreview;
}

export async function confirmOrderPreview(input: {
  brandId: string;
  preview: MobileOrderPreview;
  orderNumber: string;
  orderDate: string;
}) {
  const { preview } = input;
  if (!preview.pharmacy.selectedBrandPharmacyId && !preview.pharmacy.selectedPharmacyId) {
    throw new Error("La pharmacie doit être identifiée avant validation.");
  }
  const invalidLine = preview.lines.some((line) => !line.product.selectedId || !line.quantity || line.suggestedPriceHt == null);
  if (invalidLine) throw new Error("Toutes les lignes doivent être identifiées avant validation.");

  const payload = await apiFetch("/api/mobile/orders/document/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brandId: input.brandId,
      brandPharmacyId: preview.pharmacy.selectedBrandPharmacyId,
      pharmacyId: preview.pharmacy.selectedBrandPharmacyId ? null : preview.pharmacy.selectedPharmacyId,
      newPharmacy: null,
      orderNumber: input.orderNumber,
      orderDate: input.orderDate,
      items: preview.lines.map((line) => ({
        productId: line.product.selectedId,
        quantity: line.quantity,
        freeQuantity: line.freeQuantity,
        unitPriceHt: line.suggestedPriceHt,
        discountRate: line.discountRate,
      })),
    }),
  });
  return payload as { success?: string; orderId?: string | null };
}
