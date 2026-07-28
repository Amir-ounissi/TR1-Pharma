const missingEnvironmentVariable = (name: string): never => {
  throw new Error(`Variable d'environnement manquante : ${name}`);
};

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url: url ?? missingEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey:
      publishableKey ??
      missingEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function getSecretSupabaseKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    missingEnvironmentVariable("SUPABASE_SECRET_KEY")
  );
}
