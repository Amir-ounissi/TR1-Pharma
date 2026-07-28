import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/integrations/whatsapp/whatsapp-security";
import { processWhatsAppMessage } from "@/lib/integrations/whatsapp/whatsapp-webhook";

const schema = z.object({
  providerMessageId: z.string().min(1).max(200),
  phone: z.string(),
  type: z.string().default("text"),
  text: z.string().max(1200).optional(),
});

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.WHATSAPP_SIMULATOR_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  try {
    const result = await processWhatsAppMessage({
      providerMessageId: parsed.data.providerMessageId,
      phone: normalizePhone(parsed.data.phone),
      type: parsed.data.type,
      text: parsed.data.text,
    }, process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Processing failed" }, { status: 422 });
  }
}

