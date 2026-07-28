import { describe, expect, it, vi } from "vitest";
import { createAssistantEngine } from "./assistant-engine";

const pharmacy = {
  brand_pharmacy_id: "00000000-0000-0000-0000-000000000411",
  pharmacy_id: "00000000-0000-0000-0000-000000000401",
  pharmacy_name: "Pharmacie République",
  city: "Paris",
  postal_code: "75003",
  address_line_1: "10 place de la République",
  phone: "0142000001",
  commercial_status: "active",
  priority_level: "strategic",
  potential_level: "very_high",
  territory_id: "00000000-0000-0000-0000-000000000201",
};

function draft(payload: Record<string, unknown>, actionType = "interaction_with_next_action") {
  return {
    id: "10000000-0000-0000-0000-000000000001",
    organization_id: "00000000-0000-0000-0000-000000000002",
    brand_id: "00000000-0000-0000-0000-000000000101",
    user_id: "00000000-0000-0000-0000-0000000000a3",
    pharmacy_id: pharmacy.pharmacy_id,
    brand_pharmacy_id: pharmacy.brand_pharmacy_id,
    action_type: actionType,
    payload,
    status: "pending",
    confidence: 0.96,
    created_at: "2026-07-27T08:00:00Z",
    updated_at: "2026-07-27T08:00:00Z",
    expires_at: "2026-07-27T08:30:00Z",
    confirmed_at: null,
    cancelled_at: null,
    executed_action_id: null,
    error_message: null,
  };
}

function tools(overrides: Record<string, unknown> = {}) {
  return {
    searchPharmacies: vi.fn().mockResolvedValue([pharmacy]),
    getPharmacySummary: vi.fn().mockResolvedValue({
      brand_pharmacy_id: pharmacy.brand_pharmacy_id,
      pharmacy_id: pharmacy.pharmacy_id,
      name: pharmacy.pharmacy_name,
      address: "10 place de la République, 75003 Paris",
      status: "active",
      potential: "very_high",
    }),
    getNextVisit: vi.fn().mockResolvedValue({
      brand_pharmacy_id: pharmacy.brand_pharmacy_id,
      pharmacy_id: pharmacy.pharmacy_id,
      name: pharmacy.pharmacy_name,
      address: "10 place de la République, 75003 Paris",
      scheduled_at: "2026-07-31T08:00:00Z",
      objective: "Présenter DREAM",
      latitude: 48.86,
      longitude: 2.36,
    }),
    getTodayAgenda: vi.fn().mockResolvedValue({ tasks: [] }),
    getRecentInteractions: vi.fn().mockResolvedValue([]),
    createDraft: vi.fn().mockImplementation((parameters) => draft(parameters.target_payload as Record<string, unknown>, String(parameters.target_action_type))),
    setContext: vi.fn().mockResolvedValue({}),
    getContext: vi.fn().mockResolvedValue(null),
    recordAudit: vi.fn().mockResolvedValue(1),
    trackEvent: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

const baseInput = {
  brandId: "00000000-0000-0000-0000-000000000101",
  timezone: "Europe/Paris",
  now: new Date("2026-07-27T08:00:00Z"),
};

describe("assistant engine", () => {
  it("reads the next authorized visit without creating a draft", async () => {
    const dependencies = tools();
    const response = await createAssistantEngine(dependencies).process({ ...baseInput, message: "Quelle est ma prochaine visite ?" });
    expect(response.kind).toBe("answer");
    expect(dependencies.createDraft).not.toHaveBeenCalled();
    expect(dependencies.setContext).toHaveBeenCalledWith(expect.objectContaining({ target_brand_pharmacy_id: pharmacy.brand_pharmacy_id }));
  });

  it("prepares an interaction and explicit next action from active context", async () => {
    const dependencies = tools({
      getContext: vi.fn().mockResolvedValue({ active_brand_pharmacy_id: pharmacy.brand_pharmacy_id }),
    });
    const response = await createAssistantEngine(dependencies).process({
      ...baseInput,
      message: "Visite terminée. Intérêt pour DREAM. La rappeler mardi prochain.",
    });
    expect(response.kind).toBe("draft");
    expect(dependencies.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      target_action_type: "interaction_with_next_action",
      target_payload: expect.objectContaining({
        notes: "Intérêt pour DREAM.",
        next_action_at: "2026-08-04T07:00:00.000Z",
      }),
    }));
  });

  it("resolves a unique pharmacy before preparing a task", async () => {
    const dependencies = tools();
    const response = await createAssistantEngine(dependencies).process({
      ...baseInput,
      message: "Rappelle-moi de contacter la Pharmacie République jeudi",
    });
    expect(response.kind).toBe("draft");
    expect(dependencies.searchPharmacies).toHaveBeenCalledWith(baseInput.brandId, "Pharmacie République");
  });

  it("requires explicit selection when a pharmacy name is ambiguous", async () => {
    const second = { ...pharmacy, brand_pharmacy_id: "00000000-0000-0000-0000-000000000419", city: "Lyon" };
    const dependencies = tools({ searchPharmacies: vi.fn().mockResolvedValue([pharmacy, second]) });
    const response = await createAssistantEngine(dependencies).process({
      ...baseInput,
      message: "Ajoute une note sur Pharmacie du Centre",
    });
    expect(response.kind).toBe("disambiguation");
    expect(dependencies.createDraft).not.toHaveBeenCalled();
  });

  it("does not expose whether an unauthorized pharmacy exists", async () => {
    const dependencies = tools({ searchPharmacies: vi.fn().mockResolvedValue([]) });
    const response = await createAssistantEngine(dependencies).process({
      ...baseInput,
      message: "Résume-moi la Pharmacie Interdite",
    });
    expect(response).toEqual({ kind: "clarification", message: "Je ne trouve pas cette pharmacie dans votre périmètre autorisé." });
  });

  it("asks for clarification at medium and low confidence", async () => {
    const dependencies = tools();
    const medium = await createAssistantEngine(dependencies).process({ ...baseInput, message: "Ajoute un rappel" });
    const low = await createAssistantEngine(dependencies).process({ ...baseInput, message: "Fais le nécessaire" });
    expect(medium.kind).toBe("clarification");
    expect(low.kind).toBe("clarification");
    expect(dependencies.createDraft).not.toHaveBeenCalled();
  });
});

