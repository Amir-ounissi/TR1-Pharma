import { createClient } from "@supabase/supabase-js";

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const password = requiredEnvironment("E2E_TEST_PASSWORD");

const url = new URL(supabaseUrl);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
  throw new Error(`Refusing to prepare E2E users against non-local Supabase host: ${url.hostname}`);
}

if (process.env.APP_ENV !== "test") {
  throw new Error("APP_ENV=test is required before preparing E2E users.");
}

const seedUserIds = [
  "00000000-0000-0000-0000-0000000000a1",
  "00000000-0000-0000-0000-0000000000a2",
  "00000000-0000-0000-0000-0000000000a3",
  "00000000-0000-0000-0000-0000000000a4",
  "00000000-0000-0000-0000-0000000000a5",
  "00000000-0000-0000-0000-0000000000a6",
  "00000000-0000-0000-0000-0000000000a7",
  "00000000-0000-0000-0000-0000000000a8",
];

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

for (const userId of seedUserIds) {
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) {
    throw new Error(`Failed to prepare E2E user ${userId}: ${error.message}`);
  }
}

console.log(`Prepared ${seedUserIds.length} local E2E users with an ephemeral runtime password.`);
