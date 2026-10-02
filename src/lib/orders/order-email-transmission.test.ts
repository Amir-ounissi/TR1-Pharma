import { describe, expect, it } from "vitest";
import { isVkSwissBrand } from "./order-email-transmission";

describe("isVkSwissBrand", () => {
  it("recognizes VK SWISS by name or code", () => {
    expect(isVkSwissBrand({ name: "VK SWISS" })).toBe(true);
    expect(isVkSwissBrand({ code: "VKSWISS" })).toBe(true);
    expect(isVkSwissBrand({ name: "vk-swiss" })).toBe(true);
  });

  it("does not match unrelated brands", () => {
    expect(isVkSwissBrand({ name: "Naali" })).toBe(false);
  });
});
