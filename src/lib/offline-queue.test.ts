import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOfflineActions,
  enqueueOfflineAction,
  flushOfflineActions,
  listOfflineActions,
  removeOfflineAction,
} from "./offline-queue";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as unknown as Storage;
}

describe("offline interaction queue", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" });
  });

  it("stores and removes a terrain interaction", () => {
    const target = storage();
    const action = enqueueOfflineAction(target, {
      kind: "interaction",
      payload: { note: "Stock à surveiller" },
    });

    expect(listOfflineActions(target)).toHaveLength(1);
    removeOfflineAction(target, action.id);
    expect(listOfflineActions(target)).toEqual([]);
  });

  it("clears all pending actions", () => {
    const target = storage();
    enqueueOfflineAction(target, { kind: "interaction", payload: { note: "A" } });
    clearOfflineActions(target);
    expect(listOfflineActions(target)).toEqual([]);
  });

  it("keeps a failed action with retry diagnostics", async () => {
    const target = storage();
    enqueueOfflineAction(target, { kind: "interaction", payload: { note: "A" } });

    const result = await flushOfflineActions(target, async () => ({ ok: false, error: "network" }));

    expect(result).toEqual({ attempted: 1, completed: 0, remaining: 1 });
    expect(listOfflineActions(target)[0]).toMatchObject({ attempts: 1, lastError: "network" });
  });

  it("removes only actions accepted by the server", async () => {
    const target = storage();
    const first = enqueueOfflineAction(target, { kind: "interaction", payload: { note: "A" } });
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000002" });
    enqueueOfflineAction(target, { kind: "interaction", payload: { note: "B" } });

    const result = await flushOfflineActions(target, async (action) => ({ ok: action.id === first.id }));

    expect(result).toEqual({ attempted: 2, completed: 1, remaining: 1 });
    expect(listOfflineActions(target)).toHaveLength(1);
    expect(listOfflineActions(target)[0].payload.note).toBe("B");
  });

  it("only exposes and flushes actions from the active user and brand scope", async () => {
    const target = storage();
    target.setItem("tr1:pwa:active-scope:v1", JSON.stringify({ userId: "user-1", brandId: "brand-1" }));
    const first = enqueueOfflineAction(target, { kind: "interaction", payload: { note: "Brand 1" } });

    target.setItem("tr1:pwa:active-scope:v1", JSON.stringify({ userId: "user-1", brandId: "brand-2" }));
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000002" });
    const second = enqueueOfflineAction(target, { kind: "interaction", payload: { note: "Brand 2" } });

    expect(first.scope).toBe("brand-1:user-1");
    expect(second.scope).toBe("brand-2:user-1");
    expect(listOfflineActions(target).map((action) => action.id)).toEqual([second.id]);

    const result = await flushOfflineActions(target, async () => ({ ok: true }));
    expect(result).toEqual({ attempted: 1, completed: 1, remaining: 0 });

    target.setItem("tr1:pwa:active-scope:v1", JSON.stringify({ userId: "user-1", brandId: "brand-1" }));
    expect(listOfflineActions(target).map((action) => action.id)).toEqual([first.id]);
  });
});
