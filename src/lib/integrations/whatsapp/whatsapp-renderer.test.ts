import { describe, expect, it } from "vitest";
import { renderAssistantForWhatsApp } from "./whatsapp-renderer";

describe("WhatsApp renderer", () => {
  it("renders next visit with Waze and Maps fallback links", () => {
    const text = renderAssistantForWhatsApp({
      kind: "answer",
      message: "Visite",
      details: {
        pharmacy: "Pharmacie République",
        address: "10 place de la République, 75003 Paris",
        scheduledAt: "2026-07-31T09:00:00Z",
        objective: "Visite de suivi",
        wazeUrl: "https://waze.test",
        mapsUrl: "https://maps.test",
      },
    }, "https://tr1.test");
    expect(text).toContain("Pharmacie République");
    expect(text).toContain("Waze : https://waze.test");
    expect(text).toContain("Maps : https://maps.test");
  });

  it("renders pending draft and explicit confirmation choices", () => {
    const text = renderAssistantForWhatsApp({
      kind: "draft",
      message: "Prêt",
      pharmacy: {
        brand_pharmacy_id: "00000000-0000-0000-0000-000000000411",
        pharmacy_id: "00000000-0000-0000-0000-000000000401",
        pharmacy_name: "Pharmacie République",
        city: "Paris", postal_code: null, address_line_1: null, phone: null,
        commercial_status: "active", priority_level: "high", potential_level: "high", territory_id: null,
      },
      draft: {
        id: "10000000-0000-0000-0000-000000000801",
        organization_id: "00000000-0000-0000-0000-000000000002",
        brand_id: "00000000-0000-0000-0000-000000000101",
        user_id: "00000000-0000-0000-0000-0000000000a3",
        pharmacy_id: "00000000-0000-0000-0000-000000000401",
        brand_pharmacy_id: "00000000-0000-0000-0000-000000000411",
        action_type: "interaction_with_next_action",
        payload: { notes: "Intérêt DREAM.", next_action_at: "2026-08-04T07:00:00Z" },
        status: "pending", confidence: 0.9, created_at: "", updated_at: "", expires_at: "",
        confirmed_at: null, cancelled_at: null, executed_action_id: null, error_message: null,
      },
    }, "https://tr1.test");
    expect(text).toContain("Ce qui sera créé");
    expect(text).toContain("1 — Confirmer");
    expect(text).toContain("3 — Annuler");
    expect(text).toContain("https://tr1.test/dashboard/agent/assistant");
  });
});
