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
    "/dashboard/products",
    "/dashboard/orders",
    "/dashboard/agenda",
    "/dashboard/tasks",
    "/dashboard/agent/performance",
    "/dashboard/reports",
    "/dashboard/agent/assistant",
  ]);
});

test("navigation mobile Agent expose les cinq destinations et Plus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "agent@dermavita.local", /Dermavita/i);

  const navigation = page.getByRole("navigation", { name: "Navigation mobile" });
  const links = navigation.getByRole("link");
  await expect(navigation).toBeVisible();
  await expect(links).toHaveCount(5);
  await expect(links.nth(0)).toHaveAttribute("href", "/dashboard/agent");
  await expect(links.nth(1)).toHaveAttribute("href", "/dashboard/pharmacies");
  await expect(links.nth(2)).toHaveAttribute("href", "/dashboard/orders");
  await expect(links.nth(3)).toHaveAttribute("href", "/dashboard/agenda");
  await expect(links.nth(4)).toHaveAttribute("href", "/dashboard/agent/more");

  await links.nth(4).click();
  await expect(page).toHaveURL(/\/dashboard\/agent\/more$/);
  await expect(page.getByRole("heading", { name: "Actions rapides" })).toBeVisible();
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
  await page.goto("/dashboard/admin/saas");
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
    "/dashboard/admin/saas",
    "/dashboard/admin/users",
    "/dashboard/admin/leads",
  ]);
  await page.goto("/dashboard/admin/saas");
  await expect(page.getByRole("heading", { name: "SaaS & capacités" })).toBeVisible();
});
