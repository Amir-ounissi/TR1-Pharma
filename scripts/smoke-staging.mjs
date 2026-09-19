const rawBaseUrl = process.env.BASE_URL;
if (!rawBaseUrl) throw new Error("BASE_URL est obligatoire.");
const baseUrl = new URL(rawBaseUrl);
if (baseUrl.protocol !== "https:" && process.env.ALLOW_LOCAL_SMOKE !== "true") throw new Error("BASE_URL doit utiliser HTTPS pour un smoke test distant.");

const routes = ["/", "/merci", "/connexion", "/signup", "/mentions-legales", "/politique-de-confidentialite", "/page-inexistante-smoke"];
for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl));
  const isNotFoundProbe = route === "/page-inexistante-smoke";
  const body = await response.text();
  if (isNotFoundProbe) {
    const rendersNotFound = response.status === 404 || /Page introuvable\./i.test(body);
    if (!rendersNotFound) throw new Error(`${route} ne rend pas la page 404 TR1 (HTTP ${response.status}).`);
  } else if (response.status !== 200) {
    throw new Error(`${route} répond ${response.status}, attendu 200.`);
  }
  if (body.length < 100) throw new Error(`${route} retourne un contenu anormalement court.`);
  console.log(`${route} : ${response.status}`);
}
const recoveryResponse = await fetch(new URL("/api/auth/forgot-password", baseUrl), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: `staging-smoke-${Date.now()}@example.invalid` }),
});
if (recoveryResponse.status !== 200) {
  const body = await recoveryResponse.text();
  throw new Error(`/api/auth/forgot-password répond ${recoveryResponse.status}, attendu 200. Réponse: ${body.slice(0, 300)}`);
}
console.log("/api/auth/forgot-password : 200");

console.log(`Smoke public réussi sur ${baseUrl.origin}`);
