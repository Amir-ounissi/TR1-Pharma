import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncNaaliClientPharmacies } from "@/lib/integrations/hubspot/reconciliation";

export const dynamic = "force-dynamic";

const BRAND_ID = "996fa5c7-1b0d-42fd-8650-8ae79a2a7416";
const CONNECTION_ID = "2f2ef175-e853-4490-8b57-f9b5f1e51f1d";

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: connection, error: connectionError } = await admin
    .from("connector_connections")
    .select("configuration")
    .eq("id", CONNECTION_ID)
    .eq("brand_id", BRAND_ID)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();

  if (connectionError || !connection) {
    return NextResponse.json({ error: "HubSpot connection unavailable" }, { status: 503 });
  }

  const configuration = connection.configuration as Record<string, unknown> | null;
  const expectedNonce = configuration?.pharmacy_sync_nonce;
  const providedNonce = request.nextUrl.searchParams.get("nonce");
  if (typeof expectedNonce !== "string" || !providedNonce || providedNonce !== expectedNonce) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncNaaliClientPharmacies(BRAND_ID, CONNECTION_ID);
    const nextConfiguration = { ...(configuration ?? {}) };
    delete nextConfiguration.pharmacy_sync_nonce;
    const { error: clearError } = await admin
      .from("connector_connections")
      .update({ configuration: nextConfiguration })
      .eq("id", CONNECTION_ID);
    if (clearError) throw clearError;
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pharmacy sync error";
    return NextResponse.json({ ok: false, error: message.slice(0, 500) }, { status: 500 });
  }
}
