import { describe, expect, it } from "vitest";
import { readRuntimeEnvironment } from "./runtime-environment";

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

  it("rejects localhost for staging", () => {
    expect(() => readRuntimeEnvironment({ ...valid, NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" })).toThrow(/HTTPS|localhost/);
  });

  it("rejects missing server secrets", () => {
    expect(() => readRuntimeEnvironment({ ...valid, SUPABASE_SECRET_KEY: "" })).toThrow();
  });

  it("supports an explicit lead capture kill switch", () => {
    expect(readRuntimeEnvironment({ ...valid, LEAD_CAPTURE_ENABLED: "false" }).leadCaptureEnabled).toBe(false);
  });
});
