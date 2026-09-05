import { describe, expect, it } from "vitest";
import { buildSignupMetadata, getSignupSuccessMessage, signupIntentSchema } from "./signup-intent";

describe("signup intent", () => {
  it("accepts a brand signup request", () => {
    const parsed = signupIntentSchema.safeParse({
      fullName: "Alice Martin",
      email: "alice@vk-swiss.com",
      password: "password-123",
      confirmPassword: "password-123",
      profileType: "brand",
      companyName: "VK Swiss",
      jobTitle: "Directrice marketing",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(buildSignupMetadata(parsed.data).requested_access).toMatchObject({ type: "brand", company_name: "VK Swiss" });
    }
  });

  it("requires agent-specific fields", () => {
    const parsed = signupIntentSchema.safeParse({
      fullName: "Jean Dupont",
      email: "jean@example.com",
      password: "password-123",
      confirmPassword: "password-123",
      profileType: "agent",
      currentOrganization: "VK Swiss",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/secteur|zone/i);
    }
  });

  it("requires at least one facilitator activity", () => {
    const parsed = signupIntentSchema.safeParse({
      fullName: "Sonia Leroy",
      email: "sonia@example.com",
      password: "password-123",
      confirmPassword: "password-123",
      profileType: "facilitator",
      facilitatorActivities: [],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/activité/i);
    }
  });

  it("stores a single facilitator activity and keeps the legacy kind", () => {
    const parsed = signupIntentSchema.safeParse({
      fullName: "Sonia Leroy",
      email: "sonia@example.com",
      password: "password-123",
      confirmPassword: "password-123",
      profileType: "facilitator",
      facilitatorActivities: ["animation"],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(buildSignupMetadata(parsed.data).requested_access).toEqual({
        type: "facilitator",
        activities: ["animation"],
        facilitator_kind: "animateur",
      });
    }
  });

  it("stores animation and training on one facilitator request", () => {
    const parsed = signupIntentSchema.safeParse({
      fullName: "Sabrina Martin",
      email: "sabrina@example.com",
      password: "password-123",
      confirmPassword: "password-123",
      profileType: "facilitator",
      facilitatorActivities: ["training", "animation"],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(buildSignupMetadata(parsed.data).requested_access).toEqual({
        type: "facilitator",
        activities: ["animation", "training"],
        facilitator_kind: "mixte",
      });
    }
  });

  it("keeps legacy facilitator requests compatible", () => {
    const parsed = signupIntentSchema.safeParse({
      fullName: "Sonia Leroy",
      email: "sonia@example.com",
      password: "password-123",
      confirmPassword: "password-123",
      profileType: "facilitator",
      facilitatorKind: "formateur",
      specialty: "Formation officinale",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(buildSignupMetadata(parsed.data).requested_access).toEqual({
        type: "facilitator",
        activities: ["training"],
        facilitator_kind: "formateur",
        specialty: "Formation officinale",
      });
    }
  });

  it("rejects mismatched passwords", () => {
    const parsed = signupIntentSchema.safeParse({
      fullName: "Alice Martin",
      email: "alice@vk-swiss.com",
      password: "password-123",
      confirmPassword: "password-456",
      profileType: "brand",
      companyName: "VK Swiss",
      jobTitle: "Directrice marketing",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/correspondent pas/i);
    }
  });

  it("adapts the success message to the selected profile", () => {
    expect(getSignupSuccessMessage("brand")).toMatch(/accès marque/i);
    expect(getSignupSuccessMessage("agent")).toMatch(/pharmacies/i);
    expect(getSignupSuccessMessage("facilitator")).toMatch(/intervenant|activités/i);
  });
});
