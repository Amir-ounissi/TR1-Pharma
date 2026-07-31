import { describe, expect, it } from "vitest";
import { formatActionSummary, formatActionTiming, presentationLabel, presentationText } from "./presentation";

describe("presentation", () => {
  it("maps technical enums to French labels", () => {
    expect(presentationLabel("strategic")).toBe("Stratégique");
    expect(presentationLabel("very_high")).toBe("Très fort potentiel");
    expect(presentationLabel("follow_up")).toBe("Relance");
    expect(presentationLabel("reorder_overdue")).toBe("Réassort en retard");
    expect(presentationLabel("strong_decline")).toBe("Forte baisse");
    expect(presentationText("Suite : Compte rendu visit")).toBe("Suite — compte rendu de visite");
  });

  it("formats today and tomorrow boundaries", () => {
    const now = new Date(2026, 6, 27, 23, 30);
    expect(formatActionTiming(new Date(2026, 6, 27, 8), now).label).toBe("Aujourd’hui");
    expect(formatActionTiming(new Date(2026, 6, 28, 0, 15), now).label).toBe("Demain");
  });

  it("formats future and overdue actions", () => {
    const now = new Date("2026-07-27T10:00:00Z");
    expect(formatActionTiming("2026-07-31T10:00:00Z", now).label).toBe("Dans 4 jours");
    expect(formatActionTiming("2026-07-23T10:00:00Z", now).label).toBe("En retard de 4 jours");
    expect(formatActionSummary("call", "2026-07-23T10:00:00Z", now)).toBe("Appel · En retard de 4 jours");
  });

  it("handles an action without date", () => {
    expect(formatActionTiming(null)).toMatchObject({ kind: "unscheduled", label: "Date à définir" });
  });
});
