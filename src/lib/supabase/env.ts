const missingEnvironmentVariable = (name: string): never => {
  throw new Error(`Variable d'environnement manquante : ${name}`);
};

function configuredEnvironmentVariable(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getPublicSupabaseEnv() {
  const url = configuredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey =
    configuredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    configuredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return {
    url: url ?? missingEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey:
      publishableKey ??
      missingEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function getSecretSupabaseKey() {
  const secretKey = configuredEnvironmentVariable("SUPABASE_SECRET_KEY");
  if (secretKey) return secretKey;

  const serviceRoleKey = configuredEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey) return serviceRoleKey;

  throw new Error(
    "Supabase admin credential unavailable at runtime: neither SUPABASE_SECRET_KEY nor SUPABASE_SERVICE_ROLE_KEY is configured",
  );
}
