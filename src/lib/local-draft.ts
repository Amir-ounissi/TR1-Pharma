export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type DraftEnvelope<T> = {
  value: T;
  savedAt: string;
  expiresAt?: string;
  contextKey?: string;
};

type DraftOptions = {
  ttlHours?: number;
  contextKey?: string;
};

export function draftKey(kind: "interaction" | "report", id: string) {
  return `tr1:draft:${kind}:${id}`;
}

export function saveDraft<T>(storage: DraftStorage, key: string, value: T, options: DraftOptions = {}) {
  const now = new Date();
  const envelope: DraftEnvelope<T> = {
    value,
    savedAt: now.toISOString(),
    expiresAt: options.ttlHours ? new Date(now.getTime() + options.ttlHours * 3_600_000).toISOString() : undefined,
    contextKey: options.contextKey,
  };
  storage.setItem(key, JSON.stringify(envelope));
}

export function loadDraft<T>(storage: DraftStorage, key: string, options: Pick<DraftOptions, "contextKey"> = {}): T | null {
  const serialized = storage.getItem(key);
  if (!serialized) return null;
  try {
    const payload = JSON.parse(serialized) as DraftEnvelope<T>;
    if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
      storage.removeItem(key);
      return null;
    }
    if (options.contextKey && payload.contextKey && payload.contextKey !== options.contextKey) {
      storage.removeItem(key);
      return null;
    }
    return payload.value;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearDraft(storage: DraftStorage, key: string) {
  storage.removeItem(key);
}
