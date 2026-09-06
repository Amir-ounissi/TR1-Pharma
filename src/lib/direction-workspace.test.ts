import { describe, expect, it } from "vitest";
import { getRoleFamily, getRoleLandingPath, getNavigationItems } from "@/lib/ux/navigation";

describe("Direction workspace boundaries", () => {
  it("keeps Direction separate from manager/admin families", () => {
    expect(getRoleFamily("brand_direction")).toBe("direction");
    expect(getRoleLandingPath("brand_direction")).toBe("/dashboard/direction");
  });

  it("does not expose operational destinations", () => {
    const links = getNavigationItems("brand_direction", "tenant", ["direction_workspace"]).map((item) => item.href);
    expect(links).toEqual(["/dashboard/direction"]);
    expect(links).not.toContain("/dashboard/orders");
    expect(links).not.toContain("/dashboard/tasks");
    expect(links).not.toContain("/dashboard/pharmacies");
  });
});
