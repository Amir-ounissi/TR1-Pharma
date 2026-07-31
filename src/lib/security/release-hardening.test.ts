import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeLogContext } from "./log-sanitizer";

const rootFile = (path: string) => readFileSync(path, "utf8");

describe("release hardening", () => {
  it("keeps server secrets outside NEXT_PUBLIC variables", () => {
    const environment = rootFile(".env.example");
    expect(environment).not.toMatch(/^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE|TOKEN|PASSWORD|PRIVATE_KEY)=/m);
    expect(environment).toMatch(/^SUPABASE_SECRET_KEY=/m);
  });

  it("uses explicit fictitious values in the environment example", () => {
    const environment = rootFile(".env.example");
    expect(environment).toContain("replace-with-");
    expect(environment).not.toMatch(/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/);
  });

  it("keeps Next image optimization disabled", () => {
    expect(rootFile("next.config.ts")).toMatch(/images:\s*\{[\s\S]*?unoptimized:\s*true/);
  });

  it("redacts sensitive nested log context", () => {
    expect(sanitizeLogContext({
      import_job_id: "job-1",
      authorization: "Bearer private",
      nested: { signedUrl: "https://private", rows: 3 },
    })).toEqual({
      import_job_id: "job-1",
      authorization: "[REDACTED]",
      nested: { signedUrl: "[REDACTED]", rows: 3 },
    });
  });
});
