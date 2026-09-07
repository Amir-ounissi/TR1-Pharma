import assert from "node:assert/strict";
import { test } from "node:test";
import { parisDay, personalDay, reportSuggestions, type DayEvent } from "../src/lib/field-progress.ts";
const event = (overrides: Partial<DayEvent> = {}): DayEvent => ({ event_key: "visit:a", source_kind: "field_visit", source_id: "a", title: "Visite", start_at: "2026-09-08T08:00:00Z", pharmacy_name: "Pharmacie", status: "planned", ownership: "mine", ...overrides });
test("ne récompense ni les missions voisines, ni les annulations, ni les propositions non validées", () => {
  const result = personalDay([event(), event({ ownership: "pharmacy_activity", source_id: "b" }), event({ status: "cancelled", source_id: "c" }), event({ source_kind: "mission", source_id: "d", metadata: { proposal_review_status: "pending" } })], {});
  assert.equal(result.total, 1); assert.equal(result.done, 0);
});
test("une échéance de rapport et un doublon ne gonflent pas le dénominateur", () => {
  assert.equal(personalDay([event(), event(), event({ source_kind: "report" }), event({ source_kind: "task" })], {}).total, 1);
});
test("distingue visite terminée, rapport envoyé, rejet et validation réelle", () => {
  const missions = ["submitted", "validated", "rejected", "needs_correction"].map((status) => event({ source_kind: "mission", source_id: status, status: status === "needs_correction" ? "report_pending" : "completed" }));
  const result = personalDay([event({ status: "completed" }), ...missions], Object.fromEntries(missions.map(m => [m.source_id, m.source_id])));
  assert.equal(result.done, 2); assert.equal(result.review, 1); assert.equal(result.rejected, 1); assert.equal(result.next?.source_id, "needs_correction");
});
test("aucune activité ne produit une réussite artificielle", () => {
  const result = personalDay([], {}); assert.equal(result.total, 0); assert.equal(result.next, undefined);
});
test("la journée utilise le fuseau de l’agenda serveur, même près de minuit", () => {
  assert.equal(parisDay(new Date("2026-09-07T22:30:00Z")), "2026-09-08");
});
test("les suggestions respectent le métier de la mission", () => {
  assert.ok(reportSuggestions("training").includes("Formation réalisée"));
  assert.ok(!reportSuggestions("merchandising").includes("Commande prise"));
});

test("une mission clôturée sans preuve de validation ne crée ni récompense ni fausse action", () => {
  const result = personalDay([event({ source_kind: "mission", status: "completed" })], {});
  assert.equal(result.done, 0); assert.equal(result.next, undefined);
});
