"use server";

import { z } from "zod";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { getNaaliHubSpotPharmacyPricing } from "@/lib/integrations/hubspot/naali-pricing";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();
const allowedRoles = new Set(["agent", "tr1_manager", "brand_admin", "super_admin"]);

async function editableBrandPharmacy(pharmacyId: string) {
  const { supabase, brand, userId } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role = contexts.find((context) => context.id === brand.id)?.role;
  if (!role || !allowedRoles.has(role)) {
    throw new Error("Votre rôle ne permet pas de modifier les conditions commerciales.");
  }

  const { data: relation, error } = await supabase
    .from("brand_pharmacies")
    .select("id,pharmacy_id")
    .eq("brand_id", brand.id)
    .eq("pharmacy_id", pharmacyId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (error || !relation) {
    throw new Error("Cette pharmacie n’est pas rattachée à la marque active.");
  }

  return { brand, userId, relation };
}

export async function getPharmacyCommercialTermsAction(pharmacyId: string) {
  const parsedPharmacyId = uuid.parse(pharmacyId);
  const { supabase, brand } = await requireActiveBrand();
  const { data: pharmacy, error } = await supabase
    .from("pharmacies")
    .select("id")
    .eq("id", parsedPharmacyId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !pharmacy) {
    return {
      discountRate: null,
      potential: null,
      leadStatus: null,
      freeUnitsRule: null,
      discountSource: null,
      freeUnitsSource: null,
      overrideNote: null,
    };
  }

  return getNaaliHubSpotPharmacyPricing(brand.id, parsedPharmacyId);
}

export async function savePharmacyCommercialTermsAction(input: {
  pharmacyId: string;
  discountRate: number | null;
  ugPaidQuantity: number | null;
  ugFreeQuantity: number | null;
  note?: string | null;
}) {
  const parsed = z
    .object({
      pharmacyId: uuid,
      discountRate: z.number().min(0).max(100).nullable(),
      ugPaidQuantity: z.number().int().positive().nullable(),
      ugFreeQuantity: z.number().int().min(0).nullable(),
      note: z.string().trim().max(500).nullable().optional(),
    })
    .superRefine((value, ctx) => {
      if ((value.ugPaidQuantity === null) !== (value.ugFreeQuantity === null)) {
        ctx.addIssue({
          code: "custom",
          message: "La base UG et la quantité offerte doivent être renseignées ensemble.",
        });
      }
    })
    .parse(input);

  const { brand, userId, relation } = await editableBrandPharmacy(parsed.pharmacyId);
  const admin = createAdminClient();
  const { error } = await admin.from("brand_pharmacy_commercial_terms").upsert(
    {
      brand_pharmacy_id: relation.id,
      brand_id: brand.id,
      discount_rate: parsed.discountRate,
      ug_paid_quantity: parsed.ugPaidQuantity,
      ug_free_quantity: parsed.ugFreeQuantity,
      note: parsed.note || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "brand_pharmacy_id" },
  );
  if (error) throw new Error(error.message);

  return getNaaliHubSpotPharmacyPricing(brand.id, parsed.pharmacyId);
}

export async function resetPharmacyCommercialTermsAction(pharmacyId: string) {
  const parsedPharmacyId = uuid.parse(pharmacyId);
  const { brand, relation } = await editableBrandPharmacy(parsedPharmacyId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("brand_pharmacy_commercial_terms")
    .delete()
    .eq("brand_pharmacy_id", relation.id)
    .eq("brand_id", brand.id);
  if (error) throw new Error(error.message);

  return getNaaliHubSpotPharmacyPricing(brand.id, parsedPharmacyId);
}
