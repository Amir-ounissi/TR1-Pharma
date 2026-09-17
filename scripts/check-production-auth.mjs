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

if (demoUsers.length > 0) {
  console.error(
    `Production auth guard: ${demoUsers.length} compte(s) de seed/demo en .local détecté(s). Release bloquée.`,
  );
  process.exit(1);
}

console.log("Production auth guard: aucun compte de seed/demo .local détecté.");
