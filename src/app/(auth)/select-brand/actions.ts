"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BRAND_COOKIE, getBrandContexts } from "@/lib/auth";
import { canSelectBrand } from "@/lib/brand-context";

export async function selectBrandAction(formData: FormData) {
  const brandId = formData.get("brandId");
  const contexts = await getBrandContexts();
  if (!canSelectBrand(contexts, brandId)) {
    redirect("/select-brand?error=unauthorized");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRAND_COOKIE, brandId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/dashboard");
}
