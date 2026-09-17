import { createClient } from "@supabase/supabase-js";

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const localFixtureEmails = new Set([
  "superadmin@tr1.local",
  "admin@dermavita.local",
  "agent@dermavita.local",
  "admin@nutrilab.local",
  "animatrice@dermavita.local",
  "autre-animatrice@dermavita.local",
  "agent.sud@dermavita.local",
  "agent.ouest@dermavita.local",
]);

let page = 1;
const found = [];
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  const users = data?.users ?? [];
  found.push(...users.filter((user) => user.email && localFixtureEmails.has(user.email)));
  if (users.length < 1000) break;
  page += 1;
}

const now = Date.now();
const notBanned = found.filter((user) => !user.banned_until || Date.parse(user.banned_until) <= now);

const fixtureIds = found.map((user) => user.id);
let activeMemberships = [];
if (fixtureIds.length > 0) {
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id,status")
    .in("user_id", fixtureIds)
    .eq("status", "active");
  if (error) throw error;
  activeMemberships = data ?? [];
}

if (notBanned.length > 0 || activeMemberships.length > 0) {
  console.error(
    `Production safety check failed: ${notBanned.length} local fixture account(s) are not banned and ${activeMemberships.length} active membership(s) remain.`,
  );
  process.exit(1);
}

console.log(`Production seed-account check: OK (${found.length} fixture account(s), all disabled).`);
