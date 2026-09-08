export type OfflineActionKind = "interaction";

export type OfflineAction = {
  id: string;
  kind: OfflineActionKind;
  createdAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  payload: Record<string, string | number | boolean | null>;
};

const storageKey = "tr1:offline-actions:v1";
const legacyStorageKey = "tr1:offline-actions";

function isOfflineAction(value: unknown): value is OfflineAction {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OfflineAction>;
  return candidate.kind === "interaction"
    && typeof candidate.id === "string"
    && typeof candidate.createdAt === "string"
    && Boolean(candidate.payload)
    && typeof candidate.payload === "object";
}

function normalize(value: unknown): OfflineAction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<OfflineAction>;
    if (candidate.kind !== "interaction" || typeof candidate.id !== "string" || typeof candidate.createdAt !== "string" || !candidate.payload) return [];
    return [{
      id: candidate.id,
      kind: "interaction" as const,
      createdAt: candidate.createdAt,
      attempts: Number(candidate.attempts ?? 0),
      lastAttemptAt: typeof candidate.lastAttemptAt === "string" ? candidate.lastAttemptAt : null,
      lastError: typeof candidate.lastError === "string" ? candidate.lastError : null,
      payload: candidate.payload as Record<string, string | number | boolean | null>,
    }];
  });
}

function write(storage: Storage, actions: OfflineAction[]) {
  if (actions.length) storage.setItem(storageKey, JSON.stringify(actions));
  else storage.removeItem(storageKey);
}

function read(storage: Storage): OfflineAction[] {
  try {
    const current = normalize(JSON.parse(storage.getItem(storageKey) ?? "[]"));
    if (current.length) return current;

    // Migration douce de la première version locale Codex. Seules les interactions
    // sont reprises car ce sont les seules actions disposant aujourd'hui d'un
    // contrat de synchronisation serveur complet.
    const legacy = normalize(JSON.parse(storage.getItem(legacyStorageKey) ?? "[]"));
    if (legacy.length) {
      write(storage, legacy);
      storage.removeItem(legacyStorageKey);
    }
    return legacy;
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(
  storage: Storage,
  action: { kind: OfflineActionKind; payload: OfflineAction["payload"] },
) {
  const item: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  };
  write(storage, [...read(storage), item]);
  return item;
}

export function listOfflineActions(storage: Storage) {
  return read(storage);
}

export function removeOfflineAction(storage: Storage, id: string) {
  write(storage, read(storage).filter((item) => item.id !== id));
}

export function clearOfflineActions(storage: Storage) {
  storage.removeItem(storageKey);
  storage.removeItem(legacyStorageKey);
}

export async function flushOfflineActions(
  storage: Storage,
  handler: (action: OfflineAction) => Promise<{ ok: boolean; error?: string }>,
) {
  const pending = read(storage);
  const remaining: OfflineAction[] = [];
  let completed = 0;

  for (const action of pending) {
    const attemptedAt = new Date().toISOString();
    try {
      const result = await handler(action);
      if (result.ok) {
        completed += 1;
        continue;
      }
      remaining.push({
        ...action,
        attempts: action.attempts + 1,
        lastAttemptAt: attemptedAt,
        lastError: result.error || "Synchronisation refusée",
      });
    } catch (error) {
      remaining.push({
        ...action,
        attempts: action.attempts + 1,
        lastAttemptAt: attemptedAt,
        lastError: error instanceof Error ? error.message : "Erreur de synchronisation",
      });
    }
  }

  write(storage, remaining);
  return {
    attempted: pending.length,
    completed,
    remaining: remaining.length,
  };
}
