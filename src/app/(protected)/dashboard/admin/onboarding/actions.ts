"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { previewImport } from "@/lib/imports/import-engine";
import type { ColumnMapping, ImportMode, ImportType } from "@/lib/imports/import-types";
import { requirePlatformAdmin } from "@/lib/auth";
import { resolveOnboardingRedirectUrl } from "@/lib/runtime-environment";
import { createAdminClient } from "@/lib/supabase/admin";

export type OnboardingActionState = {
  error?: string;
  success?: string;
  brandId?: string;
  jobId?: string;
  summary?: { total: number; valid: number; warnings: number; errors: number; duplicates: number };
};

const onboardingSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().max(160).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(3).max(80),
  locale: z.string().trim().min(2).max(20),
  externalId: z.string().trim().max(120).optional(),
  brandName: z.string().trim().min(2).max(120),
  brandCode: z.string().trim().min(2).max(40),
  brandSlug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
  accentColor: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal("")]),
  description: z.string().trim().max(300).optional(),
});

export async function createBrandOnboardingAction(
  _state: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = onboardingSchema.safeParse({
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName") || undefined,
    countryCode: formData.get("countryCode"),
    currencyCode: formData.get("currencyCode"),
    timezone: formData.get("timezone"),
    locale: formData.get("locale"),
    externalId: formData.get("externalId") || undefined,
    brandName: formData.get("brandName"),
    brandCode: formData.get("brandCode"),
    brandSlug: formData.get("brandSlug") || undefined,
    accentColor: formData.get("accentColor") ?? "",
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: "Les informations organisation ou marque sont invalides." };
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("create_brand_onboarding", {
    organization_data: {
      legal_name: parsed.data.legalName,
      trade_name: parsed.data.tradeName,
      country_code: parsed.data.countryCode,
      currency_code: parsed.data.currencyCode,
      timezone: parsed.data.timezone,
      locale: parsed.data.locale,
      external_id: parsed.data.externalId,
    },
    brand_data: {
      name: parsed.data.brandName,
      code: parsed.data.brandCode,
      slug: parsed.data.brandSlug,
      country_code: parsed.data.countryCode,
      currency_code: parsed.data.currencyCode,
      accent_color: parsed.data.accentColor || null,
      short_description: parsed.data.description,
    },
  });
  if (error) return { error: error.message };
  const result = data?.[0];
  revalidatePath("/dashboard/admin/onboarding");
  return { success: "Organisation et marque brouillon créées.", brandId: result?.brand_id };
}

const settingsSchema = z.object({
  brandId: z.string().uuid(),
  brandName: z.string().trim().min(2).max(120),
  brandCode: z.string().trim().min(2).max(40),
  brandSlug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  logoPath: z.union([z.string().trim().url(), z.literal(""), z.string().trim().startsWith("/")]),
  countryCode: z.string().trim().length(2),
  defaultReorderIntervalDays: z.coerce.number().int().min(1).max(365),
  firstReorderTargetDays: z.coerce.number().int().min(1).max(365),
  reorderDueSoonDays: z.coerce.number().int().min(0).max(90),
  atRiskMultiplier: z.coerce.number().min(1).max(10),
  dormantMultiplier: z.coerce.number().min(1).max(20),
  reorderEligibilityDays: z.coerce.number().int().min(0).max(365),
  postMissionFollowupDays: z.coerce.number().int().min(1).max(90),
  currencyCode: z.string().length(3),
  timezone: z.string().min(3).max(80),
  commercialEmail: z.union([z.email(), z.literal("")]),
  orderEmail: z.union([z.email(), z.literal("")]),
  phone: z.string().trim().max(40).optional(),
  addressLine1: z.string().trim().max(180).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  description: z.string().trim().max(300).optional(),
});

export async function updateOnboardingSettingsAction(formData: FormData) {
  const parsed = settingsSchema.parse(Object.fromEntries(formData));
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("update_onboarding_settings", {
    target_brand_id: parsed.brandId,
    settings_data: {
      name: parsed.brandName,
      code: parsed.brandCode,
      slug: parsed.brandSlug,
      logo_path: parsed.logoPath || null,
      country_code: parsed.countryCode.toUpperCase(),
      default_reorder_interval_days: parsed.defaultReorderIntervalDays,
      first_reorder_target_days: parsed.firstReorderTargetDays,
      reorder_due_soon_days: parsed.reorderDueSoonDays,
      at_risk_multiplier: parsed.atRiskMultiplier,
      dormant_multiplier: parsed.dormantMultiplier,
      reorder_eligibility_days: parsed.reorderEligibilityDays,
      post_mission_followup_days: parsed.postMissionFollowupDays,
      currency_code: parsed.currencyCode.toUpperCase(),
      timezone: parsed.timezone,
      commercial_email: parsed.commercialEmail || null,
      order_email: parsed.orderEmail || null,
      phone: parsed.phone || null,
      address_line_1: parsed.addressLine1 || null,
      postal_code: parsed.postalCode || null,
      city: parsed.city || null,
      short_description: parsed.description || null,
    },
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/onboarding");
}

export async function inviteOnboardingAdminAction(
  _state: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = z.object({
    brandId: z.string().uuid(),
    email: z.email(),
    fullName: z.string().trim().min(2).max(120),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Les informations du futur administrateur sont invalides." } satisfies OnboardingActionState;
  }

  try {
    const { userId } = await requirePlatformAdmin();
    const admin = createAdminClient();
    const [{ data: brand }, { data: role }] = await Promise.all([
      admin.from("brands").select("organization_id").eq("id", parsed.data.brandId).single(),
      admin.from("roles").select("id").eq("key", "brand_admin").single(),
    ]);

    if (!brand || !role) {
      return { error: "Configuration de marque incomplète." } satisfies OnboardingActionState;
    }

    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.fullName },
      redirectTo: resolveOnboardingRedirectUrl(),
    });

    if (error || !data.user) {
      return { error: error?.message ?? "Invitation impossible." } satisfies OnboardingActionState;
    }

    const { error: membershipError } = await admin.from("memberships").insert({
      user_id: data.user.id,
      organization_id: brand.organization_id,
      brand_id: parsed.data.brandId,
      role_id: role.id,
      invited_by: userId,
      status: "invited",
    });

    if (membershipError) {
      return { error: membershipError.message } satisfies OnboardingActionState;
    }

    revalidatePath("/dashboard/admin/onboarding");
    return { success: "Invitation administrateur envoyée.", brandId: parsed.data.brandId } satisfies OnboardingActionState;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invitation impossible." } satisfies OnboardingActionState;
  }
}

export async function stageOnboardingImportAction(
  _state: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const brandId = z.string().uuid().safeParse(formData.get("brandId"));
  const type = formData.get("type") as ImportType;
  const mode = formData.get("mode") as ImportMode;
  const dateFormatValue = formData.get("dateFormat");
  const dateFormat = dateFormatValue === "DMY" || dateFormatValue === "MDY" ? dateFormatValue : undefined;
  const mappingValue = formData.get("mapping");
  const file = formData.get("file");
  if (!brandId.success || !["products", "pharmacies", "orders", "users", "territories"].includes(type)) return { error: "Cible d’import invalide." };
  if (!["create_only", "update_only", "upsert", "append_only", "invite"].includes(mode)) return { error: "Mode d’import invalide." };
  if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) return { error: "Sélectionnez un CSV UTF-8 de moins de 5 Mo." };
  if (!["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel", ""].includes(file.type)) return { error: "Type MIME non autorisé." };

  const content = await file.text();
  let preview;
  try {
    const manualMapping = typeof mappingValue === "string" && mappingValue
      ? JSON.parse(mappingValue) as ColumnMapping
      : undefined;
    preview = previewImport({ content, type, dateFormat, manualMapping });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Analyse impossible." };
  }
  const { supabase, userId } = await requirePlatformAdmin();
  const { data: brand } = await supabase.from("brands").select("organization_id").eq("id", brandId.data).single();
  if (!brand) return { error: "Marque inaccessible." };
  const hash = createHash("sha256").update(content).digest("hex");
  const { data: job, error: jobError } = await supabase.from("import_batches").insert({
    organization_id: brand.organization_id,
    brand_id: brandId.data,
    entity_type: type,
    strategy: mode === "update_only" ? "update_only" : mode === "upsert" ? "upsert" : "create_only",
    import_mode: mode,
    status: "preview",
    lifecycle_status: "parsing",
    file_name: file.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
    file_hash: hash,
    column_mapping: preview.mapping,
    total_rows: preview.summary.total,
    valid_rows: preview.summary.valid + preview.summary.warnings,
    warning_rows: preview.summary.warnings,
    error_rows: preview.summary.errors,
    duplicate_rows: preview.summary.duplicates,
    created_by: userId,
    validated_at: new Date().toISOString(),
    metadata: { delimiter: preview.delimiter, date_format: dateFormat ?? "ISO" },
  }).select("id").single();
  if (jobError || !job) return { error: jobError?.code === "23505" ? "Ce fichier a déjà été préparé pour cette marque." : jobError?.message };
  const sourcePath = `${brandId.data}/${job.id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("onboarding-imports").upload(sourcePath, file, { contentType: "text/csv", upsert: false });
  if (uploadError) {
    await createAdminClient().from("import_batches").delete().eq("id", job.id);
    return { error: uploadError.message };
  }
  const rows = preview.rows.map((row) => ({
    batch_id: job.id,
    line_number: row.lineNumber,
    payload: row.raw,
    normalized_payload: row.normalized,
    errors: row.issues.filter((issue) => issue.severity === "error").map((issue) => `${issue.column}: ${issue.message}`),
    warnings: row.issues.filter((issue) => issue.severity === "warning").map((issue) => `${issue.column}: ${issue.message}`),
    is_valid: row.status !== "invalid",
    is_duplicate: row.issues.some((issue) => issue.message.includes("Doublon")),
    status: row.status,
    deduplication_key: row.deduplicationKey,
    resolution: row.status === "warning" ? "manual" : "create",
  }));
  const { error: rowError } = await supabase.from("import_rows").insert(rows);
  if (rowError) {
    const admin = createAdminClient();
    await admin.storage.from("onboarding-imports").remove([sourcePath]);
    await admin.from("import_batches").delete().eq("id", job.id);
    return { error: rowError.message };
  }
  const { error: finalizeError } = await supabase.from("import_batches").update({
    source_path: sourcePath,
    lifecycle_status: preview.summary.errors === 0 ? "ready" : "review",
  }).eq("id", job.id);
  if (finalizeError) {
    const admin = createAdminClient();
    await admin.storage.from("onboarding-imports").remove([sourcePath]);
    await admin.from("import_batches").delete().eq("id", job.id);
    return { error: finalizeError.message };
  }
  await supabase.from("onboarding_audit_logs").insert([
    {
      organization_id: brand.organization_id,
      brand_id: brandId.data,
      import_batch_id: job.id,
      actor_user_id: userId,
      event_name: "import_file_uploaded",
      metadata: { file_name: file.name.replace(/[^a-zA-Z0-9._-]/g, "_"), bytes: file.size },
    },
    {
      organization_id: brand.organization_id,
      brand_id: brandId.data,
      import_batch_id: job.id,
      actor_user_id: userId,
      event_name: "import_mapping_completed",
      metadata: { mapped_columns: Object.values(preview.mapping).filter(Boolean).length },
    },
    {
      organization_id: brand.organization_id,
      brand_id: brandId.data,
      import_batch_id: job.id,
      actor_user_id: userId,
      event_name: "import_validation_completed",
      metadata: preview.summary,
    },
  ]);
  revalidatePath("/dashboard/admin/onboarding");
  return { success: preview.summary.errors ? "Prévisualisation créée avec erreurs à corriger." : "Import validé et prêt à être exécuté.", brandId: brandId.data, jobId: job.id, summary: preview.summary };
}

export async function executeOnboardingImportAction(formData: FormData) {
  const jobId = z.string().uuid().parse(formData.get("jobId"));
  const { supabase, userId } = await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data: job } = await supabase
    .from("import_batches")
    .select("entity_type,organization_id,brand_id")
    .eq("id", jobId)
    .single();
  const markFailed = async (message: string) => {
    await supabase.from("import_batches").update({ lifecycle_status: "failed" }).eq("id", jobId);
    if (job) {
      await supabase.from("onboarding_audit_logs").insert({
        organization_id: job.organization_id,
        brand_id: job.brand_id,
        import_batch_id: jobId,
        actor_user_id: userId,
        event_name: "import_failed",
        metadata: { reason: message.slice(0, 500) },
      });
    }
  };
  const invitedUserIds: string[] = [];
  if (job?.entity_type === "users") {
    const { data: rows } = await supabase
      .from("import_rows")
      .select("normalized_payload")
      .eq("batch_id", jobId)
      .eq("is_valid", true)
      .order("line_number");
    for (const row of rows ?? []) {
      const payload = row.normalized_payload as Record<string, unknown>;
      const email = String(payload.email ?? "").toLowerCase();
      const fullName = `${String(payload.first_name ?? "")} ${String(payload.last_name ?? "")}`.trim();
      const { data: existing } = await admin.from("users").select("id").ilike("email", email).maybeSingle();
      if (existing) continue;
      const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: resolveOnboardingRedirectUrl(),
      });
      if (invitationError || !invitation.user) {
        await Promise.all(invitedUserIds.map((userId) => admin.auth.admin.deleteUser(userId)));
        const message = invitationError?.message ?? `Invitation impossible pour ${email}.`;
        await markFailed(message);
        throw new Error(message);
      }
      invitedUserIds.push(invitation.user.id);
    }
  }
  const { data, error } = await supabase.rpc("execute_onboarding_import", { target_batch_id: jobId });
  const result = data?.[0];
  if (error || !result || result.lifecycle_status === "failed") {
    await Promise.all(invitedUserIds.map((userId) => admin.auth.admin.deleteUser(userId)));
    const message = error?.message ?? result?.error_message ?? "L’import a échoué avant son exécution complète.";
    await markFailed(message);
    throw new Error(message);
  }
  revalidatePath("/dashboard/admin/onboarding");
}

export async function rollbackOnboardingImportAction(formData: FormData) {
  const jobId = z.string().uuid().parse(formData.get("jobId"));
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("rollback_onboarding_import", { target_batch_id: jobId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/onboarding");
}

export async function activateBrandAction(formData: FormData) {
  const brandId = z.string().uuid().parse(formData.get("brandId"));
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc("activate_onboarded_brand", { target_brand_id: brandId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/onboarding");
}
