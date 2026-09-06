import { describe, expect, it } from "vitest";
import { getAgentMoreItems, getMobileAgentNavigationItems, getNavigationItems, getNavigationSections, getRoleFamily, getRoleLandingPath, isNavigationItemActive } from "./navigation";

describe("role navigation", () => {
  it("keeps agent navigation focused on field work", () => {
    const links = getNavigationItems("agent").map((item) => item.href);
    expect(links).toContain("/dashboard/agent");
    expect(links).toEqual(["/dashboard/agent", "/dashboard/pharmacies", "/dashboard/orders", "/dashboard/agenda", "/dashboard/agent/more"]);
    expect(links).not.toContain("/dashboard/missions");
    expect(getAgentMoreItems().map((item) => item.href)).toEqual(["/dashboard/products", "/dashboard/missions", "/dashboard/tasks", "/dashboard/agent/performance", "/dashboard/sell-out", "/dashboard/reports", "/dashboard/agent/assistant"]);
    expect(links).not.toContain("/dashboard/users");
    expect(links).not.toContain("/dashboard/subscription");
    expect(links).not.toContain("/dashboard/admin/onboarding");
  });

  it("adds administration only for authorized roles", () => {
    expect(getNavigationItems("brand_admin").map((item) => item.href)).toContain("/dashboard/imports");
    expect(getNavigationItems("brand_admin").map((item) => item.href)).toContain("/dashboard/subscription");
    expect(getNavigationItems("tr1_manager").map((item) => item.href)).not.toContain("/dashboard/imports");
    expect(getNavigationItems("tr1_manager").map((item) => item.href)).not.toContain("/dashboard/subscription");
    expect(getNavigationItems("brand_admin").map((item) => item.href)).not.toContain("/dashboard/admin/design-system");
    expect(getNavigationItems("brand_admin").map((item) => item.href)).not.toContain("/dashboard/admin/saas");
    expect(getNavigationItems("brand_admin").map((item) => item.href)).not.toContain("/dashboard/admin/saas-commercial");
  });

  it("splits global superadmin navigation from tenant navigation", () => {
    const globalLinks = getNavigationItems("super_admin", "platform").map((item) => item.href);
    const tenantLinks = getNavigationItems("super_admin", "tenant").map((item) => item.href);

    expect(globalLinks).toEqual([
      "/dashboard",
      "/dashboard/admin/access-requests",
      "/dashboard/admin/onboarding",
      "/dashboard/admin/saas",
      "/dashboard/admin/saas-commercial",
      "/dashboard/admin/users",
      "/dashboard/admin/leads",
    ]);
    expect(globalLinks).not.toContain("/dashboard/users");
    expect(globalLinks).not.toContain("/dashboard/imports");
    expect(tenantLinks).toContain("/dashboard/users");
    expect(tenantLinks).toContain("/dashboard/imports");
    expect(tenantLinks).toContain("/dashboard/connectors");
    expect(tenantLinks).toContain("/dashboard/providers");
    expect(tenantLinks).toContain("/dashboard/subscription");
    expect(tenantLinks).not.toContain("/dashboard/admin/leads");
    expect(tenantLinks).not.toContain("/dashboard/admin/saas");
    expect(tenantLinks).not.toContain("/dashboard/admin/saas-commercial");
  });

  it("keeps platform functions hidden from brand admins and preserves field roles", () => {
    const brandAdminLinks = getNavigationItems("brand_admin").map((item) => item.href);
    const facilitatorLinks = getNavigationItems("facilitator").map((item) => item.href);

    expect(brandAdminLinks).not.toContain("/dashboard/admin/users");
    expect(brandAdminLinks).not.toContain("/dashboard/admin/leads");
    expect(brandAdminLinks).not.toContain("/dashboard/admin/saas");
    expect(brandAdminLinks).not.toContain("/dashboard/admin/saas-commercial");
    expect(facilitatorLinks).toEqual(["/dashboard/field", "/dashboard/missions", "/dashboard/agenda", "/dashboard/reports"]);
  });

  it("keeps brand pilotage concise and moves reference pages under Paramètres", () => {
    const sections = getNavigationSections("brand_admin");
    expect(sections[0]).toEqual({ label: "Pilotage", items: expect.arrayContaining([
      expect.objectContaining({ href: "/dashboard/forecast", label: "Forecast" }),
      expect.objectContaining({ href: "/dashboard/pharma-360", label: "Pharma 360" }),
      expect.objectContaining({ href: "/dashboard/commercial-health", label: "Priorités" }),
      expect.objectContaining({ href: "/dashboard/providers", label: "Prestataires" }),
      expect.objectContaining({ href: "/dashboard/pharmacies" }),
      expect.objectContaining({ href: "/dashboard/orders" }),
      expect.objectContaining({ href: "/dashboard/missions" }),
      expect.objectContaining({ href: "/dashboard/network", label: "Performance" }),
    ]) });
    expect(sections.find((section) => section.label === "Paramètres")?.items.map((item) => item.href)).toEqual([
      "/dashboard/products", "/dashboard/groups", "/dashboard/territories", "/dashboard/imports", "/dashboard/connectors", "/dashboard/users", "/dashboard/subscription",
    ]);
  });

  it("gives Direction one capability-gated read-only destination", () => {
    expect(getNavigationItems("brand_direction").map((item) => item.href)).toEqual(["/dashboard/direction"]);
    expect(getNavigationItems("brand_direction", "tenant", ["core_crm"])).toEqual([]);
    expect(getNavigationItems("brand_direction", "tenant", ["direction_workspace"]).map((item) => item.href)).toEqual(["/dashboard/direction"]);
  });

  it("filters tenant navigation using the active brand capabilities", () => {
    const coreCapabilities = ["core_crm", "orders", "agent_day", "missions", "performance", "distribution"] as const;
    const managerLinks = getNavigationItems("tr1_manager", "tenant", coreCapabilities).map((item) => item.href);
    const adminLinks = getNavigationItems("brand_admin", "tenant", coreCapabilities).map((item) => item.href);
    const agentMoreLinks = getAgentMoreItems(coreCapabilities).map((item) => item.href);

    expect(managerLinks).not.toContain("/dashboard/forecast");
    expect(managerLinks).not.toContain("/dashboard/pharma-360");
    expect(managerLinks).not.toContain("/dashboard/commercial-health");
    expect(managerLinks).not.toContain("/dashboard/providers");
    expect(managerLinks).toContain("/dashboard/pharmacies");
    expect(managerLinks).toContain("/dashboard/orders");
    expect(adminLinks).not.toContain("/dashboard/connectors");
    expect(adminLinks).toContain("/dashboard/subscription");
    expect(agentMoreLinks).toContain("/dashboard/missions");
    expect(agentMoreLinks).toContain("/dashboard/agent/performance");
    expect(agentMoreLinks).not.toContain("/dashboard/sell-out");
    expect(agentMoreLinks).not.toContain("/dashboard/agent/assistant");
  });

  it("lets an explicit capability immediately expose its module", () => {
    const capabilities = ["core_crm", "orders", "agent_day", "missions", "performance", "assistant_terrain", "next_best_action", "sell_out", "forecast", "pharma_360", "connectors", "multi_provider"] as const;
    expect(getAgentMoreItems(capabilities).map((item) => item.href)).toContain("/dashboard/agent/assistant");
    expect(getAgentMoreItems(capabilities).map((item) => item.href)).toContain("/dashboard/sell-out");
    const managerLinks = getNavigationItems("tr1_manager", "tenant", capabilities).map((item) => item.href);
    const adminLinks = getNavigationItems("brand_admin", "tenant", capabilities).map((item) => item.href);
    expect(managerLinks).toContain("/dashboard/commercial-health");
    expect(managerLinks).toContain("/dashboard/forecast");
    expect(managerLinks).toContain("/dashboard/pharma-360");
    expect(managerLinks).toContain("/dashboard/providers");
    expect(adminLinks).toContain("/dashboard/connectors");
    expect(adminLinks).toContain("/dashboard/subscription");
  });

  it("declares the same five primary destinations on mobile for the agent", () => {
    expect(getMobileAgentNavigationItems().map((item) => item.href)).toEqual([
      "/dashboard/agent",
      "/dashboard/pharmacies",
      "/dashboard/orders",
      "/dashboard/agenda",
      "/dashboard/agent/more",
    ]);
  });

  it("classifies roles and nested active routes", () => {
    expect(getRoleFamily("super_admin")).toBe("admin");
    expect(getRoleFamily("facilitator")).toBe("facilitator");
    expect(getRoleFamily("brand_direction")).toBe("direction");
    expect(isNavigationItemActive("/dashboard/pharmacies/123", "/dashboard/pharmacies")).toBe(true);
    expect(isNavigationItemActive("/dashboard/providers/123", "/dashboard/providers")).toBe(true);
    expect(isNavigationItemActive("/dashboard/commercial-health", "/dashboard")).toBe(false);
  });

  it("sends each role family to its dedicated home", () => {
    expect(getRoleLandingPath("agent")).toBe("/dashboard/agent");
    expect(getRoleLandingPath("facilitator")).toBe("/dashboard/field");
    expect(getRoleLandingPath("brand_direction")).toBe("/dashboard/direction");
    expect(getRoleLandingPath("tr1_manager")).toBe("/dashboard");
    expect(getRoleLandingPath("brand_admin")).toBe("/dashboard");
    expect(getRoleLandingPath("super_admin")).toBe("/dashboard");
  });
});
