import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return new NextResponse(null, { status: 404 });
  return NextResponse.json({
    productionKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    previewKeyConfigured: Boolean(process.env.OPEN_API_PREVIEW_KEY),
    importKeyConfigured: Boolean(process.env.OPENAI_API_KEY ?? process.env.OPEN_API_PREVIEW_KEY),
  });
}
