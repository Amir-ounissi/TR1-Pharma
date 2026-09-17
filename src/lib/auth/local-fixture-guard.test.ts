import { describe, expect, it } from "vitest";
import { isLocalFixtureEmail, shouldBlockLocalFixtureAccount } from "./local-fixture-guard";

describe("local fixture account guard", () => {
  it("identifies local fixture email addresses case-insensitively", () => {
    expect(isLocalFixtureEmail("agent@dermavita.local")).toBe(true);
    expect(isLocalFixtureEmail(" Agent@Dermavita.Local ")).toBe(true);
    expect(isLocalFixtureEmail("agent@example.com")).toBe(false);
  });

  it("blocks local fixture accounts in production", () => {
    expect(shouldBlockLocalFixtureAccount("agent@dermavita.local", { VERCEL_ENV: "production" })).toBe(true);
    expect(shouldBlockLocalFixtureAccount("agent@dermavita.local", { APP_ENV: "production" })).toBe(true);
  });

  it("keeps local fixtures available for local tests and previews", () => {
    expect(shouldBlockLocalFixtureAccount("agent@dermavita.local", { APP_ENV: "test" })).toBe(false);
    expect(shouldBlockLocalFixtureAccount("agent@dermavita.local", { VERCEL_ENV: "preview" })).toBe(false);
  });

  it("does not block normal production accounts", () => {
    expect(shouldBlockLocalFixtureAccount("agent@example.com", { VERCEL_ENV: "production" })).toBe(false);
  });
});
