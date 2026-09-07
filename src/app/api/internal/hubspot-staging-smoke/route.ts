import { NextResponse } from "next/server";
import { syncHubSpotOrderAfterPersistence } from "@/lib/integrations/hubspot/runtime";

const BRAND_ID = "996fa5c7-1b0d-42fd-8650-8ae79a2a7416";
const ORDER_ID = "f1cae691-5e56-4bd5-b4bf-d069b71749f6";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  await syncHubSpotOrderAfterPersistence(BRAND_ID, ORDER_ID);
  return NextResponse.json({ ok: true });
}
