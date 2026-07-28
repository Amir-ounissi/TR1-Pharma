import { assistantDraftSchema, type AssistantResponse } from "./assistant-schemas";
import { createAssistantTools, type AssistantRpcClient } from "./assistant-tools";

type ConfirmationResult = {
  status: "confirmed" | "expired" | "failed";
  action_id: string | null;
  already_confirmed: boolean;
  error?: string;
};

export function createAssistantActions(client: AssistantRpcClient) {
  const tools = createAssistantTools(client);
  return {
    async confirm(draftId: string, brandId: string): Promise<AssistantResponse> {
      const result = await tools.confirmDraft(draftId) as ConfirmationResult;
      if (result.status === "expired") return { kind: "error", message: "Ce brouillon a expiré. Préparez une nouvelle action." };
      if (result.status === "failed" || !result.action_id) {
        await tools.trackEvent({
          target_event: "assistant_action_failed",
          target_brand_id: brandId,
          target_pharmacy_id: null,
          target_source: "assistant_terrain",
          target_metadata: {},
        });
        return { kind: "error", message: result.error ?? "L’action n’a pas pu être créée." };
      }
      await tools.trackEvent({
        target_event: "assistant_draft_confirmed",
        target_brand_id: brandId,
        target_pharmacy_id: null,
        target_source: "assistant_terrain",
        target_metadata: { already_confirmed: result.already_confirmed },
      });
      return {
        kind: "confirmed",
        message: result.already_confirmed ? "Cette action avait déjà été confirmée." : "Action confirmée et enregistrée.",
        actionId: result.action_id,
        alreadyConfirmed: result.already_confirmed,
      };
    },
    async cancel(draftId: string, brandId: string): Promise<AssistantResponse> {
      const draft = assistantDraftSchema.parse(await tools.cancelDraft(draftId));
      await tools.trackEvent({
        target_event: "assistant_draft_cancelled",
        target_brand_id: brandId,
        target_pharmacy_id: draft.pharmacy_id,
        target_source: "assistant_terrain",
        target_metadata: {},
      });
      return { kind: "cancelled", message: "Brouillon annulé. Aucune action métier n’a été créée.", draftId };
    },
    async update(
      draftId: string,
      brandPharmacyId: string,
      payload: Record<string, unknown>,
      brandId: string,
    ) {
      const draft = assistantDraftSchema.parse(await tools.updateDraft({
        target_draft_id: draftId,
        target_brand_pharmacy_id: brandPharmacyId,
        target_payload: payload,
      }));
      await tools.trackEvent({
        target_event: "assistant_draft_modified",
        target_brand_id: brandId,
        target_pharmacy_id: draft.pharmacy_id,
        target_source: "assistant_terrain",
        target_metadata: {},
      });
      return draft;
    },
  };
}

