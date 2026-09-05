import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./test-helpers";

async function expectHealthyRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(500);
    await expect(page.locator("[data-nextjs-dialog]"), route).toHaveCount(0);
    await expect(page.locator("body"), route).not.toBeEmpty();
  }
}

test("routes Agent principales et secondaires", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await expectHealthyRoutes(page, [
    "/dashboard/agent",
    "/dashboard/pharmacies",
    "/dashboard/orders",
    "/dashboard/agenda",
    "/dashboard/tasks",
    "/dashboard/agent/performance",
    "/dashboard/reports",
    "/dashboard/agent/assistant",
  ]);
});

test("routes Marque et protections applicatives", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await expectHealthyRoutes(page, [
    "/dashboard",
    "/dashboard/commercial-health",
    "/dashboard/pharmacies",
    "/dashboard/orders",
    "/dashboard/missions",
    "/dashboard/missions/proposals",
    "/dashboard/network",
    "/dashboard/products",
    "/dashboard/groups",
    "/dashboard/territories",
    "/dashboard/imports",
    "/dashboard/users",
  ]);

  await page.goto("/dashboard/admin/design-system");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/pipeline");
  await expect(page).toHaveURL(/\/dashboard\/commercial-health$/);
});

test("routes Intervenant terrain", async ({ page }) => {
  await signIn(page, "animatrice@dermavita.local", /Dermavita/i);
  await expectHealthyRoutes(page, [
    "/dashboard/field",
    "/dashboard/agenda",
    "/dashboard/missions/new",
    "/dashboard/reports",
  ]);
});

test("routes Administration TR1", async ({ page }) => {
  await signIn(page, "superadmin@tr1.local", /Dermavita/i);
  await expectHealthyRoutes(page, [
    "/dashboard",
    "/dashboard/admin/access-requests",
    "/dashboard/admin/onboarding",
    "/dashboard/admin/users",
    "/dashboard/admin/leads",
  ]);
});
