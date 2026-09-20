const rawBaseUrl = process.env.BASE_URL;
if (!rawBaseUrl) throw new Error("BASE_URL est obligatoire.");
const baseUrl = new URL(rawBaseUrl);
if (baseUrl.protocol !== "https:" && process.env.ALLOW_LOCAL_SMOKE !== "true") throw new Error("BASE_URL doit utiliser HTTPS pour un smoke test distant.");

const expectedAppEnv =
  process.env.EXPECTED_APP_ENV?.trim() ||
  (process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim()
    ? "production"
    : process.env.STAGING_SUPABASE_PROJECT_REF?.trim()
      ? "staging"
      : undefined);
const expectedSupabaseProjectRef =
  process.env.EXPECTED_SUPABASE_PROJECT_REF?.trim() ||
  process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() ||
  process.env.STAGING_SUPABASE_PROJECT_REF?.trim();

const trustedOidcToken = process.env.VERCEL_TRUSTED_OIDC_TOKEN?.trim();
const protectionHeaders = trustedOidcToken
  ? {
      "x-vercel-trusted-oidc-idp-token": trustedOidcToken,
      "x-vercel-set-bypass-cookie": "true",
    }
  : {};

const routes = ["/", "/merci", "/signup", "/mentions-legales", "/politique-de-confidentialite"];
for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl), { headers: protectionHeaders });
  const body = await response.text();
  if (response.status !== 200) {
    throw new Error(`${route} répond ${response.status}, attendu 200.`);
  }
  if (body.length < 100) throw new Error(`${route} retourne un contenu anormalement court.`);
  console.log(`${route} : ${response.status}`);
}

const connexionResponse = await fetch(new URL("/connexion", baseUrl), {
  headers: protectionHeaders,
  redirect: "manual",
});
if (![302, 303, 307, 308].includes(connexionResponse.status)) {
  const body = await connexionResponse.text();
  throw new Error(`/connexion répond ${connexionResponse.status}, attendu une redirection vers /login. Réponse: ${body.slice(0, 300)}`);
}
const connexionLocation = connexionResponse.headers.get("location") ?? "";
const expectedLoginUrl = new URL("/login", baseUrl).toString();
if (connexionLocation !== "/login" && connexionLocation !== expectedLoginUrl) {
  throw new Error(`/connexion redirige vers une cible inattendue: ${connexionLocation || "(vide)"}.`);
}
console.log(`/connexion : ${connexionResponse.status} vers /login`);

const healthResponse = await fetch(new URL("/api/release-health", baseUrl), {
  headers: protectionHeaders,
  cache: "no-store",
});
if (healthResponse.status !== 200) {
  const body = await healthResponse.text();
  throw new Error(`/api/release-health répond ${healthResponse.status}, attendu 200. Réponse: ${body.slice(0, 300)}`);
}
const health = await healthResponse.json();
if (health?.ok !== true || health?.service !== "tr1-pharma") {
  throw new Error(`/api/release-health retourne une preuve invalide: ${JSON.stringify(health).slice(0, 300)}`);
}
if (expectedAppEnv && health?.appEnv !== expectedAppEnv) {
  throw new Error(`/api/release-health appEnv=${JSON.stringify(health?.appEnv)}, attendu ${expectedAppEnv}.`);
}
if (expectedSupabaseProjectRef && health?.supabaseProjectRef !== expectedSupabaseProjectRef) {
  throw new Error(
    `/api/release-health supabaseProjectRef=${JSON.stringify(health?.supabaseProjectRef)}, attendu ${expectedSupabaseProjectRef}.`,
  );
}
console.log("/api/release-health : 200");
const recoveryResponse = await fetch(new URL("/api/auth/forgot-password", baseUrl), {
  method: "POST",
  headers: { ...protectionHeaders, "Content-Type": "application/json" },
  body: JSON.stringify({ email: `staging-smoke-${Date.now()}@example.invalid` }),
});
if (recoveryResponse.status !== 200) {
  const body = await recoveryResponse.text();
  throw new Error(`/api/auth/forgot-password répond ${recoveryResponse.status}, attendu 200. Réponse: ${body.slice(0, 300)}`);
}
console.log("/api/auth/forgot-password : 200");

const oauthResponse = await fetch(new URL("/api/auth/google", baseUrl), {
  headers: protectionHeaders,
  redirect: "manual",
});
if (![302, 303, 307, 308].includes(oauthResponse.status)) {
  const body = await oauthResponse.text();
  throw new Error(`/api/auth/google répond ${oauthResponse.status}, attendu une redirection OAuth. Réponse: ${body.slice(0, 300)}`);
}
const oauthLocation = oauthResponse.headers.get("location") ?? "";
const expectedOauthPrefix = expectedSupabaseProjectRef
  ? `https://${expectedSupabaseProjectRef}.supabase.co/auth/v1/authorize`
  : ".supabase.co/auth/v1/authorize";
if (
  expectedSupabaseProjectRef
    ? !oauthLocation.startsWith(expectedOauthPrefix)
    : !oauthLocation.includes(expectedOauthPrefix)
) {
  throw new Error(`/api/auth/google redirige vers une cible inattendue: ${oauthLocation || "(vide)"}.`);
}
console.log(`/api/auth/google : ${oauthResponse.status}`);

const agentResponse = await fetch(new URL("/dashboard/agent", baseUrl), {
  headers: protectionHeaders,
  redirect: "manual",
});
if (![302, 303, 307, 308].includes(agentResponse.status)) {
  const body = await agentResponse.text();
  throw new Error(`/dashboard/agent répond ${agentResponse.status}, attendu une redirection anonyme. Réponse: ${body.slice(0, 300)}`);
}
console.log(`/dashboard/agent : ${agentResponse.status}`);

console.log(`Smoke public réussi sur ${baseUrl.origin}`);
