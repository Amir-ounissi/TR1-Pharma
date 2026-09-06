"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";

const keySchema = z.string().trim().min(2).max(64).regex(/^[a-z][a-z0-9_-]+$/);
const limitSchema = z.union([z.literal(""), z.coerce.number().int().positive().max(1_000_000_000_000)]);

const planQuotaSchema = z.object({
  planKey: keySchema,
  quotaKey: keySchema,
  limitValue: limitSchema,
});

const brandQuotaSchema = z.object({
  brandId: z.string().uuid(),
  quotaKey: keySchema,
  limitValue: limitSchema,
  reason: z.string().trim().max(500).optional(),
  expiresAt: z.string().trim().optional(),
});

const clearBrandQuotaSchema = z.object({
  brandId: z.string().uuid(),
  quotaKey: keySchema,
});

const billingSchema = z
  .object({
    brandId: z.string().uuid(),
    billingMode: z.enum(["manual", "external"]),
    providerKey: z.string().trim().max(64).optional(),
    externalCustomerRef: z.string().trim().max(255).optional(),
    externalSubscriptionRef: z.string().trim().max(255).optional(),
    billingEmail: z.union([z.literal(""), z.email()]).optional(),
  })
  .superRefine((value, context) => {
    if (value.billingMode === "external" && !value.providerKey) {
      context.addIssue({ code: "custom", path: ["providerKey"], message: "Prestataire requis." });
    }
  });

function revalidateCommercialSaas() {
  revalidatePath("/dashboard/admin/saas-commercial");
  revalidatePath("/dashboard/subscription");
}

export async function setPlanQuotaAction(formData: FormData) {
  const parsed = planQuotaSchema.parse({
    planKey: formData.get("planKey"),
    quotaKey: formData.get("quotaKey"),
    limitValue: formData.get("limitValue") ?? "",
  });
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("set_saas_plan_quota", {
    target_plan_key: parsed.planKey,
    target_quota_key: parsed.quotaKey,
    target_limit_value: parsed.limitValue === "" ? null : parsed.limitValue,
  });
  if (error) throw new Error(error.message);
  revalidateCommercialSaas();
}

export async function setBrandQuotaOverrideAction(formData: FormData) {
  const parsed = brandQuotaSchema.parse({
    brandId: formData.get("brandId"),
    quotaKey: formData.get("quotaKey"),
    limitValue: formData.get("limitValue") ?? "",
    reason: formData.get("reason") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("Date d’expiration invalide.");

  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("set_brand_saas_quota_override", {
    target_brand_id: parsed.brandId,
    target_quota_key: parsed.quotaKey,
    target_limit_value: parsed.limitValue === "" ? null : parsed.limitValue,
    target_reason: parsed.reason || null,
    target_expires_at: expiresAt?.toISOString() ?? null,
  });
  if (error) throw new Error(error.message);
  revalidateCommercialSaas();
}

export async function clearBrandQuotaOverrideAction(formData: FormData) {
  const parsed = clearBrandQuotaSchema.parse({
    brandId: formData.get("brandId"),
    quotaKey: formData.get("quotaKey"),
  });
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("clear_brand_saas_quota_override", {
    target_brand_id: parsed.brandId,
    target_quota_key: parsed.quotaKey,
  });
  if (error) throw new Error(error.message);
  revalidateCommercialSaas();
}

export async function setBillingAccountAction(formData: FormData) {
  const parsed = billingSchema.parse({
    brandId: formData.get("brandId"),
    billingMode: formData.get("billingMode"),
    providerKey: formData.get("providerKey") || undefined,
    externalCustomerRef: formData.get("externalCustomerRef") || undefined,
    externalSubscriptionRef: formData.get("externalSubscriptionRef") || undefined,
    billingEmail: formData.get("billingEmail") ?? "",
  });
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("set_brand_billing_account", {
    target_brand_id: parsed.brandId,
    target_billing_mode: parsed.billingMode,
    target_provider_key: parsed.providerKey || null,
    target_external_customer_ref: parsed.externalCustomerRef || null,
    target_external_subscription_ref: parsed.externalSubscriptionRef || null,
    target_billing_email: parsed.billingEmail || null,
  });
  if (error) throw new Error(error.message);
  revalidateCommercialSaas();
}
