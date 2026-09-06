import { describe, expect, it } from "vitest";
import {
  nextBestActionConfidenceDetail,
  nextBestActionConfidenceLabel,
  summarizeNextBestActions,
  type NextBestActionRow,
} from "./next-best-action";

const rows: NextBestActionRow[] = [
  {
    brand_pharmacy_id: "1",
    pharmacy_name: "Pharmacie A",
    city: "Paris",
    territory_name: "Paris",
    agent_name: "Nora",
    action_type: "secure_first_reorder",
    action_label: "Sécuriser le premier réassort",
    action_score: 82,
    confidence: "medium",
    suggested_due_at: "2026-09-06",
    rationale: ["Premier réassort à sécuriser"],
    evidence: {},
    has_next_action: false,
  },
  {
    brand_pharmacy_id: "2",
    pharmacy_name: "Pharmacie B",
    city: "Lyon",
    territory_name: "Lyon",
    agent_name: "Lucas",
    action_type: "recover_at_risk",
    action_label: "Récupérer le compte à risque",
    action_score: 90,
    confidence: "high",
    suggested_due_at: "2026-09-05",
    rationale: ["Fréquence de commande dégradée"],
    evidence: {},
    has_next_action: true,
  },
];

describe("Next Best Action", () => {
  it("résume les actions dues sans masquer la logique", () => {
    expect(summarizeNextBestActions(rows, new Date("2026-09-06T12:00:00.000Z"))).toEqual({
      total: 2,
      dueNow: 2,
      firstReorders: 1,
      withoutExistingAction: 1,
    });
  });

  it("explicite le niveau de confiance au lieu de produire un score opaque", () => {
    expect(nextBestActionConfidenceLabel("high")).toBe("Confiance élevée");
    expect(nextBestActionConfidenceLabel("medium")).toBe("Confiance moyenne");
    expect(nextBestActionConfidenceLabel("low")).toBe("Confiance prudente");
    expect(nextBestActionConfidenceDetail("low")).toContain("règle marque");
  });
});
