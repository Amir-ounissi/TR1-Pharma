import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHubSpotOrderAfterPersistence } from "@/lib/integrations/hubspot/runtime";
import { syncNaaliHubSpotVisitAfterPersistence } from "@/lib/integrations/hubspot/naali-visit-runtime";

export const dynamic = "force-dynamic";

const BRAND_ID = "996fa5c7-1b0d-42fd-8650-8ae79a2a7416";
const CONNECTION_ID = "2f2ef175-e853-4490-8b57-f9b5f1e51f1d";
const ORDER_ID = "f1cae691-5e56-4bd5-b4bf-d069b71749f6";
const ORDER_USER_ID = "92e44bba-eb55-4306-839d-cb2f52d9567f";
const VISIT_ID = "334a7ce1-0135-442e-8876-79a7a9790d15";
const VISIT_USER_ID = "1258076e-a059-4e0d-ab81-d1d3e35ba4ea";
const HUBSPOT_OWNER_ID = "727665403";

async function replaceOwnerLink(
  admin: ReturnType<typeof createAdminClient>,
  tr1UserId: string,
) {
  const { error: deleteError } = await admin
    .from("connector_external_links")
    .delete()
    .eq("connection_id", CONNECTION_ID)
    .eq("entity_type", "users")
    .eq("external_id", HUBSPOT_OWNER_ID);
  if (deleteError) throw deleteError;

  const { error: saveError } = await admin.rpc("upsert_connector_external_link", {
    target_connection_id: CONNECTION_ID,
    target_entity_type: "users",
    target_external_id: HUBSPOT_OWNER_ID,
    target_tr1_record_id: tr1UserId,
    target_external_updated_at: null,
    target_tr1_updated_at: null,
    target_sync_hash: null,
  });
  if (saveError) throw saveError;
}

async function externalIdFor(
  admin: ReturnType<typeof createAdminClient>,
  entityType: "orders" | "visits",
  tr1RecordId: string,
) {
  const { data, error } = await admin
    .from("connector_external_links")
    .select("external_id")
    .eq("connection_id", CONNECTION_ID)
    .eq("entity_type", entityType)
    .eq("tr1_record_id", tr1RecordId)
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

  let orderExternalId: string | null = null;
  let visitExternalId: string | null = null;

  try {
    await replaceOwnerLink(admin, ORDER_USER_ID);
    await syncHubSpotOrderAfterPersistence(BRAND_ID, ORDER_ID);
    orderExternalId = await externalIdFor(admin, "orders", ORDER_ID);
  } finally {
    await replaceOwnerLink(admin, VISIT_USER_ID);
  }

  await syncNaaliHubSpotVisitAfterPersistence(BRAND_ID, VISIT_ID);
  visitExternalId = await externalIdFor(admin, "visits", VISIT_ID);

  const ok = Boolean(orderExternalId && visitExternalId);
  return NextResponse.json(
    { ok, orderId: ORDER_ID, orderExternalId, visitId: VISIT_ID, visitExternalId },
    { status: ok ? 200 : 500 },
  );
}
