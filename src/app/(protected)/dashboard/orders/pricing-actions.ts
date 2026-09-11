"use server";

import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { getNaaliHubSpotPharmacyDiscount } from "@/lib/integrations/hubspot/naali-pricing";

const uuid = z.string().uuid();

export async function getOrderPharmacyPricingAction(pharmacyId: string) {
  const parsedPharmacyId = uuid.parse(pharmacyId);
  const { supabase, brand } = await requireActiveBrand();
  const { data: pharmacy, error } = await supabase
    .from("pharmacies")
    .select("id")
    .eq("id", parsedPharmacyId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !pharmacy) return { discountRate: null as number | null };

  const discountRate = await getNaaliHubSpotPharmacyDiscount(brand.id, parsedPharmacyId);
  return { discountRate };
}
