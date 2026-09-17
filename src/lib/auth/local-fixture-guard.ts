type RuntimeEnvironment = Record<string, string | undefined>;

export function isLocalFixtureEmail(email: string) {
  return email.trim().toLowerCase().endsWith(".local");
}

export function shouldBlockLocalFixtureAccount(
  email: string,
  environment: RuntimeEnvironment = process.env,
) {
  const isProduction = environment.VERCEL_ENV === "production"
    || environment.APP_ENV === "production";

  return isProduction && isLocalFixtureEmail(email);
}
