import { after, NextRequest, NextResponse } from "next/server";
import { getWhatsAppConfig } from "@/lib/integrations/whatsapp/whatsapp-config";
import { parseWhatsAppPayload } from "@/lib/integrations/whatsapp/whatsapp-parser";
import { verifyWhatsAppSignature } from "@/lib/integrations/whatsapp/whatsapp-security";
import { processWhatsAppMessage } from "@/lib/integrations/whatsapp/whatsapp-webhook";

export async function GET(request: NextRequest) {
  const config = getWhatsAppConfig();
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (config.enabled && mode === "subscribe" && token === config.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification refused" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const config = getWhatsAppConfig();
  if (!config.enabled) return NextResponse.json({ error: "WhatsApp disabled" }, { status: 503 });
  const rawBody = await request.text();
  if (rawBody.length > 64_000 || !verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), config.WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }
  let messages;
  try { messages = parseWhatsAppPayload(JSON.parse(rawBody)); }
  catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  after(async () => {
    await Promise.allSettled(messages.map((message) => processWhatsAppMessage(message, appUrl)));
  });
  return NextResponse.json({ received: true });
}

