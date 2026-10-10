// Only preserve the fixed OAuth consent route across TR1 login.
// Never treat an arbitrary query-string value as a post-login destination.
export function oauthConsentReturn(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 350 ||
      !value.startsWith("/") || value.startsWith("//")) return null;
  let target: URL;
  try { target = new URL(value, "https://tr1.invalid"); } catch { return null; }
  if (target.origin !== "https://tr1.invalid" ||
      target.pathname !== "/oauth/consent" ||
      [...target.searchParams.keys()].some((key) => key !== "authorization_id")) return null;
  const id = target.searchParams.get("authorization_id");
  if (!id || !/^[A-Za-z0-9_-]{8,180}$/.test(id)) return null;
  return "/oauth/consent?authorization_id=" + encodeURIComponent(id);
}
