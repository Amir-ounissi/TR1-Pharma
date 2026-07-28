"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { createAssistantActions } from "@/lib/assistant/assistant-actions";
import { createAssistantEngine } from "@/lib/assistant/assistant-engine";
import {
  assistantMessageSchema,
  databaseUuid,
  interactionPayloadSchema,
  taskPayloadSchema,
  type AssistantResponse,
} from "@/lib/assistant/assistant-schemas";
import { createAssistantTools, type AssistantRpcClient } from "@/lib/assistant/assistant-tools";

function asAssistantClient(client: unknown) {
  return client as AssistantRpcClient;
}

export async function assistantOpenedAction() {
  const { supabase, brand } = await requireActiveBrand();
  await supabase.rpc("track_product_event", {
    target_event: "assistant_opened",
    target_brand_id: brand.id,
    target_pharmacy_id: null,
    target_source: "assistant_terrain",
    target_metadata: {},
  });
}

export async function sendAssistantMessageAction(
  message: string,
  timezone: string,
  selectedBrandPharmacyId?: string,
): Promise<AssistantResponse> {
  const parsed = assistantMessageSchema.safeParse({ message, timezone, selectedBrandPharmacyId });
  if (!parsed.success) return { kind: "error", message: "Le message est invalide ou trop long." };
  try {
    const { supabase, brand } = await requireActiveBrand();
    const engine = createAssistantEngine(createAssistantTools(asAssistantClient(supabase)));
    return await engine.process({
      brandId: brand.id,
      message: parsed.data.message,
      timezone: parsed.data.timezone,
      selectedBrandPharmacyId: parsed.data.selectedBrandPharmacyId,
    });
  } catch {
    return { kind: "error", message: "L’Assistant n’a pas pu traiter la demande. Réessayez." };
  }
}

export async function confirmAssistantDraftAction(draftId: string): Promise<AssistantResponse> {
  const parsed = databaseUuid.safeParse(draftId);
  if (!parsed.success) return { kind: "error", message: "Brouillon invalide." };
  try {
    const { supabase, brand } = await requireActiveBrand();
    const response = await createAssistantActions(asAssistantClient(supabase)).confirm(parsed.data, brand.id);
    revalidatePath("/dashboard/agent/assistant");
    revalidatePath("/dashboard/agent");
    revalidatePath("/dashboard/tasks");
    return response;
  } catch {
    return { kind: "error", message: "La confirmation a été refusée." };
  }
}

export async function cancelAssistantDraftAction(draftId: string): Promise<AssistantResponse> {
  const parsed = databaseUuid.safeParse(draftId);
  if (!parsed.success) return { kind: "error", message: "Brouillon invalide." };
  try {
    const { supabase, brand } = await requireActiveBrand();
    return await createAssistantActions(asAssistantClient(supabase)).cancel(parsed.data, brand.id);
  } catch {
    return { kind: "error", message: "L’annulation a été refusée." };
  }
}

export async function modifyAssistantDraftAction(
  draftId: string,
  brandPharmacyId: string,
  payload: Record<string, unknown>,
): Promise<AssistantResponse> {
  const identifiers = z.object({ draftId: databaseUuid, brandPharmacyId: databaseUuid }).safeParse({ draftId, brandPharmacyId });
  const parsedPayload = ("task_type" in payload ? taskPayloadSchema : interactionPayloadSchema).safeParse(payload);
  if (!identifiers.success || !parsedPayload.success) return { kind: "error", message: "Les modifications sont invalides." };
  try {
    const { supabase, brand } = await requireActiveBrand();
    const draft = await createAssistantActions(asAssistantClient(supabase)).update(
      identifiers.data.draftId,
      identifiers.data.brandPharmacyId,
      parsedPayload.data,
      brand.id,
    );
    const summary = await supabase.rpc("get_field_pharmacy_summary", {
      target_brand_pharmacy_id: draft.brand_pharmacy_id,
    });
    if (summary.error || !summary.data) return { kind: "error", message: "La pharmacie sélectionnée est indisponible." };
    const data = summary.data as Record<string, unknown>;
    return {
      kind: "draft",
      message: "Brouillon modifié. Vérifiez-le avant confirmation.",
      pharmacy: {
        brand_pharmacy_id: draft.brand_pharmacy_id,
        pharmacy_id: draft.pharmacy_id,
        pharmacy_name: String(data.name),
        city: String(data.address ?? "").split(",").at(-1)?.trim().replace(/^\d{5}\s*/, "") ?? null,
        postal_code: null,
        address_line_1: String(data.address ?? ""),
        phone: data.phone ? String(data.phone) : null,
        commercial_status: String(data.status ?? ""),
        priority_level: String(data.priority ?? ""),
        potential_level: String(data.potential ?? ""),
        territory_id: null,
      },
      draft,
    };
  } catch {
    return { kind: "error", message: "La modification a été refusée." };
  }
}

export async function searchAssistantPharmaciesAction(query: string) {
  const parsed = z.string().trim().min(2).max(120).safeParse(query);
  if (!parsed.success) return [];
  const { supabase, brand } = await requireActiveBrand();
  const { data, error } = await supabase.rpc("search_authorized_pharmacies", {
    target_brand_id: brand.id,
    search_text: parsed.data,
    result_limit: 10,
  });
  return error ? [] : (data ?? []);
}

