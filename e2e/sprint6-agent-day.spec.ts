import { expect, test, type Browser, type Page } from "@playwright/test";
import { signIn } from "./test-helpers";

async function openTodayVisit(page: Page) {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");

  await expect(page.getByRole("heading", { name: "Aujourd’hui", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mon programme", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Terminer la visite", exact: true })).toHaveCount(0);

  const visitLink = page.locator('a[href^="/dashboard/visits/"]').filter({ hasText: "Pharmacie République" }).first();
  await expect(visitLink).toBeVisible();
  await expect(visitLink).toContainText("Clôturer");
  await visitLink.click();

  await expect(page.getByRole("heading", { name: "Pharmacie République" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clôturer la visite", exact: true })).toBeVisible();
  await expect(page.getByLabel("Notes / compte rendu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clôturer la visite", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer la visite", exact: true })).toHaveCount(0);
}

async function runAgentDay(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await openTodayVisit(page);
  return { context, page };
}

test("Sprint 6 Agent Day desktop — visite ouverte directement sur la clôture", async ({ browser }) => {
  const { context, page } = await runAgentDay(browser, { width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/sprint6/agent-day-desktop.png", fullPage: true });
  await context.close();
});

test("Sprint 6 Agent Day mobile — parcours terrain sans bouton démarrer", async ({ browser }) => {
  const { context, page } = await runAgentDay(browser, { width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/sprint6/agent-day-mobile-390.png", fullPage: true });

  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/dashboard/agent");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `no horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    await expect(page.getByRole("heading", { name: "Mon programme", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Démarrer", exact: true })).toHaveCount(0);
  }

  await context.close();
});
