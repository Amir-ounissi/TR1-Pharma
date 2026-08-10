import { describe, expect, it } from "vitest";
import { readRuntimeEnvironment, resolveOnboardingRedirectUrl } from "./runtime-environment";

const valid = {
  APP_ENV: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-placeholder",
  SUPABASE_SECRET_KEY: "server-secret-placeholder",
  NEXT_PUBLIC_APP_URL: "https://staging.example.test",
  LEAD_CAPTURE_SALT: "a-random-placeholder-with-32-characters",
  LEAD_CAPTURE_ENABLED: "true",
};

describe("runtime environment", () => {
  it("accepts an isolated HTTPS staging configuration", () => {
    expect(readRuntimeEnvironment(valid).leadCaptureEnabled).toBe(true);
  });

  it("uses the explicit app URL when provided", () => {
    expect(readRuntimeEnvironment(valid).NEXT_PUBLIC_APP_URL).toBe("https://staging.example.test");
  });

  it("derives the preview app URL from VERCEL_URL", () => {
    expect(readRuntimeEnvironment({
      ...valid,
      NEXT_PUBLIC_APP_URL: undefined,
      VERCEL_ENV: "preview",
      VERCEL_URL: "tr1-preview-example.vercel.app",
    }).NEXT_PUBLIC_APP_URL).toBe("https://tr1-preview-example.vercel.app");
  });

  it("rejects localhost for staging", () => {
    expect(() => readRuntimeEnvironment({ ...valid, NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" })).toThrow(/HTTPS|localhost/);
  });

  it("rejects a production environment without an app URL", () => {
    expect(() => readRuntimeEnvironment({
      ...valid,
      APP_ENV: "production",
      NEXT_PUBLIC_APP_URL: undefined,
    })).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("rejects a staging environment without an app URL outside preview", () => {
    expect(() => readRuntimeEnvironment({
      ...valid,
      NEXT_PUBLIC_APP_URL: undefined,
      VERCEL_ENV: undefined,
      APP_ENV: "staging",
    })).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("rejects preview without VERCEL_URL when no explicit app URL exists", () => {
    expect(() => readRuntimeEnvironment({
      ...valid,
      NEXT_PUBLIC_APP_URL: undefined,
      VERCEL_ENV: "preview",
      VERCEL_URL: undefined,
    })).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("rejects missing server secrets", () => {
    expect(() => readRuntimeEnvironment({ ...valid, SUPABASE_SECRET_KEY: "" })).toThrow();
  });

  it("supports an explicit lead capture kill switch", () => {
    expect(readRuntimeEnvironment({ ...valid, LEAD_CAPTURE_ENABLED: "false" }).leadCaptureEnabled).toBe(false);
  });

  it("builds onboarding redirect URLs from the resolved preview URL", () => {
    expect(resolveOnboardingRedirectUrl({
      ...valid,
      NEXT_PUBLIC_APP_URL: undefined,
      VERCEL_ENV: "preview",
      VERCEL_URL: "tr1-preview-example.vercel.app",
    })).toBe("https://tr1-preview-example.vercel.app/auth/confirm?next=/onboarding");
  });
});
