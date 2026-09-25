import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileHubSpotOrdersNow } from "@/lib/integrations/hubspot/reconciliation";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const expected = process.env.TR1_INTERNAL_RECONCILE_TOKEN?.trim();
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || !provided) return false;

  const expectedDigest = createHash("sha256").update(expected).digest();
  const providedDigest = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production" || !authorized(request)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: brand, error: brandError } = await admin
    .from("brands")
    .select("id")
    .eq("slug", "naali")
    .limit(1)
    .maybeSingle();

  if (brandError || !brand?.id) {
    return NextResponse.json({ error: "naali_brand_unavailable" }, { status: 500 });
  }

  const { data: connection, error: connectionError } = await admin
    .from("connector_connections")
    .select("id")
    .eq("brand_id", brand.id)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (connectionError || !connection?.id) {
    return NextResponse.json({ error: "hubspot_connection_unavailable" }, { status: 500 });
  }

  try {
    const orders = await reconcileHubSpotOrdersNow(String(brand.id), String(connection.id));
    return NextResponse.json({ ok: true, summary: { orders } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error(`[hubspot] internal reconcile failed: ${message.slice(0, 500)}`);
    return NextResponse.json({ error: "reconcile_failed" }, { status: 500 });
  }
}
