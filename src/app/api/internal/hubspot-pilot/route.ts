import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHubSpotOrderAfterPersistence } from "@/lib/integrations/hubspot/runtime";
import { syncNaaliHubSpotVisitAfterPersistence } from "@/lib/integrations/hubspot/naali-visit-runtime";

export const dynamic = "force-dynamic";

const BRAND_ID = "996fa5c7-1b0d-42fd-8650-8ae79a2a7416";
const CONNECTION_ID = "2f2ef175-e853-4490-8b57-f9b5f1e51f1d";
const ORDER_ID = "f1cae691-5e56-4bd5-b4bf-d069b71749f6";
const VISIT_ID = "334a7ce1-0135-442e-8876-79a7a9790d15";
const VISIT_PHARMACY_ID = "b3500d9b-e374-4475-a56b-88642db157e3";
const VISIT_USER_ID = "1258076e-a059-4e0d-ab81-d1d3e35ba4ea";
const HUBSPOT_COMPANY_ID = "47151117529";
const HUBSPOT_OWNER_ID = "727665403";

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

  const linkInputs = [
    {
      entityType: "pharmacies",
      externalId: HUBSPOT_COMPANY_ID,
      tr1RecordId: VISIT_PHARMACY_ID,
    },
    {
      entityType: "users",
      externalId: HUBSPOT_OWNER_ID,
      tr1RecordId: VISIT_USER_ID,
    },
  ] as const;

  for (const link of linkInputs) {
    const { error } = await admin.rpc("upsert_connector_external_link", {
      target_connection_id: CONNECTION_ID,
      target_entity_type: link.entityType,
      target_external_id: link.externalId,
      target_tr1_record_id: link.tr1RecordId,
      target_external_updated_at: null,
      target_tr1_updated_at: null,
      target_sync_hash: null,
    });
    if (error) {
      return NextResponse.json({ error: `Mapping failed: ${link.entityType}` }, { status: 500 });
    }
  }

  await syncHubSpotOrderAfterPersistence(BRAND_ID, ORDER_ID);
  await syncNaaliHubSpotVisitAfterPersistence(BRAND_ID, VISIT_ID);

  return NextResponse.json({
    ok: true,
    orderId: ORDER_ID,
    visitId: VISIT_ID,
  });
}
