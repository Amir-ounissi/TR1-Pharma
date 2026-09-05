"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_BRAND_COOKIE, requireUser } from "@/lib/auth";
import { previewImport } from "@/lib/imports/import-engine";
import type { ColumnMapping, ImportMode, ImportType } from "@/lib/imports/import-types";
import { requireSelfServiceOnboardingBrand } from "@/lib/onboarding/self-service";
import { resolveOnboardingRedirectUrl } from "@/lib/runtime-environment";
import { createAdminClient } from "@/lib/supabase/admin";

export type AutonomousOnboardingActionState = {
  error?: string;
  success?: string;
  brandId?: string;
  jobId?: string;
  summary?: { total: number; valid: number; warnings: number; errors: number; duplicates: number };
};

const startSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().max(160).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(3).max(80),
  locale: z.string().trim().min(2).max(20),
  brandName: z.string().trim().min(2).max(120),
  brandCode: z.string().trim().min(2).max(40),
  accentColor: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal("")]),
  description: z.string().trim().max(300).optional(),
  planKey: z.string().trim().min(2).max(63),
});

export async function startAutonomousOnboardingAction(
  _state: AutonomousOnboardingActionState,
  formData: FormData,
): Promise<AutonomousOnboardingActionState> {
  const parsed = startSchema.safeParse({
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName") || undefined,
    countryCode: formData.get("countryCode"),
    currencyCode: formData.get("currencyCode"),
    timezone: formData.get("timezone"),
    locale: formData.get("locale"),
    brandName: formData.get("brandName"),
    brandCode: formData.get("brandCode"),
    accentColor: formData.get("accentColor") ?? "",
    description: formData.get("description") || undefined,
    planKey: formData.get("planKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Les informations de l’espace sont invalides." };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("start_self_service_onboarding", {
    organization_data: {
      legal_name: parsed.data.legalName,
      trade_name: parsed.data.tradeName,
      country_code: parsed.data.countryCode,
      currency_code: parsed.data.currencyCode,
      timezone: parsed.data.timezone,
      locale: parsed.data.locale,
    },
    brand_data: {
      name: parsed.data.brandName,
      code: parsed.data.brandCode,
      country_code: parsed.data.countryCode,
      currency_code: parsed.data.currencyCode,
      accent_color: parsed.data.accentColor || null,
      short_description: parsed.data.description,
    },
    target_plan_key: parsed.data.planKey,
  });

  if (error) return { error: error.message };
  const result = data?.[0];
  revalidatePath("/setup");
  return { success: "Votre espace brouillon est prêt à être configuré.", brandId: result?.brand_id };
}

const settingsSchema = z.object({
  brandId: z.string().uuid(),
  brandName: z.string().trim().min(2).max(120),
  brandCode: z.string().trim().min(2).max(40),
  brandSlug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  countryCode: z.string().trim().length(2),
  currencyCode: z.string().trim().length(3),
  timezone: z.string().trim().min(3).max(80),
  commercialEmail: z.union([z.email(), z.literal("")]),
  orderEmail: z.union([z.email(), z.literal("")]),
  phone: z.string().trim().max(40).optional(),
  addressLine1: z.string().trim().max(180).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  description: z.string().trim().max(300).optional(),
  defaultReorderIntervalDays: z.coerce.number().int().min(1).max(365),
  firstReorderTargetDays: z.coerce.number().int().min(1).max(365),
  reorderDueSoonDays: z.coerce.number().int().min(0).max(90),
  atRiskMultiplier: z.coerce.number().min(1).max(10),
  dormantMultiplier: z.coerce.number().min(1).max(20),
  reorderEligibilityDays: z.coerce.number().int().min(0).max(365),
  postMissionFollowupDays: z.coerce.number().int().min(1).max(90),
});

export async function updateAutonomousSettingsAction(formData: FormData) {
  const parsed = settingsSchema.parse(Object.fromEntries(formData));
  const { supabase } = await requireSelfServiceOnboardingBrand(parsed.brandId);
  const { error } = await supabase.rpc("update_onboarding_settings", {
    target_brand_id: parsed.brandId,
    settings_data: {
      name: parsed.brandName,
      code: parsed.brandCode,
      slug: parsed.brandSlug,
      country_code: parsed.countryCode.toUpperCase(),
      currency_code: parsed.currencyCode.toUpperCase(),
      timezone: parsed.timezone,
      commercial_email: parsed.commercialEmail || null,
      order_email: parsed.orderEmail || null,
      phone: parsed.phone || null,
      address_line_1: parsed.addressLine1 || null,
      postal_code: parsed.postalCode || null,
      city: parsed.city || null,
      short_description: parsed.description || null,
      default_reorder_interval_days: parsed.defaultReorderIntervalDays,
      first_reorder_target_days: parsed.firstReorderTargetDays,
      reorder_due_soon_days: parsed.reorderDueSoonDays,
      at_risk_multiplier: parsed.atRiskMultiplier,
      dormant_multiplier: parsed.dormantMultiplier,
      reorder_eligibility_days: parsed.reorderEligibilityDays,
      post_mission_followup_days: parsed.postMissionFollowupDays,
    },
  });
  if (error) throw new Error(error.message);
  const { error: progressError } = await supabase.rpc("mark_self_service_onboarding_step", {
    target_brand_id: parsed.brandId,
    target_step: "settings",
    target_status: "completed",
  });
  if (progressError) throw new Error(progressError.message);
  revalidatePath("/setup");
}

export async function markAutonomousStepAction(formData: FormData) {
  const parsed = z.object({
    brandId: z.string().uuid(),
    step: z.enum(["users", "territories"]),
    status: z.enum(["completed", "skipped"]),
  }).parse(Object.fromEntries(formData));
  const { supabase } = await requireSelfServiceOnboardingBrand(parsed.brandId);
  const { error } = await supabase.rpc("mark_self_service_onboarding_step", {
    target_brand_id: parsed.brandId,
    target_step: parsed.step,
    target_status: parsed.status,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/setup");
}

export async function inviteAutonomousTeamMemberAction(
  _state: AutonomousOnboardingActionState,
  formData: FormData,
): Promise<AutonomousOnboardingActionState> {
  const parsed = z.object({
    brandId: z.string().uuid(),
    email: z.email(),
    fullName: z.string().trim().min(2).max(120),
    roleKey: z.enum(["brand_admin", "brand_user", "agent", "facilitator"]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Les informations du membre sont invalides." };

  try {
    const { supabase, userId, onboarding } = await requireSelfServiceOnboardingBrand(parsed.data.brandId);
    const admin = createAdminClient();
    const { data: existingUser } = await admin.from("users").select("id").ilike("email", parsed.data.email).maybeSingle();
    if (existingUser) {
      return { error: "Cet email possède déjà un compte TR1. Son rattachement doit être traité depuis la gestion des accès." };
    }

    const [{ data: role }, { data: brand }] = await Promise.all([
      admin.from("roles").select("id").eq("key", parsed.data.roleKey).single(),
      admin.from("brands").select("organization_id").eq("id", parsed.data.brandId).single(),
    ]);
    if (!role || !brand) return { error: "Configuration de marque incomplète." };

    const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.fullName },
      redirectTo: resolveOnboardingRedirectUrl(),
    });
    if (invitationError || !invitation.user) {
      return { error: invitationError?.message ?? "Invitation impossible." };
    }

    const { error: membershipError } = await admin.from("memberships").insert({
      user_id: invitation.user.id,
      organization_id: brand.organization_id,
      brand_id: parsed.data.brandId,
      role_id: role.id,
      invited_by: userId,
      status: "invited",
    });
    if (membershipError) {
      await admin.auth.admin.deleteUser(invitation.user.id);
      return { error: membershipError.message };
    }

    if (parsed.data.roleKey === "agent") {
      const { data: agent, error: agentError } = await admin.from("agents").insert({
        user_id: invitation.user.id,
        kind: "commercial",
        is_active: true,
      }).select("id").single();
      if (agentError || !agent) {
        return { error: agentError?.message ?? "Le profil agent n’a pas pu être créé." };
      }
      const { error: assignmentError } = await admin.from("agent_brand_assignments").insert({
        brand_id: parsed.data.brandId,
        agent_id: agent.id,
        starts_at: new Date().toISOString().slice(0, 10),
      });
      if (assignmentError) return { error: assignmentError.message };
    }

    const { error: progressError } = await supabase.rpc("mark_self_service_onboarding_step", {
      target_brand_id: onboarding.brand_id,
      target_step: "users",
      target_status: "completed",
    });
    if (progressError) return { error: progressError.message };
    revalidatePath("/setup");
    return { success: "Invitation envoyée. Le membre activera son accès depuis son email.", brandId: parsed.data.brandId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invitation impossible." };
  }
}

export async function stageAutonomousOnboardingImportAction(
  _state: AutonomousOnboardingActionState,
  formData: FormData,
): Promise<AutonomousOnboardingActionState> {
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

  let preview;
  const content = await file.text();
  try {
    const manualMapping = typeof mappingValue === "string" && mappingValue ? JSON.parse(mappingValue) as ColumnMapping : undefined;
    preview = previewImport({ content, type, dateFormat, manualMapping });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Analyse impossible." };
  }

  const { supabase, userId } = await requireSelfServiceOnboardingBrand(brandId.data);
  const { data: brand } = await supabase.from("brands").select("organization_id").eq("id", brandId.data).single();
  if (!brand) return { error: "Marque inaccessible." };
  const hash = createHash("sha256").update(content).digest("hex");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const { data: job, error: jobError } = await supabase.from("import_batches").insert({
    organization_id: brand.organization_id,
    brand_id: brandId.data,
    entity_type: type,
    strategy: mode === "update_only" ? "update_only" : mode === "upsert" ? "upsert" : "create_only",
    import_mode: mode,
    status: "preview",
    lifecycle_status: "parsing",
    file_name: safeName,
    file_hash: hash,
    column_mapping: preview.mapping,
    total_rows: preview.summary.total,
    valid_rows: preview.summary.valid + preview.summary.warnings,
    warning_rows: preview.summary.warnings,
    error_rows: preview.summary.errors,
    duplicate_rows: preview.summary.duplicates,
    created_by: userId,
    validated_at: new Date().toISOString(),
    metadata: { delimiter: preview.delimiter, date_format: dateFormat ?? "ISO", onboarding_mode: "self_service" },
  }).select("id").single();
  if (jobError || !job) return { error: jobError?.code === "23505" ? "Ce fichier a déjà été préparé pour cette marque." : jobError?.message };

  const sourcePath = `${brandId.data}/${job.id}/${safeName}`;
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
    { organization_id: brand.organization_id, brand_id: brandId.data, import_batch_id: job.id, actor_user_id: userId, event_name: "import_file_uploaded", metadata: { file_name: safeName, bytes: file.size, mode: "self_service" } },
    { organization_id: brand.organization_id, brand_id: brandId.data, import_batch_id: job.id, actor_user_id: userId, event_name: "import_mapping_completed", metadata: { mapped_columns: Object.values(preview.mapping).filter(Boolean).length } },
    { organization_id: brand.organization_id, brand_id: brandId.data, import_batch_id: job.id, actor_user_id: userId, event_name: "import_validation_completed", metadata: preview.summary },
  ]);
  revalidatePath("/setup");
  return { success: preview.summary.errors ? "Prévisualisation créée avec erreurs à corriger." : "Import validé et prêt à être exécuté.", brandId: brandId.data, jobId: job.id, summary: preview.summary };
}

const nextStepByImportType: Partial<Record<ImportType, { step: "users" | "territories" | "pharmacies" | "products"; next: string }>> = {
  users: { step: "users", next: "territories" },
  territories: { step: "territories", next: "pharmacies" },
  pharmacies: { step: "pharmacies", next: "products" },
  products: { step: "products", next: "settings" },
};

export async function executeAutonomousOnboardingImportAction(formData: FormData) {
  const jobId = z.string().uuid().parse(formData.get("jobId"));
  const { supabase, userId } = await requireUser();
  const { data: job } = await supabase
    .from("import_batches")
    .select("entity_type,organization_id,brand_id")
    .eq("id", jobId)
    .single();
  if (!job) throw new Error("Import introuvable.");
  await requireSelfServiceOnboardingBrand(job.brand_id);

  const admin = createAdminClient();
  const markFailed = async (message: string) => {
    await supabase.from("import_batches").update({ lifecycle_status: "failed" }).eq("id", jobId);
    await supabase.from("onboarding_audit_logs").insert({
      organization_id: job.organization_id,
      brand_id: job.brand_id,
      import_batch_id: jobId,
      actor_user_id: userId,
      event_name: "import_failed",
      metadata: { reason: message.slice(0, 500), mode: "self_service" },
    });
  };

  const invitedUserIds: string[] = [];
  if (job.entity_type === "users") {
    const { data: rows } = await supabase.from("import_rows").select("normalized_payload").eq("batch_id", jobId).eq("is_valid", true).order("line_number");
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
        await Promise.all(invitedUserIds.map((invitedId) => admin.auth.admin.deleteUser(invitedId)));
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
    await Promise.all(invitedUserIds.map((invitedId) => admin.auth.admin.deleteUser(invitedId)));
    const message = error?.message ?? result?.error_message ?? "L’import a échoué avant son exécution complète.";
    await markFailed(message);
    throw new Error(message);
  }

  const progress = nextStepByImportType[job.entity_type as ImportType];
  if (progress) {
    const { error: progressError } = await supabase.rpc("mark_self_service_onboarding_step", {
      target_brand_id: job.brand_id,
      target_step: progress.step,
      target_status: "completed",
    });
    if (progressError) throw new Error(progressError.message);
  }
  revalidatePath("/setup");
}

export async function activateAutonomousOnboardingAction(formData: FormData) {
  const brandId = z.string().uuid().parse(formData.get("brandId"));
  const { supabase } = await requireSelfServiceOnboardingBrand(brandId);
  const { error } = await supabase.rpc("activate_self_service_brand", { target_brand_id: brandId });
  if (error) throw new Error(error.message);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRAND_COOKIE, brandId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/dashboard");
}
