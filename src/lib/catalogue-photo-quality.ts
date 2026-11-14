/**
 * Optimisation des photos de catalogue sans substitution entre références.
 * Les photos restent hébergées chez leurs titulaires ; vérifier les droits
 * d'utilisation commerciale des images externes avant mise en production.
 */
const officialPhotoHosts = new Set([
  "biodance.com",
  "www.biodance.com",
  "beautyofjoseon.com",
  "www.beautyofjoseon.com",
  "fr.beautyofjoseon.com",
  "doctoraltheaglobal.com",
  "www.doctoraltheaglobal.com",
]);

function hostnameOf(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Une galerie déjà rattachée à l'EAN peut proposer une photo officielle
 * plus nette. Ne jamais sélectionner un visuel par simple similarité de nom.
 */
export function preferredVerifiedPackshot(
  primary: string | null,
  eanMatchedGallery: readonly string[],
): string | null {
  const official = eanMatchedGallery.find((url) =>
    officialPhotoHosts.has(hostnameOf(url) ?? ""),
  );
  return official ?? primary ?? eanMatchedGallery[0] ?? null;
}

/**
 * Shopify héberge souvent des originaux HD. Ne change que le paramètre de
 * redimensionnement du CDN Shopify ; ne tente aucun upscale de bitmap.
 * 960px pour cartes, 320px pour liste, 1600px pour zoom et fiche.
 */
export function shopifyResponsivePhoto(url: string, requestedWidth: number): string {
  if (!Number.isSafeInteger(requestedWidth) || requestedWidth < 100 || requestedWidth > 2400) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" ||
      !(parsed.pathname.includes("/cdn/shop/") || parsed.hostname === "cdn.shopify.com")) return url;
    const existingWidth = Number(parsed.searchParams.get("width"));
    if (existingWidth >= requestedWidth) return url;
    parsed.searchParams.set("width", String(requestedWidth));
    return parsed.toString();
  } catch {
    return url;
  }
}
