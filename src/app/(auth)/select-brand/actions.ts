"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BRAND_COOKIE, getBrandContexts, isPlatformAdmin } from "@/lib/auth";
import { canSelectBrand } from "@/lib/brand-context";
import { getRoleLandingPath } from "@/lib/ux/navigation";

const brandCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function selectBrandAction(formData: FormData) {
  const brandId = formData.get("brandId");
  const contexts = await getBrandContexts();
  if (!canSelectBrand(contexts, brandId)) {
    redirect("/select-brand?error=unauthorized");
  }
  const selectedContext = contexts.find((context) => context.id === brandId);
  if (!selectedContext) {
    redirect("/select-brand?error=unauthorized");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRAND_COOKIE, brandId, brandCookieOptions);
  redirect(getRoleLandingPath(selectedContext.role));
}

export async function selectPlatformViewAction() {
  if (!(await isPlatformAdmin())) {
    redirect("/select-brand?error=unauthorized");
  }

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BRAND_COOKIE);
  redirect("/dashboard");
}
