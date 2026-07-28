import { buildGoogleMapsUrl, buildWazeUrl } from "../agent-experience";
import { presentationLabel } from "../presentation";
import { resolveNaturalDate } from "./assistant-dates";
import { confidenceTier, interpretAssistantMessage } from "./assistant-interpreter";
import {
  assistantDraftSchema,
  interactionPayloadSchema,
  taskPayloadSchema,
  type AssistantResponse,
  type PharmacyMatch,
} from "./assistant-schemas";

type AssistantTools = {
  searchPharmacies(brandId: string, query: string): Promise<PharmacyMatch[]>;
  getPharmacySummary(brandPharmacyId: string): Promise<unknown>;
  getNextVisit(brandId: string): Promise<unknown>;
  getTodayAgenda(brandId: string, date: string): Promise<unknown>;
  getRecentInteractions(brandPharmacyId: string): Promise<unknown>;
  createDraft(parameters: Record<string, unknown>): Promise<unknown>;
  setContext(parameters: Record<string, unknown>): Promise<unknown>;
  getContext(brandId: string): Promise<Record<string, unknown> | null>;
  recordAudit(parameters: Record<string, unknown>): Promise<unknown>;
  trackEvent(parameters: Record<string, unknown>): Promise<unknown>;
};

type EngineInput = {
  brandId: string;
  message: string;
  timezone: string;
  selectedBrandPharmacyId?: string;
  now?: Date;
};

function safeMetadata(message: string, intent?: string) {
  return {
    message_excerpt: message.replace(/\s+/g, " ").slice(0, 300),
    ...(intent ? { intent } : {}),
  };
}

function pharmacyFromSummary(summary: Record<string, unknown>): PharmacyMatch {
  const address = String(summary.address ?? "");
  const city = address.split(",").at(-1)?.trim().replace(/^\d{5}\s*/, "") ?? null;
  return {
    brand_pharmacy_id: String(summary.brand_pharmacy_id),
    pharmacy_id: String(summary.pharmacy_id),
    pharmacy_name: String(summary.name),
    city,
    postal_code: null,
    address_line_1: address || null,
    phone: summary.phone ? String(summary.phone) : null,
    commercial_status: String(summary.status ?? ""),
    priority_level: String(summary.priority ?? ""),
    potential_level: String(summary.potential ?? ""),
    territory_id: null,
  };
}

function extractVisitNote(message: string) {
  const withoutLead = message.replace(/^.*?visite\s+termin[ée]e?\.?\s*/i, "");
  const withoutReminder = withoutLead.replace(/\s*(?:la\s+)?rapp?eler?\b.*$/i, "");
  const note = withoutReminder.trim().replace(/^[.\s]+|[.\s]+$/g, "");
  return note.length >= 2 ? `${note.charAt(0).toUpperCase()}${note.slice(1)}.` : "Visite terminée.";
}

async function audit(
  tools: AssistantTools,
  brandId: string,
  event: string,
  metadata: Record<string, unknown>,
  pharmacyId?: string,
  draftId?: string,
) {
  await tools.recordAudit({
    target_brand_id: brandId,
    target_event: event,
    target_pharmacy_id: pharmacyId ?? null,
    target_draft_id: draftId ?? null,
    target_metadata: metadata,
  });
}

async function track(tools: AssistantTools, brandId: string, event: string, pharmacyId?: string) {
  await tools.trackEvent({
    target_event: event,
    target_brand_id: brandId,
    target_pharmacy_id: pharmacyId ?? null,
    target_source: "assistant_terrain",
    target_metadata: {},
  });
}

