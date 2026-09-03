import { describe, expect, it } from "vitest";
import { selectOnboardingSession } from "./select-onboarding-session";

const sessionA = { id: "session-a", brand_id: "brand-a" };
const sessionB = { id: "session-b", brand_id: "brand-b" };

describe("selectOnboardingSession", () => {
  it("selects no session when no brand is requested", () => {
    expect(selectOnboardingSession([sessionA, sessionB], undefined)).toBeNull();
  });

  it("selects the session matching an explicitly requested brand", () => {
    expect(selectOnboardingSession([sessionA, sessionB], "brand-b")).toBe(sessionB);
  });

  it("returns no session when the requested brand has no onboarding", () => {
    expect(selectOnboardingSession([sessionA], "brand-b")).toBeNull();
  });

  it("never falls back to another session for an explicit unknown brand", () => {
    expect(selectOnboardingSession([sessionA, sessionB], "brand-missing")).toBeNull();
  });
});
