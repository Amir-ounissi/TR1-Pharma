"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BRAND_COOKIE, isPlatformAdmin, requireUser } from "@/lib/auth";

export async function signOutAction() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  // Keep the non-sensitive active-brand preference so the next login can
  // reopen the last workspace without a forced context-selection step.
  redirect("/login");
}

export async function changeBrandAction() {
  redirect("/dashboard/account");
}

export async function returnToPlatformAdministrationAction() {
  if (!(await isPlatformAdmin())) {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BRAND_COOKIE);
  redirect("/dashboard");
}
