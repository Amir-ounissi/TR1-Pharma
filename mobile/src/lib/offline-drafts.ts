import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ManualOrderType, OrderPharmacySelection, OrderProductSelection } from "./order-api";
import { supabase } from "./supabase";

export type ManualOrderDraftLine = {
  product: OrderProductSelection;
  quantity: string;
  freeQuantity: string;
  unitPriceHt: string;
  discountRate: string;
};

export type ManualOrderDraft = {
  version: 1;
  brandId: string;
  updatedAt: string;
  pharmacy: OrderPharmacySelection | null;
  pharmacySearch: string;
  orderType: ManualOrderType;
  orderDate: string;
  orderNumber: string;
  externalOrderId: string;
  shippingAmountHt: string;
  notes: string;
  lines: ManualOrderDraftLine[];
};

async function draftKey(brandId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Votre session TR1 a expiré. Reconnectez-vous.");
  return `tr1:manual-order-draft:v1:${data.user.id}:${brandId}`;
}

export async function loadManualOrderDraft(brandId: string): Promise<ManualOrderDraft | null> {
  const raw = await AsyncStorage.getItem(await draftKey(brandId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ManualOrderDraft>;
    if (parsed.version !== 1 || parsed.brandId !== brandId || !Array.isArray(parsed.lines)) return null;
    return parsed as ManualOrderDraft;
  } catch {
    return null;
  }
}

export async function saveManualOrderDraft(draft: Omit<ManualOrderDraft, "version" | "updatedAt">) {
  const value: ManualOrderDraft = {
    ...draft,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(await draftKey(draft.brandId), JSON.stringify(value));
  return value;
}

export async function clearManualOrderDraft(brandId: string) {
  await AsyncStorage.removeItem(await draftKey(brandId));
}
