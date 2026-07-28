import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv, getSecretSupabaseKey } from "@/lib/supabase/env";

export function createAdminClient() {
  const { url } = getPublicSupabaseEnv();
  return createClient(url, getSecretSupabaseKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
