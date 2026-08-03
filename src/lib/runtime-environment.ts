import { z } from "zod";

const environmentSchema = z.object({
  APP_ENV: z.enum(["local", "test", "staging", "production"]),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(16),
  SUPABASE_SECRET_KEY: z.string().min(16),
  NEXT_PUBLIC_APP_URL: z.url(),
  LEAD_CAPTURE_SALT: z.string().min(24),
  LEAD_CAPTURE_ENABLED: z.enum(["true", "false"]),
  BOOKING_URL: z.union([z.url(), z.literal("")]).optional(),
  NEXT_PUBLIC_ANALYTICS_PROVIDER: z.union([z.literal("dataLayer"), z.literal("")]).optional(),
});

export function readRuntimeEnvironment(environment: Record<string, string | undefined> = process.env) {
  const parsed = environmentSchema.parse({
    APP_ENV: environment.APP_ENV ?? (environment.NODE_ENV === "production" ? "production" : environment.NODE_ENV === "test" ? "test" : "local"),
    NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY: environment.SUPABASE_SECRET_KEY ?? environment.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: environment.NEXT_PUBLIC_APP_URL,
    LEAD_CAPTURE_SALT: environment.LEAD_CAPTURE_SALT,
    LEAD_CAPTURE_ENABLED: environment.LEAD_CAPTURE_ENABLED ?? "true",
    BOOKING_URL: environment.BOOKING_URL ?? "",
    NEXT_PUBLIC_ANALYTICS_PROVIDER: environment.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "",
  });

  if (parsed.APP_ENV === "staging" || parsed.APP_ENV === "production") {
    for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_URL", parsed.NEXT_PUBLIC_SUPABASE_URL], ["NEXT_PUBLIC_APP_URL", parsed.NEXT_PUBLIC_APP_URL], ["BOOKING_URL", parsed.BOOKING_URL]] as const) {
      if (value && new URL(value).protocol !== "https:") throw new Error(`${name} doit utiliser HTTPS en ${parsed.APP_ENV}.`);
      if (value && ["localhost", "127.0.0.1"].includes(new URL(value).hostname)) throw new Error(`${name} ne peut pas cibler localhost en ${parsed.APP_ENV}.`);
    }
  }

  return {
    ...parsed,
    leadCaptureEnabled: parsed.LEAD_CAPTURE_ENABLED === "true",
  };
}
