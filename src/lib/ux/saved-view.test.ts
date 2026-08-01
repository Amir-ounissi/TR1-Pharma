import { describe, expect, it } from "vitest";
import { parseSavedView, savedViewStorageKey, serializeSavedView } from "./saved-view";

describe("lightweight saved views", () => {
  it("isolates preferences by tenant and user", () => {
    expect(savedViewStorageKey("brand-a", "user-a", "priorities")).not.toBe(savedViewStorageKey("brand-b", "user-a", "priorities"));
    expect(savedViewStorageKey("brand-a", "user-a", "priorities")).not.toBe(savedViewStorageKey("brand-a", "user-b", "priorities"));
  });

  it("restores only internal dashboard URLs", () => {
    const view = { name: "Réassorts", href: "/dashboard/commercial-health?filter=reorder_overdue", savedAt: "2026-08-01T00:00:00.000Z" };
    expect(parseSavedView(serializeSavedView(view))).toEqual(view);
    expect(parseSavedView('{"name":"x","href":"https://evil.test","savedAt":"now"}')).toBeNull();
  });
});
