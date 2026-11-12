import { NextResponse } from "next/server";

// Temporary, read-only investigation of images on the brand's official website.
// No user data, credentials, or dynamic URLs enter this endpoint.
export const dynamic = "force-dynamic";

const slugs = [
  "ashwagandha-ghee","bacopa-ghee","curcuma-ghee",
  "shatavari-ghee","shilajit-ghee","copie-de-shilajit-ghee",
] as const;

export async function GET() {
  const data = await Promise.all(slugs.map(async (slug) => {
    try {
      const response = await fetch("https://www.vk-swiss.ch/" + slug, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TR1-media-audit/1.0)" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();
      const files = Array.from(html.matchAll(/89c805_[a-f0-9]{20,}~mv2\.(?:jpg|jpeg|png|webp)/gi))
        .map((match) => ({
          key: match[0],
          context: html.slice(Math.max(0, match.index - 60), match.index + 300)
            .replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&"),
        }));
      const unique = [...new Map(files.map((image) => [image.key, image])).values()];
      const meta = [...html.matchAll(/<meta[^>]+(?:og:image|twitter:image)[^>]+>/gi)].slice(0,8).map(v=>v[0]);
      return { slug, status:response.status, htmlLength:html.length, files:unique.slice(0,60), meta };
    } catch (err) {
      return { slug, error:err instanceof Error ? err.message : String(err) };
    }
  }));
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
