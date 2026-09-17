import { createClient } from "@supabase/supabase-js";

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the production auth check.`);
  return value;
}

if (process.env.APP_ENV !== "production") {
  console.log("Production auth guard: skipped outside production.");
  process.exit(0);
}

const supabase = createClient(
  requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnvironment("SUPABASE_SECRET_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const demoUsers = [];
const perPage = 1000;

for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
  if (error) throw error;

  const users = data.users ?? [];
  demoUsers.push(...users.filter((user) => user.email?.toLowerCase().endsWith(".local")));

  if (users.length < perPage) break;
}

if (demoUsers.length === 0) {
  console.log("Production auth guard: aucun compte de seed/demo .local détecté.");
  process.exit(0);
}

const now = Date.now();
const unbannedUsers = demoUsers.filter((user) => {
  const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : Number.NaN;
  return !Number.isFinite(bannedUntil) || bannedUntil <= now;
});

const demoUserIds = demoUsers.map((user) => user.id);
const { data: activeMemberships, error: membershipError } = await supabase
  .from("memberships")
  .select("user_id")
  .in("user_id", demoUserIds)
  .eq("status", "active");

if (membershipError) throw membershipError;

if (unbannedUsers.length > 0 || (activeMemberships?.length ?? 0) > 0) {
  console.error(
    `Production auth guard: comptes seed/demo exploitables détectés (non bannis: ${unbannedUsers.length}, memberships actifs: ${activeMemberships?.length ?? 0}). Release bloquée.`,
  );
  process.exit(1);
}

console.log(
  `Production auth guard: ${demoUsers.length} compte(s) seed/demo historique(s), tous bannis et sans membership actif.`,
);
