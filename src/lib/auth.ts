import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_BRAND_COOKIE = "tr1_active_brand";

export type BrandContext = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type BrandContextRow = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  role_key: string;
};

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  if (error || !subject) redirect("/login");
  return { supabase, userId: subject };
}

export async function getBrandContexts(): Promise<BrandContext[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_my_brand_contexts");

  if (error) throw error;

  return ((data ?? []) as BrandContextRow[]).map((context) => ({
    id: context.brand_id,
    name: context.brand_name,
    slug: context.brand_slug,
    role: context.role_key,
  }));
}

export async function requireActiveBrand() {
  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value;
  if (!activeBrandId) redirect("/select-brand");

  const { supabase, userId } = await requireUser();
  const [{ data: brand }, { data: profile }] = await Promise.all([
    supabase.from("brands").select("id,name,slug").eq("id", activeBrandId).maybeSingle(),
    supabase.from("user_profiles").select("full_name").eq("user_id", userId).maybeSingle(),
  ]);

  if (!profile?.full_name) redirect("/onboarding");
  if (!brand) redirect("/select-brand");

  return { supabase, userId, brand, profile };
}
