import { describe, expect, it } from "vitest";
import { authorizedAgentVisit } from "./agent-authorized-visits";

const owned = new Set(["naali", "vk-swiss"]);
const visit = (brand_ids: string[] | null, source_kind = "field_visit") => ({ brand_ids, source_kind });

describe("agent multibrand visit access", () => {
  it("retains visits for active authorized brands", () => {
    expect(authorizedAgentVisit(visit(["naali"]), owned)).toBe(true);
    expect(authorizedAgentVisit(visit(["naali", "vk-swiss"]), owned)).toBe(true);
  });

  it("rejects revoked, mixed and unscoped visits", () => {
    expect(authorizedAgentVisit(visit(["removed"]), owned)).toBe(false);
    expect(authorizedAgentVisit(visit(["naali", "removed"]), owned)).toBe(false);
    expect(authorizedAgentVisit(visit([]), owned)).toBe(false);
    expect(authorizedAgentVisit(visit(null), owned)).toBe(false);
    expect(authorizedAgentVisit(visit(["naali"], "mission"), owned)).toBe(false);
  });
});