async function resolvePharmacy(
  tools: AssistantTools,
  input: EngineInput,
  query: string | undefined,
): Promise<PharmacyMatch | AssistantResponse> {
  if (input.selectedBrandPharmacyId) {
    const summary = await tools.getPharmacySummary(input.selectedBrandPharmacyId) as Record<string, unknown>;
    return pharmacyFromSummary(summary);
  }
  if (query) {
    const matches = await tools.searchPharmacies(input.brandId, query);
    if (matches.length === 0) {
      return { kind: "clarification", message: "Je ne trouve pas cette pharmacie dans votre périmètre autorisé." };
    }
    if (matches.length > 1) {
      await audit(tools, input.brandId, "clarification_requested", { reason: "pharmacy_ambiguity", result_count: matches.length });
      await track(tools, input.brandId, "assistant_pharmacy_disambiguation_requested");
      return {
        kind: "disambiguation",
        message: "J’ai trouvé plusieurs pharmacies correspondantes. Laquelle souhaitez-vous utiliser ?",
        choices: matches,
        originalMessage: input.message,
      };
    }
    return matches[0];
  }
  const context = await tools.getContext(input.brandId);
  if (context?.active_brand_pharmacy_id) {
    const summary = await tools.getPharmacySummary(String(context.active_brand_pharmacy_id)) as Record<string, unknown>;
    return pharmacyFromSummary(summary);
  }
  const visit = await tools.getNextVisit(input.brandId) as Record<string, unknown> | null;
  if (visit?.brand_pharmacy_id) return pharmacyFromSummary(visit);
  return { kind: "clarification", message: "De quelle pharmacie s’agit-il ?" };
}

