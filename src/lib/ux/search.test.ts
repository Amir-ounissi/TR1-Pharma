import { describe, expect, it } from "vitest";
import { groupSearchItems, moveSearchSelection, searchScopedItems, type SearchItem } from "./search";

const scopedItems: SearchItem[] = [
  { id: "pharmacy-1", kind: "pharmacy", label: "Pharmacie des Lilas", description: "Paris", href: "/dashboard/pharmacies/1" },
  { id: "mission-1", kind: "mission", label: "Animation Dermavita", href: "/dashboard/missions/1" },
  { id: "task-1", kind: "task", label: "Relancer les Lilas", href: "/dashboard/tasks" },
];

describe("permission-scoped search", () => {
  it("searches only the items supplied by the RLS-scoped server query", () => {
    expect(searchScopedItems(scopedItems, "lilas").map((item) => item.id)).toEqual(["pharmacy-1", "task-1"]);
    expect(searchScopedItems(scopedItems, "autre marque")).toEqual([]);
  });

  it("normalizes accents, groups results and applies a limit", () => {
    expect(searchScopedItems(scopedItems, "pharmacie des", 1)).toHaveLength(1);
    expect(groupSearchItems(searchScopedItems(scopedItems, ""))).toHaveLength(3);
  });

  it("wraps keyboard selection", () => {
    expect(moveSearchSelection(-1, 1, 3)).toBe(0);
    expect(moveSearchSelection(2, 1, 3)).toBe(0);
    expect(moveSearchSelection(0, -1, 3)).toBe(2);
  });
});
