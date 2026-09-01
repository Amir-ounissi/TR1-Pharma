import { describe, expect, it } from "vitest";
import {
  formatMembershipStatus,
  groupPlatformUsers,
  mapRecentPlatformOnboardings,
  summarizePlatformDashboard,
} from "./platform-admin";

describe("platform admin helpers", () => {
  it("does not double-count users or pharmacies on the global dashboard", () => {
    const summary = summarizePlatformDashboard({
      brands: [
        { id: "brand-a", is_active: true, status: "active" },
        { id: "brand-b", is_active: false, status: "draft" },
      ],
      brandPharmacies: [
        { pharmacy_id: "pharmacy-1", archived_at: null },
        { pharmacy_id: "pharmacy-1", archived_at: null },
        { pharmacy_id: "pharmacy-2", archived_at: null },
      ],
      activeMemberships: [{ user_id: "user-1" }, { user_id: "user-1" }, { user_id: "user-2" }],
      onboardingSessions: [
        {
          id: "session-1",
          brand_id: "brand-b",
          brand_name: "VK Swiss",
          status: "in_progress",
          created_at: "2026-08-11T10:00:00.000Z",
          current_step: "users",
          step_statuses: { organization: "completed", users: "in_progress" },
        },
      ],
    });

    expect(summary).toEqual({
      activeBrands: 1,
      preparingBrands: 1,
      uniquePharmacies: 2,
      brandPharmacyRelations: 3,
      uniqueActiveUsers: 2,
      onboardingsInProgress: 1,
    });
  });

  it("groups memberships into a unique platform user view", () => {
    const users = groupPlatformUsers([
      {
        id: "m1",
        status: "active",
        created_at: "2026-08-10T12:00:00.000Z",
        users: { id: "user-1", email: "owner@tr1.test", user_profiles: { full_name: "Owner TR1" } },
        roles: { key: "super_admin", label: "Super administrateur TR1" },
        brands: null,
      },
      {
        id: "m2",
        status: "active",
        created_at: "2026-08-11T12:00:00.000Z",
        users: { id: "user-2", email: "admin@vk.test", user_profiles: { full_name: "Admin VK" } },
        roles: { key: "brand_admin", label: "Administrateur marque" },
        brands: { id: "brand-a", name: "VK Swiss" },
      },
      {
        id: "m3",
        status: "invited",
        created_at: "2026-08-12T12:00:00.000Z",
        users: { id: "user-2", email: "admin@vk.test", user_profiles: { full_name: "Admin VK" } },
        roles: { key: "brand_admin", label: "Administrateur marque" },
        brands: { id: "brand-a", name: "VK Swiss" },
      },
    ]);

    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({
      fullName: "Admin VK",
      brands: ["VK Swiss"],
      roles: ["Administrateur marque"],
      statuses: ["active", "invited"],
    });
    expect(users[1]).toMatchObject({
      fullName: "Owner TR1",
      brands: ["Plateforme TR1"],
    });
  });

  it("builds readable onboarding summaries", () => {
    const onboardings = mapRecentPlatformOnboardings([
      {
        id: "session-1",
        brand_id: "brand-a",
        brand_name: "VK Swiss",
        status: "ready",
        created_at: "2026-08-11T10:00:00.000Z",
        current_step: "activation",
        step_statuses: {
          organization: "completed",
          brand: "completed",
          settings: "completed",
          activation: "not_started",
        },
      },
    ]);

    expect(onboardings[0]).toMatchObject({
      brandName: "VK Swiss",
      statusLabel: "Prêt à activer",
      checklistProgress: "3/4",
    });
  });

  it("formats membership statuses for the platform table", () => {
    expect(formatMembershipStatus("active")).toBe("Actif");
    expect(formatMembershipStatus("invited")).toBe("Invité");
    expect(formatMembershipStatus("suspended")).toBe("Suspendu");
  });
});
