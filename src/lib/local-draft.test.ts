import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDraft, draftKey, loadDraft, saveDraft } from "./local-draft";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("local drafts", () => {
  afterEach(() => vi.useRealTimers());

  it("saves, restores and clears an interaction", () => {
    const storage = memoryStorage();
    const key = draftKey("interaction", "pharmacy-a");
    saveDraft(storage, key, { note: "À rappeler" });
    expect(loadDraft(storage, key)).toEqual({ note: "À rappeler" });
    clearDraft(storage, key);
    expect(loadDraft(storage, key)).toBeNull();
  });

  it("removes corrupted drafts", () => {
    const storage = memoryStorage();
    storage.setItem("bad", "{");
    expect(loadDraft(storage, "bad")).toBeNull();
  });

  it("expires obsolete drafts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T10:00:00Z"));
    const storage = memoryStorage();
    saveDraft(storage, "expiring", { note: "Temporaire" }, { ttlHours: 1 });
    vi.setSystemTime(new Date("2026-08-08T11:30:00Z"));
    expect(loadDraft(storage, "expiring")).toBeNull();
  });

  it("clears drafts when user or brand context changes", () => {
    const storage = memoryStorage();
    saveDraft(storage, "scoped", { note: "Privée" }, { contextKey: "brand-a:user-a" });
    expect(loadDraft(storage, "scoped", { contextKey: "brand-b:user-a" })).toBeNull();
  });
});
