import { describe, expect, it } from "vitest";
import { confidenceTier, interpretAssistantMessage } from "./assistant-interpreter";

describe("assistant interpretation", () => {
  it.each([
    ["Quelle est ma prochaine visite ?", "get_next_visit"],
    ["Résume-moi la Pharmacie République", "get_pharmacy_summary"],
    ["Visite terminée. Intérêt DREAM. La rappeler mardi prochain.", "prepare_interaction_with_next_action"],
    ["Rappelle-moi de contacter la Pharmacie République jeudi", "prepare_task"],
    ["Ajoute une note sur Pharmacie du Centre", "prepare_interaction"],
  ])("maps %s to %s", (message, intent) => {
    expect(interpretAssistantMessage(message).intent).toBe(intent);
  });

  it("separates high, medium and low confidence", () => {
    expect(confidenceTier(0.9)).toBe("high");
    expect(confidenceTier(0.6)).toBe("medium");
    expect(confidenceTier(0.2)).toBe("low");
  });

  it("extracts a clean pharmacy query", () => {
    expect(interpretAssistantMessage("Rappelle-moi de contacter la Pharmacie République jeudi").pharmacyQuery).toBe("Pharmacie République");
  });
});

