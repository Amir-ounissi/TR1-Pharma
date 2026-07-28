import { describe, expect, it } from "vitest";
import { canSelectBrand } from "./brand-context";

const contexts = [{ id: "brand-a", name: "A", slug: "a", role: "brand_admin" }];

describe("canSelectBrand", () => {
  it("accepts an assigned brand", () => expect(canSelectBrand(contexts, "brand-a")).toBe(true));
  it("rejects URL or form tampering", () => expect(canSelectBrand(contexts, "brand-b")).toBe(false));
  it("rejects non-string input", () => expect(canSelectBrand(contexts, null)).toBe(false));
});
