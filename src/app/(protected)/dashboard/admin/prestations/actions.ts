"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";

const uuid = z.string().uuid();

export async function createCommercialEngagementAction(formData: FormData) {
  const parsed = z.object({
    brandId: uuid,
    name: z.string().trim().min(3).max(180),
    scopeSummary: z.string().trim().max(2000).optional(),
    territorySummary: z.string().trim().max(500).optional(),
    status: z.enum(["draft", "active"]),
    startDate: z.string().min(10).max(10),
    endDate: z.string().max(10).optional(),
    targetRevenueHt: z.string().optional(),
    targetImplantations: z.string().optional(),
  }).parse(Object.fromEntries(formData));

  const numberOrNull = (value?: string) => {
    if (!value?.trim()) return null;
    const normalized = Number(value.replace(",", "."));
    if (!Number.isFinite(normalized) || normalized < 0) {
      throw new Error("Un objectif chiffré est invalide.");
    }
    return normalized;
  };

  const revenueTarget = numberOrNull(parsed.targetRevenueHt);
  const implantationTarget = numberOrNull(parsed.targetImplantations);
  const objectives = [
    revenueTarget === null ? null : {
      metric_key: "revenue_ht",
      label: "CA sell-in",
      target_value: revenueTarget,
      unit: "EUR HT",
      is_primary: true,
    },
    implantationTarget === null ? null : {
      metric_key: "implantations",
      label: "Implantations",
      target_value: implantationTarget,
      unit: "pharmacies",
      is_primary: revenueTarget === null,
    },
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("create_commercial_engagement", {
    target_brand_id: parsed.brandId,
    engagement_payload: {
      name: parsed.name,
      scope_summary: parsed.scopeSummary || null,
      territory_summary: parsed.territorySummary || null,
      status: parsed.status,
      start_date: parsed.startDate,
      end_date: parsed.endDate || null,
    },
    objective_payload: objectives,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/prestations");
  redirect(`/dashboard/admin/prestations?created=${data}`);
}
