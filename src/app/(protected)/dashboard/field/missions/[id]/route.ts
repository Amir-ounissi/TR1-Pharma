import { NextResponse } from "next/server";
import { ACTIVE_BRAND_COOKIE, requireCompletedOnboarding } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, userId } = await requireCompletedOnboarding();
  const { data: mission } = await supabase
    .from("missions")
    .select("id,brand_id,status,mission_type")
    .eq("id", id)
    .eq("assigned_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();

  if (!mission) {
    return NextResponse.redirect(new URL("/dashboard/field", request.url));
  }

  const isAnimationIntake =
    mission.mission_type === "animation" && ["assigned", "accepted"].includes(mission.status);
  const destination = isAnimationIntake
    ? `/dashboard/missions/${mission.id}/animation-brief`
    : `/dashboard/missions/${mission.id}`;
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(ACTIVE_BRAND_COOKIE, mission.brand_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
