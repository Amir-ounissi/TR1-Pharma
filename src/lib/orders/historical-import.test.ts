import { describe, expect, it } from "vitest";
import { isIncompleteHubSpotHistory } from "./historical-import";

describe("isIncompleteHubSpotHistory", () => {
  it("recognizes imported orders explicitly marked incomplete", () => {
    expect(isIncompleteHubSpotHistory({
      source: "import",
      line_items_complete: false,
      notes: "Import HubSpot Naali historique 2025 · détail lignes source incomplet",
    })).toBe(true);
  });

  it("keeps complete imports and regular orders unchanged", () => {
    expect(isIncompleteHubSpotHistory({
      source: "import",
      line_items_complete: true,
      notes: "Import complet",
    })).toBe(false);
    expect(isIncompleteHubSpotHistory({
      source: "manual",
      line_items_complete: false,
      notes: "Détail incomplet",
    })).toBe(false);
  });
});
