const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_APP_URL",
  "LEAD_CAPTURE_SALT",
  "LEAD_CAPTURE_ENABLED",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Variables staging manquantes : ${missing.join(", ")}`);
  process.exit(1);
}
if (process.env.APP_ENV !== "staging") {
  console.error("APP_ENV=staging est obligatoire.");
  process.exit(1);
}
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_APP_URL", "BOOKING_URL"]) {
  const value = process.env[name];
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
console.log("Configuration staging : OK");
