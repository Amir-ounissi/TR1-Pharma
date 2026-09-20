import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function supabaseProjectRef() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) return null;

  try {
    const host = new URL(rawUrl).hostname;
    return host.endsWith(".supabase.co") ? host.slice(0, -".supabase.co".length) : null;
  } catch {
    return null;
  }
}

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "tr1-pharma",
      appEnv: process.env.APP_ENV?.trim() || null,
      supabaseProjectRef: supabaseProjectRef(),
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
