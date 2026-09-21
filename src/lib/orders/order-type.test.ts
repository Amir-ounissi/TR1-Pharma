import { describe, expect, it } from "vitest";
import { automaticOrderType } from "./order-type";

describe("automaticOrderType", () => {
  it("classifies a first pharmacy order as an implantation", () => {
    expect(automaticOrderType(false)).toBe("initial");
  });

  it("classifies every later pharmacy order as a reorder", () => {
    expect(automaticOrderType(true)).toBe("reorder");
  });
});
