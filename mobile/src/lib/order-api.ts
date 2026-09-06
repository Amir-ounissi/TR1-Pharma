import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "./supabase";

export type OrderPharmacySelection = {
  brandPharmacyId: string | null;
  pharmacyId: string | null;
  name: string;
  postalCode: string | null;
};

export type OrderProductSelection = {
  productId: string;
  name: string;
  sku: string | null;
  ean: string | null;
  unitPriceHt: number | null;
};

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

export async function searchOrderPharmacies(brandId: string, term: string): Promise<OrderPharmacySelection[]> {
  const query = term.trim();
  if (!query) return [];
  const { data, error } = await supabase.rpc("search_pharmacy_directory_for_order", {
    target_brand_id: brandId,
    search_term: query,
    candidate_siret: null,
    candidate_cip: null,
    candidate_finess: null,
    candidate_name: null,
    candidate_postal_code: null,
    result_limit: 12,
  });
  if (error) throw new Error("La recherche de pharmacie est indisponible.");
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => typeof row.pharmacy_id === "string")
    .map((row) => ({
      pharmacyId: String(row.pharmacy_id),
      brandPharmacyId: typeof row.brand_pharmacy_id === "string" ? row.brand_pharmacy_id : null,
      name: String(row.trade_name || row.legal_name || "Pharmacie"),
      postalCode: typeof row.postal_code === "string" ? row.postal_code : null,
    }));
}

export async function searchOrderProducts(brandId: string, term: string): Promise<OrderProductSelection[]> {
  const query = term.trim();
  if (!query) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id,name,sku,ean,wholesale_price_ht")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .is("discontinued_at", null)
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .limit(12);
  if (error) throw new Error("La recherche produit est indisponible.");
  return (data ?? []).map((row) => ({
    productId: String(row.id),
    name: String(row.name),
    sku: typeof row.sku === "string" ? row.sku : null,
    ean: typeof row.ean === "string" ? row.ean : null,
    unitPriceHt: row.wholesale_price_ht == null ? null : Number(row.wholesale_price_ht),
  }));
}

export async function confirmOrderPreview(input: {
  brandId: string;
  preview: MobileOrderPreview;
  orderNumber: string;
  orderDate: string;
  pharmacy: OrderPharmacySelection | null;
  products: Record<number, OrderProductSelection>;
}) {
  if (!input.pharmacy) throw new Error("La pharmacie doit être identifiée avant validation.");

  const items = input.preview.lines.map((line) => {
    const selection = input.products[line.index];
    if (!selection || !line.quantity) {
      throw new Error("Toutes les lignes doivent être identifiées avant validation.");
    }
    const unitPriceHt = line.unitPriceHt ?? selection.unitPriceHt;
    if (unitPriceHt == null) {
      throw new Error("Toutes les lignes doivent avoir un prix avant validation.");
    }
    return {
      productId: selection.productId,
      quantity: line.quantity,
      freeQuantity: line.freeQuantity,
      unitPriceHt,
      discountRate: line.discountRate,
    };
  });

  const payload = await apiFetch("/api/mobile/orders/document/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brandId: input.brandId,
      brandPharmacyId: input.pharmacy.brandPharmacyId,
      pharmacyId: input.pharmacy.brandPharmacyId ? null : input.pharmacy.pharmacyId,
      newPharmacy: null,
      orderNumber: input.orderNumber,
      orderDate: input.orderDate,
      items,
    }),
  });
  return payload as { success?: string; orderId?: string | null };
}
