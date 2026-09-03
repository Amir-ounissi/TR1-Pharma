import { describe, expect, it } from "vitest";
import {
  ALL_FRANCE_DEPARTMENTS,
  FRANCE_REGIONS,
  getFranceDepartmentLabel,
  sortFranceDepartmentCodes,
} from "./france-geography";

describe("French geography reference", () => {
  it("contains the 18 French administrative regions", () => {
    expect(FRANCE_REGIONS).toHaveLength(18);
  });

  it("contains 101 unique departments including Corsica and overseas departments", () => {
    const codes = ALL_FRANCE_DEPARTMENTS.map((department) => department.code);

    expect(codes).toHaveLength(101);
    expect(new Set(codes).size).toBe(101);
    expect(codes).toEqual(expect.arrayContaining(["13", "30", "34", "2A", "2B", "971", "976"]));
  });

  it("returns readable department labels", () => {
    expect(getFranceDepartmentLabel("13")).toBe("13 — Bouches-du-Rhône");
    expect(getFranceDepartmentLabel("34")).toBe("34 — Hérault");
  });

  it("deduplicates and orders a selection", () => {
    expect(sortFranceDepartmentCodes(["34", "13", "34"])).toEqual(["34", "13"]);
  });
});