export function createAssistantEngine(tools: AssistantTools) {
  return {
    async process(input: EngineInput): Promise<AssistantResponse> {
      await audit(tools, input.brandId, "message_received", safeMetadata(input.message));
      await track(tools, input.brandId, "assistant_message_sent");
      const interpretation = interpretAssistantMessage(input.message);
      const tier = confidenceTier(interpretation.confidence);
      await audit(tools, input.brandId, "intent_resolved", {
        intent: interpretation.intent,
        confidence_tier: tier,
      });
      await track(tools, input.brandId, "assistant_intent_resolved");

      if (tier === "low") {
        await audit(tools, input.brandId, "clarification_requested", { reason: "low_confidence" });
        await track(tools, input.brandId, "assistant_clarification_requested");
        return { kind: "clarification", message: "Je n’ai pas compris la demande. Pouvez-vous la reformuler simplement ?" };
      }
      if (tier === "medium") {
        await audit(tools, input.brandId, "clarification_requested", { reason: "medium_confidence" });
        await track(tools, input.brandId, "assistant_clarification_requested");
        return {
          kind: "clarification",
          message: "Souhaitez-vous préparer une tâche de rappel ou ajouter une information à une interaction ?",
        };
      }

      if (interpretation.intent === "get_next_visit") {
        await audit(tools, input.brandId, "tool_called", { tool: "get_next_visit" });
        const visit = await tools.getNextVisit(input.brandId) as Record<string, unknown> | null;
        if (!visit) return { kind: "answer", message: "Aucune prochaine visite n’est planifiée." };
        await tools.setContext({
          target_brand_id: input.brandId,
          target_brand_pharmacy_id: visit.brand_pharmacy_id,
          target_last_intent: interpretation.intent,
          target_pending_draft_id: null,
        });
        const navigation = {
          latitude: visit.latitude as number | null,
          longitude: visit.longitude as number | null,
          address_line_1: String(visit.address ?? ""),
        };
        return {
          kind: "answer",
          message: `Votre prochaine visite concerne ${visit.name}.`,
          details: {
            pharmacy: visit.name,
            scheduledAt: visit.scheduled_at,
            address: visit.address,
            contact: visit.primary_contact,
            objective: visit.objective,
            lastOrderAt: visit.last_order_at,
            nextActionType: visit.next_action_type,
            nextActionAt: visit.next_action_at,
            wazeUrl: buildWazeUrl(navigation),
            mapsUrl: buildGoogleMapsUrl(navigation),
          },
        };
      }

      if (interpretation.intent === "get_today_agenda") {
        await audit(tools, input.brandId, "tool_called", { tool: "get_today_agenda" });
        const date = new Intl.DateTimeFormat("en-CA", { timeZone: input.timezone }).format(input.now ?? new Date());
        const agenda = await tools.getTodayAgenda(input.brandId, date);
        return { kind: "answer", message: "Voici votre agenda du jour.", details: { agenda } };
      }

      if (interpretation.intent === "search_pharmacies") {
        const matches = await tools.searchPharmacies(input.brandId, interpretation.pharmacyQuery ?? "");
        return {
          kind: "answer",
          message: matches.length ? `${matches.length} pharmacie(s) trouvée(s) dans votre périmètre.` : "Je ne trouve pas cette pharmacie dans votre périmètre autorisé.",
          details: { pharmacies: matches },
        };
      }

      if (interpretation.intent === "get_pharmacy_summary") {
        const pharmacy = await resolvePharmacy(tools, input, interpretation.pharmacyQuery);
        if ("kind" in pharmacy) return pharmacy;
        await audit(tools, input.brandId, "tool_called", { tool: "get_pharmacy_summary" }, pharmacy.pharmacy_id);
        const summary = await tools.getPharmacySummary(pharmacy.brand_pharmacy_id) as Record<string, unknown>;
        await tools.setContext({
          target_brand_id: input.brandId,
          target_brand_pharmacy_id: pharmacy.brand_pharmacy_id,
          target_last_intent: interpretation.intent,
          target_pending_draft_id: null,
        });
        return {
          kind: "answer",
          message: `${pharmacy.pharmacy_name} — ${pharmacy.city ?? "ville non renseignée"}`,
          details: {
            status: presentationLabel(String(summary.status ?? "")),
            potential: presentationLabel(String(summary.potential ?? "")),
            lastOrderAt: summary.last_order_at,
            lastInteractionAt: summary.last_interaction_at,
            nextActionType: summary.next_action_type,
            nextActionAt: summary.next_action_at,
          },
        };
      }

      if (interpretation.intent === "get_recent_interactions") {
        const pharmacy = await resolvePharmacy(tools, input, interpretation.pharmacyQuery);
        if ("kind" in pharmacy) return pharmacy;
        const interactions = await tools.getRecentInteractions(pharmacy.brand_pharmacy_id);
        return {
          kind: "answer",
          message: `Voici les interactions récentes de ${pharmacy.pharmacy_name}.`,
          details: { interactions },
        };
      }

      const pharmacy = await resolvePharmacy(tools, input, interpretation.pharmacyQuery);
      if ("kind" in pharmacy) return pharmacy;
      const now = input.now ?? new Date();
      let actionType: "interaction" | "task" | "interaction_with_next_action";
      let payload: Record<string, unknown>;

      if (interpretation.intent === "prepare_task") {
        const due = resolveNaturalDate(input.message, { now, timezone: input.timezone });
        if (!due) return { kind: "clarification", message: "À quelle date souhaitez-vous planifier cette tâche ?" };
        actionType = "task";
        payload = taskPayloadSchema.parse({
          task_type: /appel|contacter|rappel/i.test(input.message) ? "call" : "follow_up",
          title: `Contacter ${pharmacy.pharmacy_name}`,
          description: input.message,
          priority: "normal",
          due_at: due.iso,
        });
      } else {
        const due = interpretation.intent === "prepare_interaction_with_next_action"
          ? resolveNaturalDate(input.message, { now, timezone: input.timezone })
          : null;
        if (interpretation.intent === "prepare_interaction_with_next_action" && !due) {
          return { kind: "clarification", message: "Quand faut-il effectuer la prochaine action ?" };
        }
        actionType = due ? "interaction_with_next_action" : "interaction";
        payload = interactionPayloadSchema.parse({
          interaction_type: /visite/i.test(input.message) ? "visit" : "other",
          outcome: /termin[ée]e/i.test(input.message) ? "completed" : "other",
          subject: /visite/i.test(input.message) ? "Compte rendu de visite" : "Note terrain",
          notes: extractVisitNote(input.message),
          occurred_at: now.toISOString(),
          ...(due ? { next_action_type: "call", next_action_at: due.iso } : {}),
        });
      }

      await audit(tools, input.brandId, "tool_called", { tool: interpretation.intent }, pharmacy.pharmacy_id);
      const draft = assistantDraftSchema.parse(await tools.createDraft({
        target_brand_id: input.brandId,
        target_brand_pharmacy_id: pharmacy.brand_pharmacy_id,
        target_action_type: actionType,
        target_payload: payload,
        target_confidence: interpretation.confidence,
      }));
      await tools.setContext({
        target_brand_id: input.brandId,
        target_brand_pharmacy_id: pharmacy.brand_pharmacy_id,
        target_last_intent: interpretation.intent,
        target_pending_draft_id: draft.id,
      });
      await track(tools, input.brandId, "assistant_draft_created", pharmacy.pharmacy_id);
      return {
        kind: "draft",
        message: "Action préparée. Vérifiez les informations avant de confirmer.",
        pharmacy,
        draft,
      };
    },
  };
}
