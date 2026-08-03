import { describe, expect, it } from "vitest";
import { canTransitionLead, leadCaptureSchema, leadDeduplicationScope, normalizeLeadInput, pilotPreparationSchema } from "./leads";

describe("marketing leads", () => {
  it("validates and normalizes public submissions", () => {
    expect(normalizeLeadInput({ fullName: "  Marie   Martin ", professionalEmail: "MARIE@EXAMPLE.COM", companyName: "  Nova   Santé ", website: "" })).toEqual({
      fullName: "Marie Martin",
      professionalEmail: "marie@example.com",
      companyName: "Nova Santé",
    });
    expect(leadCaptureSchema.safeParse({ fullName: "M", professionalEmail: "bad", companyName: "N" }).success).toBe(false);
  });

  it("controls lead transitions", () => {
    expect(canTransitionLead("new", "qualified")).toBe(true);
    expect(canTransitionLead("qualified", "new")).toBe(false);
    expect(canTransitionLead("won", "archived")).toBe(true);
  });

  it("builds a stable daily idempotence scope", () => {
    expect(leadDeduplicationScope(" MARIE@EXAMPLE.COM ", " Nova Santé ", "2026-08-03")).toBe("marie@example.com:nova santé:2026-08-03");
  });

  it("requires explicit pilot confirmation", () => {
    const base = { leadId: "00000000-0000-4000-8000-000000000001", proposedOrganizationName: "Nova Santé", proposedBrandName: "Nova", countryOrScope: "FR", estimatedUsers: "12", proposedStartDate: "2026-09-01" };
    expect(pilotPreparationSchema.safeParse({ ...base, confirmation: "true" }).success).toBe(true);
    expect(pilotPreparationSchema.safeParse(base).success).toBe(false);
  });
});
