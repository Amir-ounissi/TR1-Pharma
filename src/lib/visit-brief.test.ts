import { describe, expect, it } from "vitest";
import { buildVisitBrief } from "./visit-brief";

describe("buildVisitBrief", () => {
  it("priorise la prochaine action recommandée comme objectif", () => {
    const brief = buildVisitBrief({
      nextBestAction: {
        label: "Sécuriser le premier réassort",
        rationale: ["Première commande récente"],
      },
      fallbackObjective: "Faire le point",
    });

    expect(brief.objective).toBe("Sécuriser le premier réassort");
    expect(brief.opportunities[0]?.title).toBe("Sécuriser le premier réassort");
  });

  it("ne crée pas de signal quand la donnée est absente", () => {
    const brief = buildVisitBrief({ fallbackObjective: "Faire le point" });

    expect(brief.atAGlance).toEqual([]);
    expect(brief.alerts).toEqual([]);
    expect(brief.opportunities).toEqual([]);
    expect(brief.objective).toBe("Faire le point");
  });

  it("remonte les actions en retard et les références manquantes", () => {
    const brief = buildVisitBrief({
      overdueTasks: 2,
      missingProducts: ["Safran", "Magnésium"],
    });

    expect(brief.alerts[0]?.title).toContain("2 actions en retard");
    expect(brief.opportunities[0]?.detail).toContain("Safran");
  });
});
