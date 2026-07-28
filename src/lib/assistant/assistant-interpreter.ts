import type { AssistantIntent } from "./assistant-schemas";

export type AssistantInterpretation = {
  intent: AssistantIntent;
  confidence: number;
  pharmacyQuery?: string;
};

function cleanQuery(value: string) {
  return value
    .replace(/[?.!]+$/g, "")
    .replace(/\b(aujourd'hui|demain|après-demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\s+prochain)?\b.*$/i, "")
    .replace(/^(?:la|le|l')\s*/i, "")
    .trim();
}

export function interpretAssistantMessage(message: string): AssistantInterpretation {
  const normalized = message.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

  if (/prochaine\s+visite/.test(normalized)) return { intent: "get_next_visit", confidence: 0.98 };
  if (/agenda|programme.*journee|aujourd'hui.*(?:tache|mission)/.test(normalized)) {
    return { intent: "get_today_agenda", confidence: 0.94 };
  }
  if (/interactions?\s+recentes?/.test(normalized)) {
    return { intent: "get_recent_interactions", confidence: 0.92 };
  }
  const summary = message.match(/(?:résume(?:-moi)?|resume(?:-moi)?)\s+(?:la\s+|le\s+)?(.+)/i);
  if (summary) return { intent: "get_pharmacy_summary", confidence: 0.96, pharmacyQuery: cleanQuery(summary[1]) };

  if (/visite\s+terminee|visite\s+terminée/.test(message.toLowerCase())) {
    const hasNextAction = /rapp?el|recontact|prochaine action/i.test(message);
    return {
      intent: hasNextAction ? "prepare_interaction_with_next_action" : "prepare_interaction",
      confidence: hasNextAction ? 0.96 : 0.9,
    };
  }

  const task = message.match(/(?:rappelle-moi de|crée(?:r)? une tâche pour|tache pour)\s+(?:contacter|appeler|relancer)?\s*(.+)/i);
  if (task) return { intent: "prepare_task", confidence: 0.93, pharmacyQuery: cleanQuery(task[1]) };

  const note = message.match(/(?:ajoute|ajouter)\s+une\s+note\s+(?:sur|pour)\s+(.+)/i);
  if (note) return { intent: "prepare_interaction", confidence: 0.84, pharmacyQuery: cleanQuery(note[1]) };

  const search = message.match(/(?:cherche|recherche|trouve)\s+(?:la\s+)?(.+)/i);
  if (search) return { intent: "search_pharmacies", confidence: 0.88, pharmacyQuery: cleanQuery(search[1]) };

  if (/rappel|tache|tâche|note/.test(message.toLowerCase())) {
    return { intent: "unknown", confidence: 0.55 };
  }
  return { intent: "unknown", confidence: 0.2 };
}

export function confidenceTier(confidence: number) {
  if (confidence >= 0.8) return "high" as const;
  if (confidence >= 0.5) return "medium" as const;
  return "low" as const;
}
