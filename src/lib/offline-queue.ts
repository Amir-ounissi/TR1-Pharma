export type OfflineActionKind = "interaction";

export type OfflineAction = {
  id: string;
  kind: OfflineActionKind;
  scope: string | null;
  createdAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  payload: Record<string, string | number | boolean | null>;
};

const storageKey = "tr1:offline-actions:v1";
const legacyStorageKey = "tr1:offline-actions";
const activeScopeKey = "tr1:pwa:active-scope:v1";

function normalize(value: unknown): OfflineAction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<OfflineAction>;
    if (candidate.kind !== "interaction" || typeof candidate.id !== "string" || typeof candidate.createdAt !== "string" || !candidate.payload) return [];
    return [{
      id: candidate.id,
      kind: "interaction" as const,
      scope: typeof candidate.scope === "string" ? candidate.scope : null,
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

function activeOfflineScope(storage: Storage) {
  try {
    const value = JSON.parse(storage.getItem(activeScopeKey) ?? "null") as { userId?: unknown; brandId?: unknown } | null;
    if (!value || typeof value.userId !== "string" || typeof value.brandId !== "string") return undefined;
    return `${value.brandId}:${value.userId}`;
  } catch {
    return undefined;
  }
}

function resolveScope(storage: Storage, scope?: string | null) {
  return scope ?? activeOfflineScope(storage);
}

function belongsToScope(action: OfflineAction, scope?: string) {
  if (!scope) return true;
  // Les actions créées avant l'introduction du scope sont adoptées une seule fois
  // par le contexte actif qui les rencontre, puis persistées avec ce scope en cas d'échec.
  return action.scope === null || action.scope === scope;
}

export function enqueueOfflineAction(
  storage: Storage,
  action: { kind: OfflineActionKind; scope?: string | null; payload: OfflineAction["payload"] },
) {
  const item: OfflineAction = {
    ...action,
    scope: resolveScope(storage, action.scope) ?? null,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  };
  write(storage, [...read(storage), item]);
  return item;
}

export function listOfflineActions(storage: Storage, scope?: string) {
  const resolvedScope = resolveScope(storage, scope);
  return read(storage).filter((action) => belongsToScope(action, resolvedScope));
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
  scope?: string,
) {
  const resolvedScope = resolveScope(storage, scope);
  const all = read(storage);
  const pending = all.filter((action) => belongsToScope(action, resolvedScope));
  const untouched = all.filter((action) => !belongsToScope(action, resolvedScope));
  const failed: OfflineAction[] = [];
  let completed = 0;

  for (const action of pending) {
    const attemptedAt = new Date().toISOString();
    try {
      const result = await handler(action);
      if (result.ok) {
        completed += 1;
        continue;
      }
      failed.push({
        ...action,
        scope: action.scope ?? resolvedScope ?? null,
        attempts: action.attempts + 1,
        lastAttemptAt: attemptedAt,
        lastError: result.error || "Synchronisation refusée",
      });
    } catch (error) {
      failed.push({
        ...action,
        scope: action.scope ?? resolvedScope ?? null,
        attempts: action.attempts + 1,
        lastAttemptAt: attemptedAt,
        lastError: error instanceof Error ? error.message : "Erreur de synchronisation",
      });
    }
  }

  write(storage, [...untouched, ...failed]);
  return {
    attempted: pending.length,
    completed,
    remaining: failed.length,
  };
}
