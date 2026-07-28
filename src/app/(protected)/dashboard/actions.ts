"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BRAND_COOKIE, requireUser } from "@/lib/auth";

export async function signOutAction() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BRAND_COOKIE);
  redirect("/login");
}

export async function changeBrandAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BRAND_COOKIE);
  redirect("/select-brand");
}
