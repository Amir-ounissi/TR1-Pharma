import { describe, expect, it } from "vitest";
import { getNavigationItems, getRoleFamily, getRoleLandingPath, isNavigationItemActive } from "./navigation";

describe("role navigation", () => {
  it("keeps agent navigation focused on field work", () => {
    const links = getNavigationItems("agent").map((item) => item.href);
    expect(links).toContain("/dashboard/agent");
    expect(links).toContain("/dashboard/agenda");
    expect(links).not.toContain("/dashboard/users");
    expect(links).not.toContain("/dashboard/admin/onboarding");
  });

  it("adds administration only for authorized roles", () => {
    expect(getNavigationItems("brand_admin").map((item) => item.href)).toContain("/dashboard/imports");
    expect(getNavigationItems("tr1_manager").map((item) => item.href)).not.toContain("/dashboard/imports");
  });

  it("splits global superadmin navigation from tenant navigation", () => {
    const globalLinks = getNavigationItems("super_admin", "platform").map((item) => item.href);
    const tenantLinks = getNavigationItems("super_admin", "tenant").map((item) => item.href);

    expect(globalLinks).toEqual([
      "/dashboard",
      "/dashboard/admin/access-requests",
      "/dashboard/admin/onboarding",
      "/dashboard/admin/users",
      "/dashboard/admin/leads",
    ]);
    expect(globalLinks).not.toContain("/dashboard/users");
    expect(globalLinks).not.toContain("/dashboard/imports");
    expect(tenantLinks).toContain("/dashboard/users");
    expect(tenantLinks).toContain("/dashboard/imports");
    expect(tenantLinks).not.toContain("/dashboard/admin/leads");
  });

  it("keeps platform functions hidden from brand admins and preserves field roles", () => {
    const brandAdminLinks = getNavigationItems("brand_admin").map((item) => item.href);
    const facilitatorLinks = getNavigationItems("facilitator").map((item) => item.href);

    expect(brandAdminLinks).not.toContain("/dashboard/admin/users");
    expect(brandAdminLinks).not.toContain("/dashboard/admin/leads");
    expect(facilitatorLinks).toEqual(["/dashboard/field", "/dashboard/agenda", "/dashboard/missions/new", "/dashboard/reports"]);
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
