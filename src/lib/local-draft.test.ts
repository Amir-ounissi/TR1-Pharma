import { describe, expect, it } from "vitest";
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
});
