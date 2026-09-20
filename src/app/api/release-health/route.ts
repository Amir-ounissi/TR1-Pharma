import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, service: "tr1-pharma" },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
