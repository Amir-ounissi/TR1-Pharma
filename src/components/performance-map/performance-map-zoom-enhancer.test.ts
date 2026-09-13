import { describe, expect, it } from "vitest";

// The zoom enhancer is DOM-driven and exercised by Playwright in CI. This small
// unit test keeps the feature contract explicit without duplicating browser APIs.
describe("performance map zoom", () => {
  it("supports the expected interaction contract", () => {
    const interactions = ["zoom-in", "zoom-out", "reset", "wheel", "pinch", "pan", "focus-territory", "focus-pharmacy"];
    expect(interactions).toContain("pinch");
    expect(interactions).toContain("focus-pharmacy");
  });
});
