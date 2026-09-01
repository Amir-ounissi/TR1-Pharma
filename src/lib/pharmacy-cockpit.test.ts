import { describe, expect, it } from "vitest";
import { getPharmacyCockpit } from "./pharmacy-cockpit";

describe("getPharmacyCockpit", () => {
  it("classe un compte sans première commande à ouvrir", () => {
    expect(getPharmacyCockpit({ validOrderCount: 0, hasNextAction: false })).toMatchObject({
      objective: "open",
      objectiveLabel: "À ouvrir",
      primaryAction: { label: "Enregistrer la première commande" },
    });
  });

  it("classe un compte client avec opportunité à développer", () => {
    expect(getPharmacyCockpit({ firstOrderAt: "2026-07-01", validOrderCount: 2, strategicDistributionRate: 60, reorderCount: 1 })).toMatchObject({
      objective: "develop",
      objectiveLabel: "À développer",
    });
  });

  it("classe un compte client stabilisé à suivre", () => {
    expect(getPharmacyCockpit({ firstOrderAt: "2026-07-01", validOrderCount: 3, reorderCount: 2, strategicDistributionRate: 100, hasNextAction: true })).toMatchObject({
      objective: "follow",
      objectiveLabel: "À suivre",
    });
  });
});
