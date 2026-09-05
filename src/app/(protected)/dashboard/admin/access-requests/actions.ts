"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";

export type AccessRequestActionState = { error?: string; success?: string };

const brandApprovalSchema = z.object({
  requestId: z.string().uuid(),
  targetBrandId: z.string().uuid(),
  reviewerNote: z.string().trim().max(500).optional(),
});

const facilitatorApprovalSchema = brandApprovalSchema;

const departmentCodeSchema = z
  .string()
  .trim()
  .regex(
    /^(0[1-9]|1[0-9]|2[1-9]|[3-8][0-9]|9[0-5]|2A|2B|97[1-4]|976)$/i,
  )
  .transform((value) => value.toUpperCase());

const agentApprovalSchema = brandApprovalSchema.extend({
  departmentCodes: z.array(departmentCodeSchema).min(1).max(101),
});

const rejectionSchema = z.object({
  requestId: z.string().uuid(),
  reviewerNote: z
    .string()
    .trim()
    .min(3, "Indiquez un motif de refus.")
    .max(500),
});

export async function approveBrandAccessRequestAction(
  _state: AccessRequestActionState,
  formData: FormData,
): Promise<AccessRequestActionState> {
  const parsed = brandApprovalSchema.safeParse({
    requestId: formData.get("requestId"),
    targetBrandId: formData.get("targetBrandId"),
    reviewerNote: formData.get("reviewerNote") || undefined,
  });

  if (!parsed.success) {
    return { error: "Les paramètres d’activation sont invalides." };
  }

  try {
    const { supabase } = await requirePlatformAdmin();

    const { data: request, error: requestError } = await supabase
      .from("access_requests")
      .select("requested_profile_type,requested_access")
      .eq("id", parsed.data.requestId)
      .eq("status", "pending")
      .maybeSingle();

    if (requestError) return { error: requestError.message };

    if (!request || request.requested_profile_type !== "brand") {
      return {
        error:
          "Cette demande ne peut pas recevoir un accès administrateur de marque.",
      };
    }

    const { data: targetBrand, error: targetBrandError } = await supabase
      .from("brands")
      .select("name,status,is_active")
      .eq("id", parsed.data.targetBrandId)
      .maybeSingle();

    if (targetBrandError) return { error: targetBrandError.message };

    const requestedCompanyName =
      typeof request.requested_access?.company_name === "string"
        ? normalizeBrandName(request.requested_access.company_name)
        : "";

    if (
      !targetBrand ||
      !targetBrand.is_active ||
      targetBrand.status !== "active" ||
      !requestedCompanyName ||
      normalizeBrandName(targetBrand.name) !== requestedCompanyName
    ) {
      return {
        error:
          "La marque sélectionnée ne correspond pas à une marque active demandée.",
      };
    }

    const { error } = await supabase.rpc("approve_access_request", {
      target_request_id: parsed.data.requestId,
      target_brand_id: parsed.data.targetBrandId,
      selected_brand_pharmacy_ids: [],
      review_note: parsed.data.reviewerNote ?? null,
    });

    if (error) return { error: error.message };

    revalidateAccessRequestPaths();
    return { success: "Accès administrateur accordé." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "L’accès n’a pas pu être activé.",
    };
  }
}

export async function approveAgentAccessRequestAction(
  _state: AccessRequestActionState,
  formData: FormData,
): Promise<AccessRequestActionState> {
  const parsed = agentApprovalSchema.safeParse({
    requestId: formData.get("requestId"),
    targetBrandId: formData.get("targetBrandId"),
    departmentCodes: formData.getAll("departmentCodes").map(String),
    reviewerNote: formData.get("reviewerNote") || undefined,
  });

  if (!parsed.success) {
    return {
      error:
        "Choisissez explicitement une marque et au moins un département valide.",
    };
  }

  const departmentCodes = [...new Set(parsed.data.departmentCodes)];

  try {
    const { supabase } = await requirePlatformAdmin();

    const { error } = await supabase.rpc(
      "approve_access_request_with_departments",
      {
        target_request_id: parsed.data.requestId,
        target_brand_id: parsed.data.targetBrandId,
        target_department_codes: departmentCodes,
        review_note: parsed.data.reviewerNote ?? null,
      },
    );

    if (error) {
      return { error: translateAgentApprovalError(error.message) };
    }

    revalidateAccessRequestPaths();

    return {
      success: `Accès agent accordé sur ${departmentCodes.length} département${departmentCodes.length > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "L’accès agent n’a pas pu être accordé.",
    };
  }
}

export async function approveFacilitatorAccessRequestAction(
  _state: AccessRequestActionState,
  formData: FormData,
): Promise<AccessRequestActionState> {
  const parsed = facilitatorApprovalSchema.safeParse({
    requestId: formData.get("requestId"),
    targetBrandId: formData.get("targetBrandId"),
    reviewerNote: formData.get("reviewerNote") || undefined,
  });

  if (!parsed.success) {
    return { error: "Choisissez explicitement une marque active." };
  }

  try {
    const { supabase } = await requirePlatformAdmin();
    const { error } = await supabase.rpc(
      "approve_facilitator_access_request",
      {
        target_request_id: parsed.data.requestId,
        target_brand_id: parsed.data.targetBrandId,
        review_note: parsed.data.reviewerNote ?? null,
      },
    );

    if (error) {
      return { error: translateFacilitatorApprovalError(error.message) };
    }

    revalidateAccessRequestPaths();
    return { success: "Intervenant activé avec ses activités." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "L’accès intervenant n’a pas pu être accordé.",
    };
  }
}

export async function rejectAccessRequestAction(
  _state: AccessRequestActionState,
  formData: FormData,
): Promise<AccessRequestActionState> {
  const parsed = rejectionSchema.safeParse({
    requestId: formData.get("requestId"),
    reviewerNote: formData.get("reviewerNote"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Le refus est invalide.",
    };
  }

  try {
    const { supabase, userId } = await requirePlatformAdmin();

    const { data, error } = await supabase
      .from("access_requests")
      .update({
        status: "rejected",
        reviewer_note: parsed.data.reviewerNote,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.requestId)
      .eq("status", "pending")
      .select("id");

    if (error) return { error: error.message };

    if (!data?.length) {
      return {
        error: "Cette demande a déjà été traitée ou n’existe plus.",
      };
    }

    revalidateAccessRequestPaths();
    return { success: "Demande refusée et historisée." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "La demande n’a pas pu être refusée.",
    };
  }
}

function revalidateAccessRequestPaths() {
  revalidatePath("/dashboard/admin/access-requests");
  revalidatePath("/dashboard/admin/users");
  revalidatePath("/dashboard");
}

function normalizeBrandName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function translateAgentApprovalError(message: string) {
  if (message.includes("already covered by an active agent")) {
    return "Un ou plusieurs départements sélectionnés sont déjà couverts par un autre agent actif.";
  }

  if (message.includes("assigned to another primary agent")) {
    return "Une ou plusieurs pharmacies de ce secteur sont déjà attribuées à un autre agent principal.";
  }

  if (message.includes("Invalid French department code")) {
    return "La sélection contient un code département invalide.";
  }

  return message;
}

function translateFacilitatorApprovalError(message: string) {
  if (message.includes("At least one facilitator activity is required")) {
    return "La demande intervenant ne contient aucune activité valide.";
  }

  if (message.includes("Unsupported facilitator activity")) {
    return "La demande contient une activité intervenant non prise en charge.";
  }

  if (message.includes("Target brand must be active")) {
    return "Sélectionnez une marque active.";
  }

  return message;
}
