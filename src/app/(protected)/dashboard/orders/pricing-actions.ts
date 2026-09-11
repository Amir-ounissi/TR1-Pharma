"use server";

import { getPharmacyCommercialTermsAction } from "@/app/(protected)/dashboard/pharmacies/commercial-terms-actions";

export async function getOrderPharmacyPricingAction(pharmacyId: string) {
  return getPharmacyCommercialTermsAction(pharmacyId);
}
