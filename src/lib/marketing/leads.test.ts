import { describe, expect, it } from "vitest";
import { canTransitionLead, formatLeadRequest, leadCaptureSchema, leadDeduplicationScope, normalizeLeadInput, pilotPreparationSchema } from "./leads";

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

  it("separates the optional public website from the honeypot", () => {
    const base = { fullName: "Marie Martin", professionalEmail: "marie@example.com", companyName: "Nova Santé" };
    expect(leadCaptureSchema.safeParse({ ...base, websiteUrl: "https://example.com", website: "" }).success).toBe(true);
    expect(leadCaptureSchema.safeParse({ ...base, websiteUrl: "" }).success).toBe(true);
    expect(leadCaptureSchema.safeParse({ ...base, website: "spam" }).success).toBe(false);
    expect(leadCaptureSchema.safeParse({ ...base, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("requires a location only for pharmacies and keeps request details", () => {
    const base = { leadAudience: "pharmacy", fullName: "Marie Martin", professionalEmail: "marie@example.com", companyName: "Officine Exemple", need: "Former notre équipe" };
    expect(leadCaptureSchema.safeParse(base).success).toBe(false);
    const parsed = leadCaptureSchema.parse({ ...base, location: "  Istres  " });
    expect(formatLeadRequest(parsed)).toBe("Ville ou code postal : Istres\nBesoin exprimé : Former notre équipe");
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
