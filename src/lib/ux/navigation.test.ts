import { describe, expect, it } from "vitest";
import { getAgentMoreItems, getMobileAgentNavigationItems, getNavigationItems, getNavigationSections, getRoleFamily, getRoleLandingPath, isNavigationItemActive } from "./navigation";

describe("role navigation", () => {
  it("keeps agent navigation focused on field work", () => {
    const links = getNavigationItems("agent").map((item) => item.href);
    expect(links).toContain("/dashboard/agent");
    expect(links).toEqual(["/dashboard/agent", "/dashboard/pharmacies", "/dashboard/orders", "/dashboard/agenda", "/dashboard/agent/more"]);
    expect(links).not.toContain("/dashboard/missions");
    expect(getAgentMoreItems().map((item) => item.href)).toEqual(["/dashboard/products", "/dashboard/missions", "/dashboard/tasks", "/dashboard/agent/performance", "/dashboard/reports", "/dashboard/agent/assistant"]);
    expect(links).not.toContain("/dashboard/users");
    expect(links).not.toContain("/dashboard/admin/onboarding");
  });

  it("adds administration only for authorized roles", () => {
    expect(getNavigationItems("brand_admin").map((item) => item.href)).toContain("/dashboard/imports");
    expect(getNavigationItems("tr1_manager").map((item) => item.href)).not.toContain("/dashboard/imports");
    expect(getNavigationItems("brand_admin").map((item) => item.href)).not.toContain("/dashboard/admin/design-system");
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
    expect(facilitatorLinks).toEqual(["/dashboard/field", "/dashboard/missions", "/dashboard/agenda", "/dashboard/reports"]);
  });

  it("keeps brand pilotage concise and moves reference pages under Paramètres", () => {
    const sections = getNavigationSections("brand_admin");
    expect(sections[0]).toEqual({ label: "Pilotage", items: expect.arrayContaining([
      expect.objectContaining({ href: "/dashboard/commercial-health", label: "Priorités" }),
      expect.objectContaining({ href: "/dashboard/pharmacies" }),
      expect.objectContaining({ href: "/dashboard/orders" }),
      expect.objectContaining({ href: "/dashboard/missions" }),
      expect.objectContaining({ href: "/dashboard/network", label: "Performance" }),
    ]) });
    expect(sections.find((section) => section.label === "Paramètres")?.items.map((item) => item.href)).toEqual([
      "/dashboard/products", "/dashboard/groups", "/dashboard/territories", "/dashboard/imports", "/dashboard/users",
    ]);
  });

  it("declares mobile agent destinations explicitly", () => {
    expect(getMobileAgentNavigationItems().map((item) => item.href)).toEqual([
      "/dashboard/agent", "/dashboard/pharmacies", "/dashboard/orders", "/dashboard/agenda",
    ]);
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
