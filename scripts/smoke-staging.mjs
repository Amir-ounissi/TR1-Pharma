const rawBaseUrl = process.env.BASE_URL;
if (!rawBaseUrl) throw new Error("BASE_URL est obligatoire.");
const baseUrl = new URL(rawBaseUrl);
if (baseUrl.protocol !== "https:" && process.env.ALLOW_LOCAL_SMOKE !== "true") throw new Error("BASE_URL doit utiliser HTTPS pour un smoke test distant.");

const routes = ["/", "/merci", "/connexion", "/mentions-legales", "/politique-de-confidentialite", "/page-inexistante-smoke"];
for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl));
  const expected = route === "/page-inexistante-smoke" ? 404 : 200;
  if (response.status !== expected) throw new Error(`${route} répond ${response.status}, attendu ${expected}.`);
  const body = await response.text();
  if (body.length < 100) throw new Error(`${route} retourne un contenu anormalement court.`);
  console.log(`${route} : ${response.status}`);
}
console.log(`Smoke public réussi sur ${baseUrl.origin}`);
