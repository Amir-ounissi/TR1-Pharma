import { NextResponse } from "next/server";
import { ACTIVE_BRAND_COOKIE, requireUser } from "@/lib/auth";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: relation } = await supabase
    .from("brand_pharmacies")
    .select("id,brand_id")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  const fallback = new URL("/dashboard/pharmacies", request.url);
  if (!relation) return NextResponse.redirect(fallback);

  const source = new URL(request.url);
  const target = new URL(`/dashboard/pharmacies/${relation.id}`, request.url);
  const visit = source.searchParams.get("visit");
  if (visit) target.searchParams.set("visit", visit);

  const response = NextResponse.redirect(target);
  response.cookies.set(ACTIVE_BRAND_COOKIE, relation.brand_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
