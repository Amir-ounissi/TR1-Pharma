import { describe, expect, it } from "vitest";
import { getNavigationItems, getRoleFamily, getRoleLandingPath, isNavigationItemActive } from "./navigation";

describe("role navigation", () => {
  it("keeps agent navigation focused on field work", () => {
    const links = getNavigationItems("agent").map((item) => item.href);
    expect(links).toContain("/dashboard/agent");
    expect(links).not.toContain("/dashboard/users");
    expect(links).not.toContain("/dashboard/admin/onboarding");
  });

  it("adds administration only for authorized roles", () => {
    expect(getNavigationItems("brand_admin").map((item) => item.href)).toContain("/dashboard/imports");
    expect(getNavigationItems("tr1_manager").map((item) => item.href)).not.toContain("/dashboard/imports");
  });

  it("classifies roles and nested active routes", () => {
    expect(getRoleFamily("super_admin")).toBe("admin");
    expect(getRoleFamily("facilitator")).toBe("facilitator");
    expect(isNavigationItemActive("/dashboard/pharmacies/123", "/dashboard/pharmacies")).toBe(true);
    expect(isNavigationItemActive("/dashboard/commercial-health", "/dashboard")).toBe(false);
  });

  it("sends each role family to its dedicated home", () => {
    expect(getRoleLandingPath("agent")).toBe("/dashboard/agent");
    expect(getRoleLandingPath("facilitator")).toBe("/dashboard/field");
    expect(getRoleLandingPath("tr1_manager")).toBe("/dashboard");
    expect(getRoleLandingPath("brand_admin")).toBe("/dashboard");
    expect(getRoleLandingPath("super_admin")).toBe("/dashboard");
  });
});
