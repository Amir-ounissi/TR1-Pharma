import { requirePlatformAdmin } from "./auth";
import { groupPlatformUsers } from "./platform-admin";

export async function loadPlatformUsersPageData() {
  const { supabase } = await requirePlatformAdmin();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id,status,created_at,users(id,email,user_profiles(full_name)),roles(key,label),brands(id,name)")
    .order("created_at", { ascending: false });

  return groupPlatformUsers(memberships ?? []);
}
