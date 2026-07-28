import { presentationLabel } from "../../presentation";
import type { AssistantResponse } from "../../assistant/assistant-schemas";

function date(value: unknown) {
  return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(String(value))) : "Non renseignée";
}

export function renderAssistantForWhatsApp(response: AssistantResponse, appUrl: string) {
  if (response.kind === "draft") {
    const payload = response.draft.payload;
    return [
      "Compte rendu préparé",
      "",
      response.pharmacy.pharmacy_name,
      "",
      "Note :",
      String(payload.notes ?? payload.description ?? ""),
      "",
      "Ce qui sera créé :",
      response.draft.action_type === "interaction_with_next_action" ? "• 1 compte rendu de visite\n• 1 rappel" : `• 1 ${presentationLabel(response.draft.action_type).toLowerCase()}`,
      payload.next_action_at || payload.due_at ? `\nRappel :\n${date(payload.next_action_at ?? payload.due_at)}` : "",
      "",
      "Répondez :",
      "1 — Confirmer",
      "2 — Modifier dans TR1",
      "3 — Annuler",
      `${appUrl}/dashboard/agent/assistant`,
    ].filter(Boolean).join("\n");
  }
  if (response.kind === "answer" && response.details && "pharmacy" in response.details) {
    const details = response.details;
    return [
      "Prochaine visite",
      "",
      String(details.pharmacy),
      String(details.address ?? ""),
      date(details.scheduledAt),
      "",
      `Objectif :\n${String(details.objective ?? "Non renseigné")}`,
      `Waze : ${String(details.wazeUrl)}`,
      `Maps : ${String(details.mapsUrl)}`,
    ].join("\n");
  }
  return response.message;
}

