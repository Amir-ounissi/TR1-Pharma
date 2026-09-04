import { describe, expect, it } from "vitest";
import { translateMatchMethod, translateUiMessage, uiLabel } from "./ui-copy";

describe("French UI copy", () => {
  it("translates technical enum values", () => {
    expect(uiLabel("partially_delivered")).toBe("Partiellement livrée");
    expect(uiLabel("commercial_visit")).toBe("Visite commerciale");
    expect(uiLabel("report_pending")).toBe("Compte rendu attendu");
    expect(uiLabel("brand_existing_client")).toBe("Client existant de la marque");
  });

  it("translates backend errors", () => {
    expect(translateUiMessage("Self assignment is forbidden"))
      .toBe("Vous ne pouvez pas vous attribuer directement cette pharmacie.");
  });

  it("translates PDF warnings", () => {
    expect(
      translateUiMessage(
        "Unlabeled number '342030194' ignored; SIRET/CIP/FINESS left null.",
      ),
    ).toContain("342030194");
  });

  it("translates matching methods", () => {
    expect(translateMatchMethod("reference_ean")).toBe("EAN de référence");
  });
});
