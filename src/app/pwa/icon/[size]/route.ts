import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const supportedSizes = new Set([180, 192, 512]);
let logoDataUriPromise: Promise<string> | null = null;

function getLogoDataUri() {
  if (!logoDataUriPromise) {
    logoDataUriPromise = readFile(
      path.join(process.cwd(), "public", "brand", "tr1-wordmark.webp"),
    ).then((buffer) => `data:image/webp;base64,${buffer.toString("base64")}`);
  }

  return logoDataUriPromise;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  const size = Number(rawSize);

  if (!supportedSizes.has(size)) {
    return new Response("Unsupported icon size", { status: 404 });
  }

  const logoDataUri = await getLogoDataUri();
  const inset = Math.round(size * 0.16);
  const logoBoxSize = size - inset * 2;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="TR1 Pharma">
  <rect width="${size}" height="${size}" fill="#f4f0e7"/>
  <image href="${logoDataUri}" x="${inset}" y="${inset}" width="${logoBoxSize}" height="${logoBoxSize}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

  return new Response(svg, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
