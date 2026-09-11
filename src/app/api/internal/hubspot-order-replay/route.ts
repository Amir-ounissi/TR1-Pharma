import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHubSpotOrderAfterPersistence } from "@/lib/integrations/hubspot/runtime";

export const dynamic = "force-dynamic";

const BRAND_ID = "996fa5c7-1b0d-42fd-8650-8ae79a2a7416";
const CONNECTION_ID = "2f2ef175-e853-4490-8b57-f9b5f1e51f1d";
const ORDER_ID = "7e8e189a-fdd7-4088-8a66-c432a2be49cf";

async function externalIdForOrder(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("connector_external_links")
    .select("external_id")
    .eq("connection_id", CONNECTION_ID)
    .eq("entity_type", "orders")
    .eq("tr1_record_id", ORDER_ID)
    .maybeSingle();
  if (error) throw error;
  return data?.external_id ? String(data.external_id) : null;
}

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
  const expectedNonce = configuration?.pilot_nonce;
  const providedNonce = request.nextUrl.searchParams.get("nonce");
  if (typeof expectedNonce !== "string" || !providedNonce || providedNonce !== expectedNonce) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingExternalId = await externalIdForOrder(admin);
  if (existingExternalId) {
    const nextConfiguration = { ...(configuration ?? {}) };
    delete nextConfiguration.pilot_nonce;
    await admin.from("connector_connections").update({ configuration: nextConfiguration }).eq("id", CONNECTION_ID);
    return NextResponse.json({ ok: true, alreadySynced: true, orderId: ORDER_ID, orderExternalId: existingExternalId });
  }

  await syncHubSpotOrderAfterPersistence(BRAND_ID, ORDER_ID);
  const orderExternalId = await externalIdForOrder(admin);
  if (!orderExternalId) {
    return NextResponse.json({ ok: false, error: "Order replay did not create a HubSpot link" }, { status: 500 });
  }

  const nextConfiguration = { ...(configuration ?? {}) };
  delete nextConfiguration.pilot_nonce;
  const { error: nonceClearError } = await admin
    .from("connector_connections")
    .update({ configuration: nextConfiguration })
    .eq("id", CONNECTION_ID);
  if (nonceClearError) throw nonceClearError;

  return NextResponse.json({ ok: true, alreadySynced: false, orderId: ORDER_ID, orderExternalId });
}
