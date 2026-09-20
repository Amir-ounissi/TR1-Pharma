const missingEnvironmentVariable = (name: string): never => {
  throw new Error(`Variable d'environnement manquante : ${name}`);
};

function configuredEnvironmentVariable(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getPublicSupabaseEnv() {
  // NEXT_PUBLIC_* values must be referenced statically so Next.js can inline them
  // into the browser bundle at build time.
  const url = configuredEnvironmentVariable(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey =
    configuredEnvironmentVariable(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    configuredEnvironmentVariable(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return {
    url: url ?? missingEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey:
      publishableKey ??
      missingEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function getSecretSupabaseKey() {
  const secretKey = configuredEnvironmentVariable(process.env.SUPABASE_SECRET_KEY);
  if (secretKey) return secretKey;

  const serviceRoleKey = configuredEnvironmentVariable(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (serviceRoleKey) return serviceRoleKey;

  throw new Error(
    "Supabase admin credential unavailable at runtime: neither SUPABASE_SECRET_KEY nor SUPABASE_SERVICE_ROLE_KEY is configured",
  );
}
