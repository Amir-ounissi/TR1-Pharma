export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function draftKey(kind: "interaction" | "report", id: string) {
  return `tr1:draft:${kind}:${id}`;
}

export function saveDraft<T>(storage: DraftStorage, key: string, value: T) {
  storage.setItem(key, JSON.stringify({ value, savedAt: new Date().toISOString() }));
}

export function loadDraft<T>(storage: DraftStorage, key: string): T | null {
  const serialized = storage.getItem(key);
  if (!serialized) return null;
  try {
    return (JSON.parse(serialized) as { value: T }).value;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearDraft(storage: DraftStorage, key: string) {
  storage.removeItem(key);
}
