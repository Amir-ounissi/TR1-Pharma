import { describe, expect, it } from "vitest";
import { interactionPayloadSchema, taskPayloadSchema } from "./assistant-schemas";

describe("assistant schemas", () => {
  it("accepts a coherent interaction with a next action", () => {
    expect(interactionPayloadSchema.parse({
      interaction_type: "visit",
      outcome: "completed",
      subject: "Compte rendu",
      notes: "Intérêt pour DREAM.",
      occurred_at: "2026-07-27T10:00:00.000Z",
      next_action_type: "call",
      next_action_at: "2026-08-04T07:00:00.000Z",
    })).toBeTruthy();
  });

  it("rejects unknown fields, invalid enums and incomplete next actions", () => {
    expect(() => interactionPayloadSchema.parse({
      interaction_type: "sql",
      outcome: "completed",
      subject: "Compte rendu",
      notes: "Note",
      occurred_at: "2026-07-27T10:00:00.000Z",
      brand_id: "forged",
    })).toThrow();
    expect(() => interactionPayloadSchema.parse({
      interaction_type: "visit",
      outcome: "completed",
      subject: "Compte rendu",
      notes: "Note",
      occurred_at: "2026-07-27T10:00:00.000Z",
      next_action_type: "call",
    })).toThrow();
  });

  it("rejects oversized task notes and invalid dates", () => {
    expect(() => taskPayloadSchema.parse({
      task_type: "call",
      title: "Rappel",
      description: "x".repeat(1001),
      due_at: "jeudi",
    })).toThrow();
  });
});

