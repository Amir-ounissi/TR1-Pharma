import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    modelConfigured: Boolean(process.env.OPENAI_PDF_ORDER_MODEL),
    appEnv: process.env.APP_ENV ?? null,
  });
}
