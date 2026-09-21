import { NextResponse } from "next/server";
import { ACTIVE_BRAND_COOKIE, requireUser } from "@/lib/auth";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const source = new URL(request.url);
  const brandId = source.searchParams.get("brand");

  let relationQuery = supabase
    .from("brand_pharmacies")
    .select("id,brand_id")
    .eq("pharmacy_id", id)
    .is("archived_at", null)
    .limit(1);

  if (brandId) relationQuery = relationQuery.eq("brand_id", brandId);

  const { data: relation } = await relationQuery.maybeSingle();
  const fallback = new URL("/dashboard/pharmacies", request.url);
  if (!relation) return NextResponse.redirect(fallback);

  const target = new URL(`/dashboard/pharmacies/${relation.id}`, request.url);
  const response = NextResponse.redirect(target);
  response.cookies.set(ACTIVE_BRAND_COOKIE, relation.brand_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
