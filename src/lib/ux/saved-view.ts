export type SavedView = {
  name: string;
  href: string;
  savedAt: string;
};

export function savedViewStorageKey(brandId: string, userId: string, viewId: string) {
  return `tr1:saved-view:${brandId}:${userId}:${viewId}`;
}

export function serializeSavedView(view: SavedView) {
  return JSON.stringify(view);
}

export function parseSavedView(value: string | null): SavedView | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SavedView>;
    if (typeof parsed.name !== "string" || typeof parsed.href !== "string" || !parsed.href.startsWith("/dashboard/") || typeof parsed.savedAt !== "string") return null;
    return { name: parsed.name, href: parsed.href, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}
