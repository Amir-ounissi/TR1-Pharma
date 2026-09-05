const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "LEAD_CAPTURE_SALT",
  "LEAD_CAPTURE_ENABLED",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Variables staging manquantes : ${missing.join(", ")}`);
  process.exit(1);
}
if (!["staging", "production"].includes(process.env.APP_ENV)) {
  console.error("APP_ENV=staging ou APP_ENV=production est obligatoire.");
  process.exit(1);
}

function resolveAppUrl(environment = process.env) {
  if (environment.NEXT_PUBLIC_APP_URL) return environment.NEXT_PUBLIC_APP_URL;

  const vercelUrl = environment.VERCEL_ENV === "production"
    ? environment.VERCEL_PROJECT_PRODUCTION_URL || environment.VERCEL_URL
    : environment.VERCEL_ENV === "preview"
      ? environment.VERCEL_URL
      : undefined;

  if (vercelUrl) return vercelUrl.includes("://") ? vercelUrl : `https://${vercelUrl}`;
  return undefined;
}

const resolvedAppUrl = resolveAppUrl(process.env);
if (!resolvedAppUrl) {
  console.error("NEXT_PUBLIC_APP_URL ou une URL système Vercel exploitable est obligatoire.");
  process.exit(1);
}

for (const [name, value] of [
  ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
  ["NEXT_PUBLIC_APP_URL", resolvedAppUrl],
  ["BOOKING_URL", process.env.BOOKING_URL],
]) {
  if (!value) continue;
  const url = new URL(value);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) {
    console.error(`${name} doit être une URL HTTPS distante.`);
    process.exit(1);
  }
}
if ((process.env.LEAD_CAPTURE_SALT ?? "").length < 24) {
  console.error("LEAD_CAPTURE_SALT doit contenir au moins 24 caractères.");
  process.exit(1);
}
if (Object.keys(process.env).some((name) => /^NEXT_PUBLIC_.*(SECRET|SERVICE_ROLE|TOKEN|PASSWORD|PRIVATE_KEY)/.test(name))) {
  console.error("Un secret serveur est exposé avec le préfixe NEXT_PUBLIC_.");
  process.exit(1);
}
console.log(`Configuration ${process.env.APP_ENV} : OK`);
