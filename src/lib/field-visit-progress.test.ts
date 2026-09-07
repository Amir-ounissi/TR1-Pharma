import { describe, expect, it } from "vitest";
import {
  addDaysToCalendarDate,
  buildVisitDay,
  type FieldVisitAgendaEvent,
  type FieldVisitCompletion,
} from "./field-visit-progress";

function visit(
  id: string,
  status = "planned",
  ownership = "mine",
): FieldVisitAgendaEvent {
  return {
    event_key: `visit:${id}`,
    source_kind: "field_visit",
    source_id: id,
    title: `Visite ${id}`,
    start_at: `2026-09-07T0${id}:00:00+00:00`,
    end_at: `2026-09-07T0${id}:30:00+00:00`,
    pharmacy_id: id,
    pharmacy_name: `Pharmacie ${id}`,
    city: "Marseille",
    ownership,
    status,
    metadata: { visit_kind: "client_visit" },
  };
}

function completion(id: string): FieldVisitCompletion {
  return {
    visit_id: id,
    brand_id: "brand",
    brand_pharmacy_id: `relation-${id}`,
    order_result: "no_order",
    photo_result: "not_required",
    note: "Compte rendu complet",
    next_visit_date: "2026-09-21",
    completed_at: "2026-09-07T10:00:00Z",
  };
}

describe("buildVisitDay", () => {
  it("compte uniquement une visite avec sa clôture conforme", () => {
    const result = buildVisitDay(
      [visit("1", "completed"), visit("2", "in_progress"), visit("3")],
      [completion("1")],
    );
    expect(result.total).toBe(3);
    expect(result.done).toBe(1);
    expect(result.needsCompletion).toBe(1);
    expect(result.todo).toBe(1);
  });

  it("ne transforme pas un simple statut completed en réussite", () => {
    const result = buildVisitDay([visit("1", "completed")], []);
    expect(result.done).toBe(0);
    expect(result.needsCompletion).toBe(1);
  });

  it("exclut annulations et visites d'un autre utilisateur", () => {
    const result = buildVisitDay([
      visit("1", "cancelled"),
      visit("2", "planned", "pharmacy_activity"),
      visit("3"),
    ], []);
    expect(result.total).toBe(1);
    expect(result.visits[0]?.source_id).toBe("3");
  });

  it("déduplique une visite physique", () => {
    const result = buildVisitDay([visit("1"), visit("1")], []);
    expect(result.total).toBe(1);
  });
});

describe("addDaysToCalendarDate", () => {
  it("ajoute des jours sans dépendre du fuseau local", () => {
    expect(addDaysToCalendarDate("2026-09-07", 7)).toBe("2026-09-14");
    expect(addDaysToCalendarDate("2026-09-30", 1)).toBe("2026-10-01");
  });
});
