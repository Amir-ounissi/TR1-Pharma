import { describe, expect, it } from "vitest";
import { getNavigationItems, getNavigationSections, getRoleFamily, getRoleLandingPath, isNavigationItemActive } from "./navigation";

describe("role navigation", () => {
  it("keeps agent navigation focused on field work", () => {
    const links = getNavigationItems("agent").map((item) => item.href);
    expect(links).toEqual([
      "/dashboard/agent",
      "/dashboard/pharmacies",
      "/dashboard/orders",
      "/dashboard/missions",
      "/dashboard/agenda",
      "/dashboard/tasks",
      "/dashboard/agent/performance",
      "/dashboard/reports",
      "/dashboard/agent/assistant",
    ]);
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

  it("prioritizes brand administration for a tenant superadmin", () => {
    const sections = getNavigationSections("super_admin", "tenant");

    expect(sections.map((section) => section.label)).toEqual([
      "Administration marque",
      "Consultation commerciale",
    ]);
    expect(sections[0]?.items.map((item) => item.label)).toEqual([
      "Produits",
      "Groupements",
      "Territoires",
      "Imports",
      "Utilisateurs",
      "Configuration UI",
    ]);
    expect(sections[1]?.items.map((item) => item.href)).toContain("/dashboard/commercial-health");
  });

  it("keeps brand admin navigation order unchanged", () => {
    const sections = getNavigationSections("brand_admin", "tenant");

    expect(sections.map((section) => section.label)).toEqual(["Pilotage", "Administration marque"]);
    expect(sections.flatMap((section) => section.items.map((item) => item.href))).toEqual([
      "/dashboard",
      "/dashboard/commercial-health",
      "/dashboard/pharmacies",
      "/dashboard/orders",
      "/dashboard/missions",
      "/dashboard/network",
      "/dashboard/missions/proposals",
      "/dashboard/products",
      "/dashboard/groups",
      "/dashboard/territories",
      "/dashboard/imports",
      "/dashboard/users",
      "/dashboard/admin/design-system",
    ]);
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
