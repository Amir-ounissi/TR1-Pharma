const rawBaseUrl = process.env.BASE_URL;
if (!rawBaseUrl) throw new Error("BASE_URL est obligatoire.");
const baseUrl = new URL(rawBaseUrl);
if (baseUrl.protocol !== "https:" && process.env.ALLOW_LOCAL_SMOKE !== "true") throw new Error("BASE_URL doit utiliser HTTPS pour un smoke test distant.");

const trustedOidcToken = process.env.VERCEL_TRUSTED_OIDC_TOKEN?.trim();
const protectionHeaders = trustedOidcToken
  ? {
      "x-vercel-trusted-oidc-idp-token": trustedOidcToken,
      "x-vercel-set-bypass-cookie": "true",
    }
  : {};

const routes = ["/", "/merci", "/connexion", "/signup", "/mentions-legales", "/politique-de-confidentialite", "/page-inexistante-smoke"];
for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl), { headers: protectionHeaders });
  const isNotFoundProbe = route === "/page-inexistante-smoke";
  const body = await response.text();
  if (isNotFoundProbe) {
    const rendersNotFound = response.status === 404 || /Page introuvable\./i.test(body);
    if (!rendersNotFound) throw new Error(`${route} ne rend pas la page 404 TR1 (HTTP ${response.status}).`);
  } else {
    if (response.status !== 200) {
      throw new Error(`${route} répond ${response.status}, attendu 200.`);
    }
    if (body.length < 100) throw new Error(`${route} retourne un contenu anormalement court.`);
  }
  console.log(`${route} : ${response.status}`);
}
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
if (!oauthLocation.includes(".supabase.co/auth/v1/authorize")) {
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
